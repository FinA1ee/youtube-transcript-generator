export type CaptionKind = "manual" | "auto_generated";

export type GenerationState =
  | "idle"
  | "loading"
  | "streaming_report"
  | "complete"
  | "transcript_unavailable"
  | "provider_error"
  | "validation_error"
  | "disconnected"
  | "reconnecting"
  | "retry_failed"
  | "canceled";

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: string;
  kind: CaptionKind;
  isDefault: boolean;
}

export interface VideoMetadata {
  videoId: string;
  title?: string | undefined;
  durationSeconds?: number | undefined;
  defaultLanguage?: string | undefined;
  captionTracks: CaptionTrack[];
}

export interface TranscriptSegment {
  startMs: number;
  endMs?: number | undefined;
  text: string;
  language?: string | undefined;
  captionKind?: CaptionKind | undefined;
  speaker?: string | undefined;
}

export interface Transcript {
  videoId: string;
  language?: string | undefined;
  captionKind?: CaptionKind | undefined;
  segments: TranscriptSegment[];
  durationSeconds?: number | undefined;
}

export interface ReportParagraph {
  id: string;
  text: string;
  headingId?: string | undefined;
  sourceRange?:
    | {
        startMs: number;
        endMs: number;
      }
    | undefined;
}

export interface ReportHeading {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  parentId?: string | undefined;
}

export interface ReportSection {
  id: string;
  heading: string;
  paragraphs: ReportParagraph[];
}

export interface Report {
  title: string;
  subtitle: string;
  captionKind?: CaptionKind | undefined;
  headings?: ReportHeading[] | undefined;
  sections: ReportSection[];
}

export type ReportContextId = string;
export type ChapterId = string;

export interface ChapterFiveWOneHSummary {
  who: string;
  what: string;
  when: string;
  where: string;
  why: string;
  how: string;
}

export interface ChapterFiveWOneHRequest {
  reportContextId: ReportContextId;
  chapterId: ChapterId;
}

export interface ChapterFiveWOneHResponse {
  reportContextId: ReportContextId;
  chapterId: ChapterId;
  summary: ChapterFiveWOneHSummary;
}

export interface ChapterSummaryContext {
  reportContextId: ReportContextId;
  chapterId: ChapterId;
  chapterTitle: string;
  transcript: Transcript;
  generationRequirements?: string | undefined;
  reportTitle?: string | undefined;
  reportSubtitle?: string | undefined;
  headings: ReportHeading[];
  paragraphs: ReportParagraph[];
}

export interface ReportGenerationRequest {
  url: string;
  generationRequirements?: string | undefined;
}

export interface ReportGenerationOptions {
  generationRequirements?: string | undefined;
}

export interface GeminiPreflightResponse {
  ok: true;
  message: string;
}

export interface TranscriptFetchRequest {
  url: string;
}

export interface TranscriptFetchResponse {
  transcriptToken: string;
  expiresAt: string;
  captionKind?: CaptionKind | undefined;
  language?: string | undefined;
}

export interface ReportStreamRequest {
  transcriptToken: string;
  generationRequirements?: string | undefined;
}

export interface JsonErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
  };
}

export type StreamEvent =
  | { type: "state"; state: GenerationState; message: string }
  | { type: "report_context"; reportContextId: ReportContextId }
  | { type: "caption"; captionKind: CaptionKind; language?: string | undefined }
  | { type: "title"; title: string; subtitle: string }
  | { type: "heading"; heading: ReportHeading }
  | { type: "section"; section: Omit<ReportSection, "paragraphs"> }
  | { type: "summary_paragraph"; sectionId: string; paragraph: ReportParagraph }
  | { type: "complete"; report: Report }
  | { type: "error"; code: AppErrorCode; message: string };

export type GeminiPreflightEvent =
  | { type: "preflight_state"; state: "checking"; message: string }
  | { type: "preflight_complete"; message: string }
  | { type: "error"; code: AppErrorCode; message: string };

export type AppErrorCode =
  | "invalid_youtube_url"
  | "transcript_unavailable"
  | "transcript_parse_error"
  | "transcript_too_large"
  | "transcript_config_error"
  | "transcript_provider_error"
  | "transcript_token_error"
  | "gemini_config_error"
  | "gemini_rate_limited"
  | "gemini_service_error"
  | "generation_validation_error"
  | "report_context_unavailable"
  | "request_canceled";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}
