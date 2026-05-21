## 1. TranscriptAPI Configuration

- [x] 1.1 Add `TRANSCRIPTAPI_KEY` to `.env.example`, README/setup docs, and Worker secret documentation.
- [x] 1.2 Ensure TranscriptAPI credentials are read only from server-side environment bindings.
- [x] 1.3 Remove `youtube-transcript` dependency work from this change.

## 2. TranscriptAPI Adapter

- [x] 2.1 Create a local transcript client interface that hides TranscriptAPI response shapes.
- [x] 2.2 Implement a TranscriptAPI client using `fetch`, `GET /api/v2/youtube/transcript`, `video_url`, and Bearer-token authentication.
- [x] 2.3 Map TranscriptAPI transcript entries into typed transcript segments with normalized text, start time, duration, language when known, unknown speaker fallback, and caption kind only when known.
- [x] 2.4 Map missing key, no transcript, malformed response, payment/quota, rate-limit, timeout, service, and network failures into sanitized typed errors.
- [x] 2.5 Enforce transcript size, segment count, token-budget, and known duration limits before Gemini is called.

## 3. NDJSON Gemini Streaming

- [x] 3.1 Update the Gemini prompt builder to request NDJSON-only report events for title, section, and paragraph chunks.
- [x] 3.2 Implement an incremental NDJSON parser that buffers partial Gemini chunks until newline boundaries.
- [x] 3.3 Map valid title, section, and paragraph JSON lines into existing typed report stream events immediately.
- [x] 3.4 Handle malformed, prose, Markdown fence, and unknown event lines with lightweight validation and sanitized errors.
- [x] 3.5 Ensure partial report chunks can be emitted before Gemini generation completes.

## 4. Hono SSE and Browser Rendering

- [x] 4.1 Keep report generation and Gemini preflight as separate Hono SSE endpoints.
- [x] 4.2 Emit high-level TranscriptAPI fetch progress over report SSE without streaming raw transcript lines to the browser.
- [x] 4.3 Render title, section, and paragraph events immediately with the existing typewriter behavior.
- [x] 4.4 Preserve cancel, skip animation, retry with backoff, retry-failed partial-content retention, and re-enter URL behavior.
- [x] 4.5 Display manual/auto-generated caption labels only when TranscriptAPI metadata can determine caption kind.

## 5. Tests and Verification

- [x] 5.1 Add unit tests for TranscriptAPI request construction, success mapping, missing key, no transcript, quota/payment, rate-limit, timeout, malformed response, and network failure cases.
- [x] 5.2 Add pipeline tests proving Gemini is not called when TranscriptAPI fetching or transcript limits fail.
- [x] 5.3 Add NDJSON parser tests for complete lines, split lines, multiple lines per chunk, malformed lines, Markdown fences, and unknown event types.
- [x] 5.4 Add e2e tests for successful partial display, transcript provider errors, Gemini preflight separation, cancel, and retry-failed UI behavior.
- [x] 5.5 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and a local Wrangler compatibility check.
