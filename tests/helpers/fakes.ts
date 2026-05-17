import { GeminiClient } from "../../src/llm/gemini";
import { Report, StreamEvent, Transcript } from "../../src/shared/types";
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

  constructor(private readonly report: Report) {}

  preflight(): Promise<void> {
    this.preflightCalls += 1;
    return Promise.resolve();
  }

  generateReport(_transcript: Transcript): Promise<Report> {
    void _transcript;
    this.calls += 1;
    return Promise.resolve(this.report);
  }

  async *generateReportStream(_transcript: Transcript): AsyncGenerator<StreamEvent> {
    void _transcript;
    await Promise.resolve();
    this.calls += 1;
    yield { type: "title", title: this.report.title, subtitle: this.report.subtitle };
    for (const section of this.report.sections) {
      yield { type: "section", section: { id: section.id, heading: section.heading } };
      for (const paragraph of section.paragraphs) {
        yield { type: "summary_paragraph", sectionId: section.id, paragraph };
      }
    }
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
