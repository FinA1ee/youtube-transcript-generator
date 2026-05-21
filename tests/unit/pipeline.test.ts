import { describe, expect, it } from "vitest";
import { collectPipelineEvents } from "../../src/reports/pipeline";
import { AppError } from "../../src/shared/types";
import { hierarchicalReport, report, transcript } from "../fixtures/captions";
import { FakeGeminiClient, FakeTranscriptClient } from "../helpers/fakes";

describe("reportPipeline", () => {
  it("emits ordered state, caption, streamed report, and completion events", async () => {
    const geminiClient = new FakeGeminiClient(report);
    const transcriptClient = new FakeTranscriptClient(transcript);
    const events = await collectPipelineEvents(
      { url: "https://www.youtube.com/watch?v=abc123XYZ" },
      {
        transcriptClient,
        geminiClient
      }
    );

    expect(geminiClient.preflightCalls).toBe(0);
    expect(events.map((event) => event.type)).toEqual([
      "state",
      "state",
      "caption",
      "state",
      "title",
      "section",
      "summary_paragraph",
      "complete"
    ]);
  });

  it("does not call dependencies for invalid URLs", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const events = await collectPipelineEvents(
      { url: "https://example.com/video" },
      {
        transcriptClient,
        geminiClient: new FakeGeminiClient(report)
      }
    );

    expect(events.at(-1)).toMatchObject({ type: "error", code: "invalid_youtube_url" });
    expect(transcriptClient.calls).toBe(0);
  });

  it("fetches transcript before calling Gemini report generation", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(report);

    const events = await collectPipelineEvents(
      { url: "https://www.youtube.com/watch?v=abc123XYZ" },
      {
        transcriptClient,
        geminiClient
      }
    );

    expect(events).toContainEqual(expect.objectContaining({ type: "caption" }));
    expect(geminiClient.preflightCalls).toBe(0);
    expect(geminiClient.calls).toBe(1);
    expect(transcriptClient.calls).toBe(1);
    expect(transcriptClient.lastUrl).toBe("https://www.youtube.com/watch?v=abc123XYZ");
  });

  it("passes generation requirements to Gemini without changing transcript fetch", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(report);

    await collectPipelineEvents(
      {
        url: "https://www.youtube.com/watch?v=abc123XYZ",
        generationRequirements: "Create a concise executive brief."
      },
      {
        transcriptClient,
        geminiClient
      }
    );

    expect(transcriptClient.calls).toBe(1);
    expect(transcriptClient.lastUrl).toBe("https://www.youtube.com/watch?v=abc123XYZ");
    expect(transcriptClient.lastOptions).toEqual({});
    expect(geminiClient.lastOptions).toEqual({
      generationRequirements: "Create a concise executive brief."
    });
  });

  it("emits hierarchical heading events before linked paragraphs", async () => {
    const events = await collectPipelineEvents(
      { url: "https://www.youtube.com/watch?v=abc123XYZ" },
      {
        transcriptClient: new FakeTranscriptClient(transcript),
        geminiClient: new FakeGeminiClient(hierarchicalReport)
      }
    );
    const headingEvent = events.find(
      (event) => event.type === "heading" && event.heading.id === "h2-context"
    );
    const paragraphEvent = events.find((event) => event.type === "summary_paragraph");

    expect(headingEvent).toEqual({
      type: "heading",
      heading: { id: "h2-context", level: 2, parentId: "h1-intro", text: "讨论背景" }
    });
    expect(paragraphEvent).toMatchObject({
      type: "summary_paragraph",
      sectionId: "h3-detail",
      paragraph: { headingId: "h3-detail" }
    });
  });

  it("does not call Gemini when transcript fetching fails", async () => {
    const transcriptClient = new FakeTranscriptClient(
      new AppError("transcript_provider_error", "Transcript service failed.", 502)
    );
    const geminiClient = new FakeGeminiClient(report);

    const events = await collectPipelineEvents(
      { url: "https://www.youtube.com/watch?v=abc123XYZ" },
      {
        transcriptClient,
        geminiClient
      }
    );

    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "transcript_provider_error"
    });
    expect(geminiClient.calls).toBe(0);
  });
});
