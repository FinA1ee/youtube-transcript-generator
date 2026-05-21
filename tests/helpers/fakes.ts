import { GeminiClient } from "../../src/llm/gemini";
import {
  ChapterFiveWOneHSummary,
  ChapterSummaryContext,
  Report,
  ReportGenerationOptions,
  StreamEvent,
  Transcript
} from "../../src/shared/types";
import { TranscriptClient, TranscriptFetchOptions } from "../../src/transcripts/client";
import { YoutubeClient } from "../../src/youtube/client";
import { CaptionTrack, VideoMetadata } from "../../src/shared/types";

export class FakeYoutubeClient implements YoutubeClient {
  public metadataCalls = 0;
  public captionCalls = 0;

  constructor(
    private readonly metadata: VideoMetadata,
    private readonly captionPayload: string
  ) {}

  getVideoMetadata(): Promise<VideoMetadata> {
    this.metadataCalls += 1;
    return Promise.resolve(this.metadata);
  }

  fetchCaptionTrack(_track: CaptionTrack): Promise<string> {
    void _track;
    this.captionCalls += 1;
    return Promise.resolve(this.captionPayload);
  }
}

export class FakeGeminiClient implements GeminiClient {
  public calls = 0;
  public preflightCalls = 0;
  public chapterFiveWOneHCalls = 0;
  public lastOptions: ReportGenerationOptions | undefined;
  public lastChapterContext: ChapterSummaryContext | undefined;

  constructor(
    private readonly report: Report,
    private readonly chapterFiveWOneHSummary: ChapterFiveWOneHSummary = {
      who: "Jack",
      what: "总结产品讨论的目标。",
      when: "视频开场。",
      where: "未提及",
      why: "帮助听众理解产品方向。",
      how: "通过说明背景和执行细节。"
    }
  ) {}

  preflight(): Promise<void> {
    this.preflightCalls += 1;
    return Promise.resolve();
  }

  generateReport(_transcript: Transcript, options: ReportGenerationOptions = {}): Promise<Report> {
    void _transcript;
    this.calls += 1;
    this.lastOptions = options;
    return Promise.resolve(this.report);
  }

  async *generateReportStream(
    _transcript: Transcript,
    options: ReportGenerationOptions = {}
  ): AsyncGenerator<StreamEvent> {
    void _transcript;
    await Promise.resolve();
    this.calls += 1;
    this.lastOptions = options;
    yield { type: "title", title: this.report.title, subtitle: this.report.subtitle };
    for (const heading of this.report.headings ?? []) {
      yield { type: "heading", heading };
    }
    for (const section of this.report.sections) {
      yield { type: "section", section: { id: section.id, heading: section.heading } };
      for (const paragraph of section.paragraphs) {
        yield { type: "summary_paragraph", sectionId: section.id, paragraph };
      }
    }
  }

  generateChapterFiveWOneH(context: ChapterSummaryContext): Promise<ChapterFiveWOneHSummary> {
    this.chapterFiveWOneHCalls += 1;
    this.lastChapterContext = context;
    return Promise.resolve(this.chapterFiveWOneHSummary);
  }
}

export class FakeTranscriptClient implements TranscriptClient {
  public calls = 0;
  public lastUrl: string | undefined;
  public lastOptions: TranscriptFetchOptions | undefined;

  constructor(private readonly transcript: Transcript | Error) {}

  fetchTranscript(videoUrl: string, options: TranscriptFetchOptions = {}): Promise<Transcript> {
    this.calls += 1;
    this.lastUrl = videoUrl;
    this.lastOptions = options;
    if (this.transcript instanceof Error) {
      return Promise.reject(this.transcript);
    }
    return Promise.resolve(this.transcript);
  }
}

export async function readSseEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) {
        return null;
      }
      return JSON.parse(dataLine.slice(6)) as unknown;
    })
    .filter((event): event is unknown => event !== null);
}
