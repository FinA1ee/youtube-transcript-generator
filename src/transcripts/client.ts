import { AppError, CaptionKind, Transcript, TranscriptSegment } from "../shared/types";

export interface TranscriptClient {
  fetchTranscript(
    videoUrl: string,
    options?: TranscriptFetchOptions,
    signal?: AbortSignal
  ): Promise<Transcript>;
}

export interface TranscriptFetchOptions {
  maxDurationMinutes?: number | undefined;
  maxSegments?: number | undefined;
  maxCharacters?: number | undefined;
}

export interface TranscriptApiConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
}

interface TranscriptApiResponse {
  video_id?: unknown;
  language?: unknown;
  metadata?: {
    duration?: unknown;
    duration_seconds?: unknown;
    length_seconds?: unknown;
  };
  transcript?: unknown;
}

interface TranscriptApiEntry {
  text?: unknown;
  start?: unknown;
  duration?: unknown;
  speaker?: unknown;
  caption_kind?: unknown;
  captionKind?: unknown;
}

const DEFAULT_BASE_URL = "https://transcriptapi.com/api/v2";
const DEFAULT_MAX_DURATION_MINUTES = 100;

export class TranscriptApiClient implements TranscriptClient {
  constructor(
    private readonly config: TranscriptApiConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async fetchTranscript(
    videoUrl: string,
    options: TranscriptFetchOptions = {},
    signal?: AbortSignal
  ): Promise<Transcript> {
    if (!this.config.apiKey) {
      throw new AppError("transcript_config_error", "TranscriptAPI key is not configured.", 500);
    }

    const url = new URL(`${this.config.baseUrl ?? DEFAULT_BASE_URL}/youtube/transcript`);
    url.searchParams.set("video_url", videoUrl);

    let response: Response;
    try {
      const requestInit: RequestInit = {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      };
      if (signal) {
        requestInit.signal = signal;
      }
      response = await this.fetcher.call(globalThis, url.toString(), requestInit);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      throw new AppError("transcript_provider_error", "Transcript service is unreachable.", 502);
    }

    if (!response.ok) {
      throw mapTranscriptApiStatus(response.status);
    }

    const body = await readJson(response);
    const transcript = parseTranscriptApiResponse(body);
    enforceTranscriptLimits(transcript, options);
    return transcript;
  }
}

function parseTranscriptApiResponse(value: unknown): Transcript {
  if (!isRecord(value)) {
    throw malformedResponse();
  }
  const response = value as TranscriptApiResponse;
  if (!Array.isArray(response.transcript)) {
    throw malformedResponse();
  }

  const language = typeof response.language === "string" ? response.language : undefined;
  const captionKind = readCaptionKind(value);
  const segments = response.transcript.map((entry, index) =>
    parseTranscriptEntry(entry, index, language, captionKind)
  );

  if (segments.length === 0) {
    throw new AppError("transcript_unavailable", "No transcript is available for this video.", 404);
  }

  const durationSeconds = readDurationSeconds(response);
  return {
    videoId: typeof response.video_id === "string" ? response.video_id : "unknown",
    ...(language ? { language } : {}),
    ...(captionKind ? { captionKind } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    segments: segments.sort((a, b) => a.startMs - b.startMs)
  };
}

function parseTranscriptEntry(
  value: unknown,
  index: number,
  language: string | undefined,
  captionKind: CaptionKind | undefined
): TranscriptSegment {
  if (!isRecord(value)) {
    throw malformedResponse();
  }
  const entry = value as TranscriptApiEntry;
  if (typeof entry.text !== "string" || entry.text.trim().length === 0) {
    throw malformedResponse();
  }

  const startMs = secondsToMs(entry.start) ?? index;
  const durationMs = secondsToMs(entry.duration);
  const speaker =
    typeof entry.speaker === "string" && entry.speaker.trim() ? entry.speaker.trim() : undefined;
  const entryCaptionKind = readCaptionKind(entry) ?? captionKind;

  return {
    startMs,
    ...(durationMs !== undefined ? { endMs: startMs + durationMs } : {}),
    text: normalizeTranscriptText(entry.text),
    ...(language ? { language } : {}),
    ...(entryCaptionKind ? { captionKind: entryCaptionKind } : {}),
    speaker: speaker ?? "unknown"
  };
}

function enforceTranscriptLimits(transcript: Transcript, options: TranscriptFetchOptions): void {
  const maxDurationMinutes = options.maxDurationMinutes ?? DEFAULT_MAX_DURATION_MINUTES;
  if (
    transcript.durationSeconds !== undefined &&
    transcript.durationSeconds > maxDurationMinutes * 60
  ) {
    throw new AppError("transcript_too_large", "Videos longer than 100 minutes are not supported.");
  }

  if (options.maxSegments !== undefined && transcript.segments.length > options.maxSegments) {
    throw new AppError("transcript_too_large", "The transcript is too large to process.");
  }

  const maxCharacters = options.maxCharacters;
  if (
    maxCharacters !== undefined &&
    transcript.segments.reduce((total, segment) => total + segment.text.length, 0) > maxCharacters
  ) {
    throw new AppError("transcript_too_large", "The transcript is too large to process.");
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw malformedResponse();
  }
}

function mapTranscriptApiStatus(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      "transcript_config_error",
      "TranscriptAPI key is invalid or unauthorized.",
      500
    );
  }
  if (status === 402) {
    return new AppError(
      "transcript_provider_error",
      "Transcript service credits are unavailable.",
      402
    );
  }
  if (status === 404) {
    return new AppError(
      "transcript_unavailable",
      "No transcript is available for this video.",
      404
    );
  }
  if (status === 408 || status === 429 || status === 503) {
    return new AppError(
      "transcript_provider_error",
      "Transcript service is temporarily unavailable. Try again later.",
      503
    );
  }
  return new AppError("transcript_provider_error", "Transcript service failed.", 502);
}

function malformedResponse(): AppError {
  return new AppError(
    "transcript_parse_error",
    "Transcript service returned an invalid response.",
    502
  );
}

function readCaptionKind(value: unknown): CaptionKind | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value["captionKind"] ?? value["caption_kind"] ?? value["kind"];
  if (raw === "manual" || raw === "auto_generated") {
    return raw;
  }
  if (raw === "asr" || raw === "auto-generated") {
    return "auto_generated";
  }
  return undefined;
}

function readDurationSeconds(response: TranscriptApiResponse): number | undefined {
  return (
    readFiniteNumber(response.metadata?.duration_seconds) ??
    readFiniteNumber(response.metadata?.length_seconds) ??
    readFiniteNumber(response.metadata?.duration)
  );
}

function secondsToMs(value: unknown): number | undefined {
  const seconds = readFiniteNumber(value);
  return seconds === undefined ? undefined : Math.round(seconds * 1000);
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeTranscriptText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
