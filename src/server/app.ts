import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { clientScript, renderAppHtml, styles } from "../client/assets";
import { GeminiApiClient, GeminiClient, GeminiConfig } from "../llm/gemini";
import { ReportContextStore } from "../reports/context";
import { streamReportFromTranscript } from "../reports/pipeline";
import {
  AppError,
  ChapterFiveWOneHResponse,
  GeminiPreflightResponse,
  JsonErrorResponse,
  StreamEvent,
  TranscriptFetchResponse
} from "../shared/types";
import { TranscriptApiClient, TranscriptClient } from "../transcripts/client";
import { signTranscriptToken, verifyTranscriptToken } from "../transcripts/token";
import { normalizeYoutubeUrl } from "../youtube/url";

const MAX_GENERATION_REQUIREMENTS_LENGTH = 1000;

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TRANSCRIPTAPI_KEY?: string;
  TRANSCRIPT_TOKEN_SECRET?: string;
  ENABLE_DIAGNOSTIC_CONTROLS?: string;
  MAX_VIDEO_DURATION_MINUTES?: string;
  MAX_TRANSCRIPT_SEGMENTS?: string;
  MAX_TRANSCRIPT_CHARACTERS?: string;
}

export interface AppFactories {
  createTranscriptClient?: (env: Env, fetcher: typeof fetch) => TranscriptClient;
  createGeminiClient?: (env: Env) => GeminiClient;
  reportContextStore?: ReportContextStore;
}

export function createApp(
  fetcher: typeof fetch = fetch,
  factories: AppFactories = {}
): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const reportContextStore = factories.reportContextStore ?? new ReportContextStore();

  app.get("/", (c) => {
    const env = (c.env as Env | undefined) ?? {};
    return c.html(renderAppHtml(env.ENABLE_DIAGNOSTIC_CONTROLS === "true"));
  });
  app.get("/styles.css", (c) => c.text(styles, 200, { "content-type": "text/css" }));
  app.get("/client.js", (c) =>
    c.text(clientScript, 200, { "content-type": "application/javascript" })
  );

  app.post("/api/gemini/preflight", async (c) => {
    const env = (c.env as Env | undefined) ?? {};
    const geminiClient =
      factories.createGeminiClient?.(env) ?? new GeminiApiClient(createGeminiConfig(env));
    try {
      await geminiClient.preflight();
      const body: GeminiPreflightResponse = {
        ok: true,
        message: "Gemini setup check succeeded."
      };
      return c.json(body);
    } catch (error) {
      return jsonError(c, error, "Gemini setup check failed.");
    }
  });

  app.post("/api/transcripts/fetch", async (c) => {
    const env = (c.env as Env | undefined) ?? {};
    const body = await readJsonBody(c.req.raw);
    if (!body.ok) {
      return jsonError(c, body.error);
    }

    try {
      if (!isRecord(body.value) || typeof body.value["url"] !== "string") {
        throw new AppError("invalid_youtube_url", "Enter a valid YouTube video URL.");
      }
      const { canonicalUrl } = normalizeYoutubeUrl(body.value["url"]);
      const transcriptClient =
        factories.createTranscriptClient?.(env, fetcher) ??
        new TranscriptApiClient(createTranscriptApiConfig(env), fetcher);
      const transcript = await transcriptClient.fetchTranscript(
        canonicalUrl,
        createTranscriptOptions(env)
      );
      const now = Date.now();
      const ttlSeconds = 10 * 60;
      const transcriptToken = await signTranscriptToken(transcript, env.TRANSCRIPT_TOKEN_SECRET, {
        now,
        ttlSeconds
      });
      const response: TranscriptFetchResponse = {
        transcriptToken,
        expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
        ...(transcript.captionKind ? { captionKind: transcript.captionKind } : {}),
        ...(transcript.language ? { language: transcript.language } : {})
      };
      return c.json(response);
    } catch (error) {
      return jsonError(c, error);
    }
  });

  app.get("/api/reports/stream", (c) => {
    return jsonError(
      c,
      new AppError("generation_validation_error", "Report stream requires POST.", 405)
    );
  });

  app.post("/api/reports/stream", async (c) => {
    const body = await readJsonBody(c.req.raw);
    if (!body.ok) {
      return jsonError(c, body.error);
    }
    const abortController = new AbortController();
    const env = (c.env as Env | undefined) ?? {};

    if (!isRecord(body.value) || typeof body.value["transcriptToken"] !== "string") {
      return jsonError(
        c,
        new AppError("transcript_token_error", "Transcript token is invalid.", 400)
      );
    }
    const generationRequirementsResult = parseGenerationRequirements(
      body.value["generationRequirements"]
    );
    if (!generationRequirementsResult.ok) {
      return jsonError(c, generationRequirementsResult.error);
    }

    try {
      const transcript = await verifyTranscriptToken(
        body.value["transcriptToken"],
        env.TRANSCRIPT_TOKEN_SECRET
      );
      const generationOptions = generationRequirementsResult.value
        ? { generationRequirements: generationRequirementsResult.value }
        : {};
      const reportContext = reportContextStore.create(transcript, generationOptions);
      return streamSSE(c, async (stream) => {
        const geminiClient =
          factories.createGeminiClient?.(env) ?? new GeminiApiClient(createGeminiConfig(env));
        stream.onAbort(() => {
          abortController.abort();
        });

        let id = 0;
        await stream.writeSSE(
          toSseMessage({ type: "report_context", reportContextId: reportContext.id }, id)
        );
        id += 1;
        for await (const event of streamReportFromTranscript(
          transcript,
          geminiClient,
          generationOptions,
          abortController.signal
        )) {
          reportContextStore.applyEvent(reportContext.id, event);
          await stream.writeSSE(toSseMessage(event, id));
          id += 1;
        }
      });
    } catch (error) {
      return jsonError(c, error);
    }
  });

  app.post("/api/reports/chapter-5w1h", async (c) => {
    const body = await readJsonBody(c.req.raw);
    if (!body.ok) {
      return jsonError(c, body.error);
    }
    const env = (c.env as Env | undefined) ?? {};

    try {
      if (!isRecord(body.value)) {
        throw new AppError("generation_validation_error", "Chapter summary request is invalid.");
      }
      rejectFullContentFields(body.value);
      const reportContextId = readRequiredString(body.value, "reportContextId");
      const chapterId = readRequiredString(body.value, "chapterId");
      const context = reportContextStore.getChapterSummaryContext(reportContextId, chapterId);
      const geminiClient =
        factories.createGeminiClient?.(env) ?? new GeminiApiClient(createGeminiConfig(env));
      const summary = await geminiClient.generateChapterFiveWOneH(context);
      const response: ChapterFiveWOneHResponse = {
        reportContextId,
        chapterId,
        summary
      };
      return c.json(response);
    } catch (error) {
      return jsonError(c, error);
    }
  });

  app.get("/api/gemini/preflight/stream", (c) => {
    return jsonError(
      c,
      new AppError("generation_validation_error", "Gemini preflight requires POST.", 405)
    );
  });

  return app;
}

