import { ApiError, GoogleGenAI } from "@google/genai/web";
import { z } from "zod";
import {
  AppError,
  ChapterFiveWOneHSummary,
  ChapterSummaryContext,
  Report,
  ReportGenerationOptions,
  StreamEvent,
  Transcript
} from "../shared/types";
import { buildChapterFiveWOneHPrompt, buildReportPrompt } from "./prompt";
import { NdjsonReportEventParser } from "./ndjson";

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_PREFLIGHT_PROMPT =
  'Respond with exactly this JSON object and no extra text: {"ok":true}';

const reportSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  captionKind: z.enum(["manual", "auto_generated"]).optional(),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        heading: z.string().min(1),
        paragraphs: z.array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
            sourceRange: z
              .object({
                startMs: z.number().int().nonnegative(),
                endMs: z.number().int().nonnegative()
              })
              .optional()
          })
        )
      })
    )
    .min(1)
});

const chapterFiveWOneHSummarySchema = z.object({
  who: z.string().min(1),
  what: z.string().min(1),
  when: z.string().min(1),
  where: z.string().min(1),
  why: z.string().min(1),
  how: z.string().min(1)
});

export interface GeminiConfig {
  apiKey?: string | undefined;
  model?: string | undefined;
}

export interface GeminiClient {
  preflight(signal?: AbortSignal): Promise<void>;
  generateReport(
    transcript: Transcript,
    options?: ReportGenerationOptions,
    signal?: AbortSignal
  ): Promise<Report>;
  generateReportStream(
    transcript: Transcript,
    options?: ReportGenerationOptions,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent>;
  generateChapterFiveWOneH(
    context: ChapterSummaryContext,
    signal?: AbortSignal
  ): Promise<ChapterFiveWOneHSummary>;
}

export class GeminiApiClient implements GeminiClient {
  constructor(private readonly config: GeminiConfig) {}

  async preflight(signal?: AbortSignal): Promise<void> {
    const body = await this.callGemini(
      GEMINI_PREFLIGHT_PROMPT,
      {
        responseMimeType: "application/json"
      },
      signal,
      "Gemini setup check failed."
    );
    const text = extractGeminiText(body);
    const parsed = parseGeminiJson(text, "Gemini setup check returned invalid output.");
    if (!isRecord(parsed) || parsed["ok"] !== true) {
      throw new AppError(
        "gemini_service_error",
        "Gemini setup check returned invalid output.",
        502
      );
    }
  }

  async generateReport(
    transcript: Transcript,
    options: ReportGenerationOptions = {},
    signal?: AbortSignal
  ): Promise<Report> {
    const report: Report = {
      title: "",
      subtitle: "",
      captionKind: transcript.captionKind,
      sections: []
    };
    for await (const event of this.generateReportStream(transcript, options, signal)) {
      if (event.type === "title") {
        report.title = event.title;
        report.subtitle = event.subtitle;
      } else if (event.type === "section") {
        report.sections.push({ ...event.section, paragraphs: [] });
      } else if (event.type === "summary_paragraph") {
        const section = report.sections.find((item) => item.id === event.sectionId);
        section?.paragraphs.push(event.paragraph);
      }
    }
    return parseReport(report);
  }

  async *generateReportStream(
    transcript: Transcript,
    options: ReportGenerationOptions = {},
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    const parser = new NdjsonReportEventParser();
    let emitted = false;

    for await (const chunk of this.callGeminiStream(
      buildReportPrompt(transcript, options),
      {
        responseMimeType: "text/plain"
      },
      signal,
      "Gemini could not generate the report."
    )) {
      for (const event of parser.push(chunk)) {
        emitted = true;
        yield event;
      }
    }

    for (const event of parser.flush()) {
      emitted = true;
      yield event;
    }

    if (!emitted) {
      throw new AppError(
        "generation_validation_error",
        "Gemini returned no usable report chunks.",
        502
      );
    }
  }

