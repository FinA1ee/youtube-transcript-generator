import {
  AppError,
  Report,
  ReportGenerationRequest,
  StreamEvent,
  Transcript
} from "../shared/types";
import { GeminiClient } from "../llm/gemini";
import { TranscriptClient } from "../transcripts/client";
import { normalizeYoutubeUrl } from "../youtube/url";

export interface ReportPipelineDependencies {
  transcriptClient: TranscriptClient;
  geminiClient: GeminiClient;
  maxDurationMinutes?: number | undefined;
  maxSegments?: number | undefined;
  maxTranscriptCharacters?: number | undefined;
}

export async function* reportPipeline(
  request: ReportGenerationRequest,
  deps: ReportPipelineDependencies,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  try {
    yield { type: "state", state: "loading", message: "Loading report..." };
    const { canonicalUrl } = normalizeYoutubeUrl(request.url);
    yield { type: "state", state: "loading", message: "Fetching transcript..." };
    const transcriptOptions: {
      maxDurationMinutes?: number;
      maxSegments?: number;
      maxCharacters?: number;
    } = {};
    if (deps.maxDurationMinutes !== undefined) {
      transcriptOptions.maxDurationMinutes = deps.maxDurationMinutes;
    }
    if (deps.maxSegments !== undefined) {
      transcriptOptions.maxSegments = deps.maxSegments;
    }
    if (deps.maxTranscriptCharacters !== undefined) {
      transcriptOptions.maxCharacters = deps.maxTranscriptCharacters;
    }
    const transcript = await deps.transcriptClient.fetchTranscript(
      canonicalUrl,
      transcriptOptions,
      signal
    );
    if (transcript.captionKind) {
      yield { type: "caption", captionKind: transcript.captionKind, language: transcript.language };
    }
    yield* streamReportFromTranscript(transcript, deps.geminiClient, signal);
  } catch (error) {
    if (signal?.aborted) {
      yield { type: "error", code: "request_canceled", message: "Generation canceled." };
      return;
    }

    if (error instanceof AppError) {
      yield { type: "error", code: error.code, message: error.message };
      return;
    }

    yield { type: "error", code: "gemini_service_error", message: "Unexpected generation error." };
  }
}

export async function* streamReportFromTranscript(
  transcript: Transcript,
  geminiClient: GeminiClient,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  try {
    yield { type: "state", state: "streaming_report", message: "Generating report..." };
    const report = createEmptyReport(transcript);
    for await (const event of geminiClient.generateReportStream(transcript, signal)) {
      applyReportEvent(report, event);
      yield event;
    }
    yield { type: "complete", report };
  } catch (error) {
    if (signal?.aborted) {
      yield { type: "error", code: "request_canceled", message: "Generation canceled." };
      return;
    }
    if (error instanceof AppError) {
      yield { type: "error", code: error.code, message: error.message };
      return;
    }
    yield { type: "error", code: "gemini_service_error", message: "Unexpected generation error." };
  }
}

function createEmptyReport(transcript: Transcript): Report {
  return {
    title: "",
    subtitle: "",
    captionKind: transcript.captionKind,
    sections: []
  };
}

function applyReportEvent(report: Report, event: StreamEvent): void {
  if (event.type === "title") {
    report.title = event.title;
    report.subtitle = event.subtitle;
    return;
  }
  if (event.type === "section") {
    if (!report.sections.some((section) => section.id === event.section.id)) {
      report.sections.push({ ...event.section, paragraphs: [] });
    }
    return;
  }
  if (event.type === "summary_paragraph") {
    const section = report.sections.find((item) => item.id === event.sectionId);
    if (section) {
      section.paragraphs.push(event.paragraph);
    }
  }
}

export function* emitReport(report: Report): Generator<StreamEvent> {
  yield { type: "title", title: report.title, subtitle: report.subtitle };
  for (const section of report.sections) {
    yield { type: "section", section: { id: section.id, heading: section.heading } };
    for (const paragraph of section.paragraphs) {
      yield { type: "summary_paragraph", sectionId: section.id, paragraph };
    }
  }
}

export async function collectPipelineEvents(
  request: ReportGenerationRequest,
  deps: ReportPipelineDependencies,
  signal?: AbortSignal
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of reportPipeline(request, deps, signal)) {
    events.push(event);
  }
  return events;
}

export function estimateTranscriptCharacters(transcript: Transcript): number {
  return transcript.segments.reduce((total, segment) => total + segment.text.length, 0);
}
