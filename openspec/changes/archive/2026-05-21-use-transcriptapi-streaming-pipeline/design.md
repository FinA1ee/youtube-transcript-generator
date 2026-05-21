## Context

The application remains a TypeScript Cloudflare Worker using Hono. The frontend is Hono/Worker-served HTML/CSS/JavaScript with SSE consumers for report generation and Gemini preflight diagnostics.

Transcript fetching should no longer use the `youtube-transcript` npm package because Cloudflare runtime compatibility and unofficial YouTube access are likely risks. TranscriptAPI.com exposes a REST API with `GET https://transcriptapi.com/api/v2/youtube/transcript?video_url=...` and Bearer-token authentication. Its documented response includes `video_id`, `language`, and a `transcript` array of entries with `text`, `start`, and `duration`. This shape maps cleanly into the app's typed transcript segment model.

TranscriptAPI credits and service failures introduce provider dependency risk, but that risk is easier to isolate than package/runtime incompatibility. The key must stay server-side in Worker secrets.

Sources checked:
- TranscriptAPI API reference: https://transcriptapi.com/docs/api/
- TranscriptAPI docs index: https://transcriptapi.com/docs

## Goals / Non-Goals

**Goals:**
- Keep Hono as the app framework and Cloudflare Worker entrypoint.
- Fetch YouTube transcripts through TranscriptAPI.com from the backend.
- Keep TranscriptAPI and Gemini API keys out of browser code, URLs, SSE payloads, and rendered errors.
- Call Gemini only after transcript content is fetched and normalized.
- Stream Gemini-derived report chunks to the browser while generation continues.
- Choose a chunk format that lets backend streaming and frontend rendering run concurrently.
- Keep English UI text and Simplified Chinese report content.

**Non-Goals:**
- Do not use `youtube-transcript`.
- Do not use YouTube OAuth.
- Do not implement custom caption scraping.
- Do not add audio transcription or no-caption fallback.
- Do not migrate to Next.js.
- Do not require strict final validation before displaying useful partial output.
- Do not add durable resumable jobs or report downloads.

## Decisions

### Use TranscriptAPI.com behind a transcript service adapter

Add a `transcriptApiClient` adapter that calls:

`GET https://transcriptapi.com/api/v2/youtube/transcript?video_url=<encoded-url>`

with:

`Authorization: Bearer <TRANSCRIPTAPI_KEY>`

The adapter maps successful responses into the app's typed transcript segments and maps provider failures into sanitized transcript errors. The adapter should understand at least these classes:
- missing local `TRANSCRIPTAPI_KEY`
- unavailable transcript or no captions
- quota/payment/credit failure, including HTTP 402
- rate-limit/retryable failures, including HTTP 408, 429, and 503
- malformed provider response
- generic provider/network failure

Do not expose TranscriptAPI response types outside the adapter.

### Keep transcript fetching backend-only

TranscriptAPI calls happen only in the Worker backend. The browser should see high-level states such as "Fetching transcript..." but not raw TranscriptAPI payloads, API keys, stack traces, or unprocessed transcript dumps.

### Use NDJSON-style Gemini chunks for concurrent streaming and rendering

The most practical chunk format is newline-delimited JSON objects emitted by Gemini, one logical report event per line. The prompt should require Gemini to output only JSON lines matching this event shape:

```json
{"type":"title","title":"...","subtitle":"..."}
{"type":"section","id":"s1","heading":"..."}
{"type":"paragraph","sectionId":"s1","speaker":"旁白","text":"..."}
{"type":"paragraph","sectionId":"s1","speaker":"Jack","text":"..."}
{"type":"section","id":"s2","heading":"..."}
{"type":"paragraph","sectionId":"s2","speaker":"旁白","text":"..."}
```

Rationale:
- NDJSON can be parsed incrementally from a text stream by buffering until newline boundaries.
- Each complete line can be validated lightly and forwarded as an SSE event immediately.
- The frontend can start rendering the title, sections, and paragraphs before Gemini completes the whole report.
- It avoids waiting for a single complete JSON object, which is awkward for streaming.

Backend behavior:
- Buffer partial Gemini text until a newline is available.
- Parse each complete line as JSON.
- Accept only known event shapes.
- Convert accepted JSON lines into existing typed SSE report events.
- Keep incomplete trailing text buffered until more content arrives.
- On malformed lines, skip or report a sanitized generation error depending on severity; do not expose raw provider internals.

Prompt constraints:
- Instruction text remains English.
- Every title, subtitle, heading, speaker, and paragraph value must be Simplified Chinese except proper names.
- Paragraph text must summarize transcript content rather than reproduce raw transcript lines.
- Gemini must output NDJSON only, with no Markdown fences or prose outside JSON lines.

### Keep validation lightweight

The system should validate event type, required fields, string sizes, and section references enough to keep rendering stable. It should not delay display until the whole response passes strict Simplified Chinese or verbatim-transcript validation. The user experience goal is partial display while generation continues.

## Risks / Trade-offs

- [Risk] TranscriptAPI is an external paid/credit-based dependency. -> Mitigation: surface sanitized quota/payment/rate-limit errors and keep provider code isolated.
- [Risk] TranscriptAPI may not return manual vs auto-generated caption kind. -> Mitigation: only display caption kind when known; otherwise omit or show neutral state.
- [Risk] NDJSON streaming depends on Gemini following output instructions. -> Mitigation: keep line-level parsing tolerant, add tests for malformed lines, and use explicit examples in the prompt.
- [Risk] Gemini may split JSON lines across provider chunks. -> Mitigation: buffer until newline before parsing.
- [Risk] Gemini may output prose or Markdown fences. -> Mitigation: discard non-JSON preamble/fence lines until valid events appear, and emit a sanitized generation error if no usable events are produced.
- [Risk] Non-durable SSE reconnects cannot resume a lost generation. -> Mitigation: keep existing retry UX and leave durable resumable jobs deferred.

## Migration Plan

1. Add TranscriptAPI configuration (`TRANSCRIPTAPI_KEY`) to env examples and docs.
2. Implement a TranscriptAPI adapter using `fetch` and Worker-compatible Web APIs.
3. Replace the planned `youtube-transcript` adapter tasks with TranscriptAPI adapter tasks.
4. Normalize TranscriptAPI transcript entries into typed transcript segments.
5. Update Gemini prompt construction to request NDJSON report events.
6. Implement incremental NDJSON parsing from Gemini stream chunks and conversion to typed SSE events.
7. Keep Hono endpoints and the existing browser typewriter renderer.
8. Add tests for TranscriptAPI success/errors, secret handling, NDJSON chunk parsing, SSE partial rendering, and no-Gemini-before-transcript behavior.

## Open Questions

- Which TranscriptAPI plan/key will be used for local development and deployment?
- Does TranscriptAPI return enough metadata for manual vs auto-generated caption labeling, or should the app treat caption kind as unknown for this provider?
- Should TranscriptAPI `send_metadata` be enabled if available, to support duration/title checks, or should the first implementation use only the transcript endpoint's basic response?
- What practical Gemini token budget should be applied for 80-100 minute transcripts after TranscriptAPI normalization?