  async generateChapterFiveWOneH(
    context: ChapterSummaryContext,
    signal?: AbortSignal
  ): Promise<ChapterFiveWOneHSummary> {
    const body = await this.callGemini(
      buildChapterFiveWOneHPrompt(context),
      {
        responseMimeType: "application/json"
      },
      signal,
      "Gemini could not generate the chapter 5W1H summary."
    );
    const text = extractGeminiText(body);
    const parsed = parseGeminiJson(
      text,
      "Gemini returned an invalid chapter 5W1H summary.",
      "generation_validation_error"
    );
    return parseChapterFiveWOneHSummary(parsed);
  }

  private async callGemini(
    prompt: string,
    generationConfig: Record<string, unknown>,
    signal: AbortSignal | undefined,
    serviceErrorMessage: string
  ): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new AppError("gemini_config_error", "Gemini API key is not configured.", 500);
    }

    const apiKey = this.config.apiKey;
    const model = this.config.model ?? DEFAULT_GEMINI_MODEL;
    const ai = this.createClient(apiKey);
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: generationConfig
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      throw mapGeminiError(error, serviceErrorMessage);
    }
  }

  private async *callGeminiStream(
    prompt: string,
    generationConfig: Record<string, unknown>,
    signal: AbortSignal | undefined,
    serviceErrorMessage: string
  ): AsyncGenerator<string> {
    if (!this.config.apiKey) {
      throw new AppError("gemini_config_error", "Gemini API key is not configured.", 500);
    }

    const apiKey = this.config.apiKey;
    const model = this.config.model ?? DEFAULT_GEMINI_MODEL;
    const ai = this.createClient(apiKey);
    try {
      const response = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: generationConfig
      });
      for await (const chunk of response) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      throw mapGeminiError(error, serviceErrorMessage);
    }
  }

  private createClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({
      apiKey
    });
  }
}

function extractGeminiText(value: unknown): string {
  if (!isRecord(value)) {
    throw new AppError("gemini_service_error", "Gemini returned an invalid response.", 502);
  }
  const candidates = value["candidates"];
  if (!Array.isArray(candidates)) {
    throw new AppError("gemini_service_error", "Gemini returned no candidates.", 502);
  }
  const first: unknown = candidates[0];
  if (!isRecord(first)) {
    throw new AppError("gemini_service_error", "Gemini returned an invalid candidate.", 502);
  }
  const content = first["content"];
  if (!isRecord(content) || !Array.isArray(content["parts"])) {
    throw new AppError("gemini_service_error", "Gemini returned no content parts.", 502);
  }
  const parts: unknown[] = content["parts"];
  const part: unknown = parts[0];
  if (!isRecord(part) || typeof part["text"] !== "string") {
    throw new AppError("gemini_service_error", "Gemini returned no report text.", 502);
  }
  return part["text"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGeminiJson(
  text: string,
  message: string,
  code: "gemini_service_error" | "generation_validation_error" = "gemini_service_error"
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError(code, message, 502);
  }
}

function parseReport(value: unknown): Report {
  try {
    return reportSchema.parse(value);
  } catch {
    throw new AppError(
      "generation_validation_error",
      "Gemini returned an invalid report structure.",
      502
    );
  }
}

function parseChapterFiveWOneHSummary(value: unknown): ChapterFiveWOneHSummary {
  try {
    return chapterFiveWOneHSummarySchema.parse(value);
  } catch {
    throw new AppError(
      "generation_validation_error",
      "Gemini returned an invalid chapter 5W1H summary.",
      502
    );
  }
}

function mapGeminiError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new AppError(
        "gemini_rate_limited",
        "Gemini rate limit reached. Try again later.",
        429
      );
    }

    if (error.status === 401 || error.status === 403) {
      return new AppError("gemini_config_error", "Gemini API key is invalid or unauthorized.", 500);
    }

    if (error.status === 404) {
      return new AppError("gemini_service_error", "Configured Gemini model is unavailable.", 502);
    }

    return new AppError("gemini_service_error", fallbackMessage, 502);
  }

  if (error instanceof TypeError) {
    return new AppError("gemini_service_error", "Gemini service is unreachable.", 502);
  }

  return new AppError("gemini_service_error", fallbackMessage, 502);
}
