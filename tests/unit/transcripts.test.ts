import { describe, expect, it } from "vitest";
import { fetchTranscript, parseCaptionPayload } from "../../src/transcripts/parser";
import { selectCaptionTrack } from "../../src/youtube/client";
import { AppError, VideoMetadata } from "../../src/shared/types";
import { autoTrack, captionXml, manualTrack } from "../fixtures/captions";
import { FakeYoutubeClient } from "../helpers/fakes";

describe("transcript acquisition", () => {
  it("selects default-language manual captions before auto-generated captions", () => {
    const metadata: VideoMetadata = {
      videoId: "abc123XYZ",
      defaultLanguage: "en",
      captionTracks: [autoTrack, manualTrack]
    };

    expect(selectCaptionTrack(metadata)).toEqual(manualTrack);
  });

  it("selects auto-generated captions when no manual track is available", () => {
    const metadata: VideoMetadata = {
      videoId: "abc123XYZ",
      defaultLanguage: "en",
      captionTracks: [autoTrack]
    };

    expect(selectCaptionTrack(metadata)).toEqual(autoTrack);
  });

  it("parses captions into typed ordered transcript segments", () => {
    const transcript = parseCaptionPayload("abc123XYZ", captionXml, manualTrack, 320);

    expect(transcript.captionKind).toBe("manual");
    expect(transcript.segments).toHaveLength(2);
    expect(transcript.segments[0]).toMatchObject({
      startMs: 0,
      endMs: 2500,
      language: "en",
      captionKind: "manual"
    });
  });

  it("rejects invalid caption payloads", () => {
    expect(() => parseCaptionPayload("abc123XYZ", "<invalid></invalid>", manualTrack)).toThrow(
      AppError
    );
  });

  it("rejects videos longer than 100 minutes before fetching captions", async () => {
    const metadata: VideoMetadata = {
      videoId: "abc123XYZ",
      durationSeconds: 100 * 60 + 1,
      defaultLanguage: "en",
      captionTracks: [manualTrack]
    };
    const client = new FakeYoutubeClient(metadata, captionXml);

    await expect(fetchTranscript("abc123XYZ", client)).rejects.toThrow(AppError);
    expect(client.captionCalls).toBe(0);
  });
});
