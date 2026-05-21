## 1. API Contracts

- [x] 1.1 Add request/response types for JSON Gemini preflight, transcript fetch, transcript handoff, and POST report stream startup.
- [x] 1.2 Add sanitized JSON error helpers shared by standalone endpoints.
- [x] 1.3 Document `TRANSCRIPT_TOKEN_SECRET` in `.env.example`, README, and Worker secret setup.

## 2. Transcript Handoff

- [x] 2.1 Implement transcript token signing with Web Crypto and short expiry.
- [x] 2.2 Implement transcript token verification and expiry rejection.
- [x] 2.3 Ensure token payload contains normalized transcript data, version, and expiry only.
- [x] 2.4 Add tests for valid, expired, malformed, and tampered transcript tokens.

## 3. Standalone Requests

- [x] 3.1 Add `POST /api/gemini/preflight` returning JSON success or sanitized JSON error.
- [x] 3.2 Add `POST /api/transcripts/fetch` accepting a YouTube URL and returning transcript handoff JSON.
- [x] 3.3 Ensure transcript fetch validates URL, calls TranscriptAPI, enforces transcript limits, and never calls Gemini.
- [x] 3.4 Ensure standalone request responses do not expose API keys, raw provider errors, or raw provider payloads.

## 4. Report Streaming

- [x] 4.1 Add or convert report stream endpoint to accept a transcript handoff in a POST request body.
- [x] 4.2 Ensure report stream verifies transcript handoff before calling Gemini.
- [x] 4.3 Ensure report stream does not call TranscriptAPI, run Gemini preflight, or validate the original YouTube URL.
- [x] 4.4 Preserve NDJSON Gemini chunk parsing and typed report event streaming.
- [x] 4.5 Preserve cancel, retry, retry-failed partial-content retention, and typewriter rendering behavior.

## 5. Browser Flow

- [x] 5.1 Update Gemini test button to call standalone JSON preflight instead of opening a preflight SSE stream.
- [x] 5.2 Update submit flow to call standalone transcript fetch before starting report stream.
- [x] 5.3 Update report stream startup to use fetch-based POST streaming and parse SSE frames from the response body.
- [x] 5.4 Display English status for preflight, transcript fetching, stream generation, errors, cancellation, and completion.

## 6. Tests and Verification

- [x] 6.1 Add unit tests for standalone request handlers and transcript handoff helpers.
- [x] 6.2 Add e2e tests for JSON preflight success/failure and transcript fetch success/failure.
- [x] 6.3 Add e2e tests proving report stream starts from a transcript handoff and does not call TranscriptAPI.
- [x] 6.4 Add browser script tests or asset assertions for fetch-based POST stream parsing.
- [x] 6.5 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and Wrangler dry-run.