function createTranscriptOptions(env: Env): {
  maxDurationMinutes: number;
  maxSegments?: number | undefined;
  maxCharacters?: number | undefined;
} {
  const maxSegments = env.MAX_TRANSCRIPT_SEGMENTS
    ? Number.parseInt(env.MAX_TRANSCRIPT_SEGMENTS, 10)
    : undefined;
  const maxCharacters = env.MAX_TRANSCRIPT_CHARACTERS
    ? Number.parseInt(env.MAX_TRANSCRIPT_CHARACTERS, 10)
    : undefined;
  return {
    maxDurationMinutes: env.MAX_VIDEO_DURATION_MINUTES
      ? Number.parseInt(env.MAX_VIDEO_DURATION_MINUTES, 10)
      : 100,
    ...(maxSegments !== undefined ? { maxSegments } : {}),
    ...(maxCharacters !== undefined ? { maxCharacters } : {})
  };
}

function createTranscriptApiConfig(env: Env): { apiKey?: string | undefined } {
  const transcriptConfig: { apiKey?: string | undefined } = {};
  if (env.TRANSCRIPTAPI_KEY) {
    transcriptConfig.apiKey = env.TRANSCRIPTAPI_KEY;
  }
  return transcriptConfig;
}

function createGeminiConfig(env: Env): GeminiConfig {
  const geminiConfig: GeminiConfig = {};
  if (env.GEMINI_API_KEY) {
    geminiConfig.apiKey = env.GEMINI_API_KEY;
  }
  if (env.GEMINI_MODEL) {
    geminiConfig.model = env.GEMINI_MODEL;
  }
  return geminiConfig;
}

function toSseMessage(
  event:
    | StreamEvent
    | { type: "preflight_state" | "preflight_complete" | "error"; [key: string]: unknown },
  id: number
): { data: string; event?: string; id: string } {
  return {
    id: String(id),
    event: event.type,
    data: JSON.stringify(event)
  };
}

async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; error: AppError }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      error: new AppError("generation_validation_error", "Request body must be valid JSON.", 400)
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGenerationRequirements(
  value: unknown
): { ok: true; value?: string | undefined } | { ok: false; error: AppError } {
  if (value === undefined || value === null) {
    return { ok: true };
  }
  if (typeof value !== "string") {
    return {
      ok: false,
      error: new AppError("generation_validation_error", "Generation requirements must be text.")
    };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true };
  }
  if (trimmed.length > MAX_GENERATION_REQUIREMENTS_LENGTH) {
    return {
      ok: false,
      error: new AppError(
        "generation_validation_error",
        `Generation requirements must be ${String(MAX_GENERATION_REQUIREMENTS_LENGTH)} characters or fewer.`
      )
    };
  }
  return { ok: true, value: trimmed };
}

function readRequiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new AppError("generation_validation_error", "Chapter summary request is invalid.");
  }
  return field.trim();
}

function rejectFullContentFields(value: Record<string, unknown>): void {
  for (const key of ["article", "transcript", "paragraphs", "report", "content"]) {
    if (key in value) {
      throw new AppError(
        "generation_validation_error",
        "Chapter summary requests must use server-saved context."
      );
    }
  }
}

function toJsonError(error: unknown, fallbackMessage = "Request failed."): JsonErrorResponse {
  if (error instanceof AppError) {
    return { error: { code: error.code, message: error.message } };
  }
  return {
    error: {
      code: "gemini_service_error",
      message: fallbackMessage
    }
  };
}

function jsonError(
  c: { json: (body: JsonErrorResponse, status?: number) => Response },
  error: unknown,
  fallbackMessage?: string
): Response {
  const body = toJsonError(error, fallbackMessage);
  const status = error instanceof AppError ? error.status : 500;
  return c.json(body, status);
}
