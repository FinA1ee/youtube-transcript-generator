import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { appHtml, clientScript, styles } from "../client/assets";
import { GeminiApiClient, GeminiClient, GeminiConfig } from "../llm/gemini";
import { streamReportFromTranscript } from "../reports/pipeline";
import {
  AppError,
  GeminiPreflightResponse,
  JsonErrorResponse,
  StreamEvent,
  TranscriptFetchResponse
} from "../shared/types";
import { TranscriptApiClient, TranscriptClient } from "../transcripts/client";
import { signTranscriptToken, verifyTranscriptToken } from "../transcripts/token";
import { normalizeYoutubeUrl } from "../youtube/url";

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TRANSCRIPTAPI_KEY?: string;
  TRANSCRIPT_TOKEN_SECRET?: string;
  MAX_VIDEO_DURATION_MINUTES?: string;
  MAX_TRANSCRIPT_SEGMENTS?: string;
  MAX_TRANSCRIPT_CHARACTERS?: string;
}

export interface AppFactories {
  createTranscriptClient?: (env: Env, fetcher: typeof fetch) => TranscriptClient;
  createGeminiClient?: (env: Env) => GeminiClient;
}

export function createApp(
  fetcher: typeof fetch = fetch,
  factories: AppFactories = {}
): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/", (c) => c.html(appHtml));
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

    try {
      const transcript = await verifyTranscriptToken(
        body.value["transcriptToken"],
        env.TRANSCRIPT_TOKEN_SECRET
      );
      return streamSSE(c, async (stream) => {
        const geminiClient =
          factories.createGeminiClient?.(env) ?? new GeminiApiClient(createGeminiConfig(env));
        stream.onAbort(() => {
          abortController.abort();
        });

        let id = 0;
        for await (const event of streamReportFromTranscript(
          transcript,
          geminiClient,
          abortController.signal
        )) {
          await stream.writeSSE(toSseMessage(event, id));
          id += 1;
        }
      });
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
