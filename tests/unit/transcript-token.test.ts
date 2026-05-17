import { describe, expect, it } from "vitest";
import { signTranscriptToken, verifyTranscriptToken } from "../../src/transcripts/token";
import { transcript } from "../fixtures/captions";

describe("transcript token", () => {
  it("signs and verifies transcript handoff tokens", async () => {
    const token = await signTranscriptToken(transcript, "secret", {
      now: 1000,
      ttlSeconds: 60
    });

    await expect(verifyTranscriptToken(token, "secret", 2000)).resolves.toEqual(transcript);
  });

  it("rejects expired tokens", async () => {
    const token = await signTranscriptToken(transcript, "secret", {
      now: 1000,
      ttlSeconds: 1
    });

    await expect(verifyTranscriptToken(token, "secret", 3000)).rejects.toMatchObject({
      code: "transcript_token_error"
    });
  });

  it("rejects tampered tokens", async () => {
    const token = await signTranscriptToken(transcript, "secret");
    const tampered = token.replace("a", "b");

    await expect(verifyTranscriptToken(tampered, "secret")).rejects.toMatchObject({
      code: "transcript_token_error"
    });
  });

  it("rejects malformed tokens", async () => {
    await expect(verifyTranscriptToken("not-a-token", "secret")).rejects.toMatchObject({
      code: "transcript_token_error"
    });
  });

  it("requires a configured secret", async () => {
    await expect(signTranscriptToken(transcript, undefined)).rejects.toMatchObject({
      code: "transcript_config_error"
    });
  });
});
