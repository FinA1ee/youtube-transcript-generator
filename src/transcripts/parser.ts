import { XMLParser } from "fast-xml-parser";
import {
  AppError,
  CaptionTrack,
  Transcript,
  TranscriptSegment,
  VideoMetadata
} from "../shared/types";
import { selectCaptionTrack, YoutubeClient } from "../youtube/client";

const DEFAULT_MAX_DURATION_MINUTES = 100;

interface TranscriptParserOptions {
  maxDurationMinutes?: number | undefined;
  maxSegments?: number | undefined;
}

interface TimedTextNode {
  text?: TimedTextEntry | TimedTextEntry[];
}

interface TimedTextEntry {
  "@_start"?: string;
  "@_dur"?: string;
  "#text"?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  htmlEntities: true,
  trimValues: true
});

export async function fetchTranscript(
  videoId: string,
  youtubeClient: YoutubeClient,
  options: TranscriptParserOptions = {},
  signal?: AbortSignal
): Promise<Transcript> {
  const metadata = await youtubeClient.getVideoMetadata(videoId, signal);
  enforceDurationLimit(metadata, options.maxDurationMinutes ?? DEFAULT_MAX_DURATION_MINUTES);
  const track = selectCaptionTrack(metadata);
  const captionPayload = await youtubeClient.fetchCaptionTrack(track, signal);
  const transcript = parseCaptionPayload(videoId, captionPayload, track, metadata.durationSeconds);

  if (options.maxSegments && transcript.segments.length > options.maxSegments) {
    throw new AppError("transcript_too_large", "The transcript is too large to process.");
  }

  return transcript;
}

export function parseCaptionPayload(
  videoId: string,
  payload: string,
  track: CaptionTrack,
  durationSeconds?: number
): Transcript {
  const parsed = xmlParser.parse(payload) as unknown;
  const timedText = readTimedText(parsed);
  const entries = Array.isArray(timedText.text)
    ? timedText.text
    : timedText.text
      ? [timedText.text]
      : [];

  const segments = entries.map((entry): TranscriptSegment => {
    const startMs = secondsToMs(entry["@_start"]);
    const durationMs = secondsToMs(entry["@_dur"]);
    const text = normalizeCaptionText(entry["#text"]);

    if (startMs === null || text.length === 0) {
      throw new AppError("transcript_parse_error", "Unable to parse caption timing or text.");
    }

    return {
      startMs,
      endMs: durationMs === null ? undefined : startMs + durationMs,
      text,
      language: track.languageCode,
      captionKind: track.kind
    };
  });

  if (segments.length === 0) {
    throw new AppError("transcript_parse_error", "The selected caption track has no timed text.");
  }

  return {
    videoId,
    language: track.languageCode,
    captionKind: track.kind,
    durationSeconds,
    segments: segments.sort((a, b) => a.startMs - b.startMs)
  };
}

function enforceDurationLimit(metadata: VideoMetadata, maxDurationMinutes: number): void {
  if (metadata.durationSeconds && metadata.durationSeconds > maxDurationMinutes * 60) {
    throw new AppError("transcript_too_large", "Videos longer than 100 minutes are not supported.");
  }
}

function readTimedText(value: unknown): TimedTextNode {
  if (!isRecord(value)) {
    throw new AppError("transcript_parse_error", "Caption payload is not valid XML.");
  }
  const transcript = value["transcript"];
  if (!isRecord(transcript)) {
    throw new AppError("transcript_parse_error", "Caption payload is missing transcript data.");
  }
  return transcript;
}

function secondsToMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

function normalizeCaptionText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
