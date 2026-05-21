## Context

The current implementation keeps Hono as the Cloudflare Worker framework, uses TranscriptAPI for transcript acquisition, and streams Gemini report chunks to the browser. The remaining issue is request ownership: Gemini preflight and transcript fetching are currently modeled as stream-oriented flows, but they are better handled as standalone server requests that finish before report rendering begins.

This change narrows streaming to the one place where it provides clear user value: rendering Gemini-generated report chunks progressively.

## Goals / Non-Goals

**Goals:**
- Run Gemini preflight through a standalone JSON request.
- Run YouTube transcript fetch through a standalone JSON request.
- Start report streaming only after transcript fetch succeeds.
- Keep the report stream focused on Gemini NDJSON chunk generation and browser rendering.
- Keep TranscriptAPI and Gemini credentials server-side only.
- Preserve English UI status text and Simplified Chinese report output.

**Non-Goals:**
- Do not introduce durable resumable jobs.
- Do not persist raw transcripts in a database or KV store.
- Do not add report download/export.
- Do not stream preflight or transcript-fetch progress.
- Do not expose raw TranscriptAPI provider payloads or credentials to the browser.

## Decisions

### Use JSON endpoints for preflight and transcript fetch

Add these standalone endpoints:

- `POST /api/gemini/preflight`
- `POST /api/transcripts/fetch`

`POST /api/gemini/preflight` runs the existing tiny Gemini setup-check prompt and returns:

```json
{ "ok": true, "message": "Gemini setup check succeeded." }
```

or a sanitized JSON error response.

`POST /api/transcripts/fetch` accepts:

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

It validates the YouTube URL, calls TranscriptAPI on the server, normalizes and checks transcript limits, and returns a transcript handoff object for report generation.

### Use a stateless signed transcript token for the handoff

Because durable jobs and server-side transcript persistence are deferred, the transcript request should return a short-lived signed transcript token rather than storing transcript state server-side. The token contains the normalized transcript payload, expiry timestamp, and a version field. It is signed with a server-side `TRANSCRIPT_TOKEN_SECRET`.

The browser treats this token as opaque. It must not render the raw transcript. The report stream sends the token back to the server, where the backend verifies signature and expiry before calling Gemini.

Rationale:
- Avoids relying on in-memory Worker state, which is not reliable across isolates.
- Avoids adding KV/Durable Objects for this change.
- Avoids putting raw transcript JSON in report-stream query strings.
- Keeps the API sequence clear: fetch transcript, then stream report.

Concern: the token can be large for long transcripts. If size becomes an issue, the next step should be a server-side short-lived store such as Durable Objects or KV, but that is out of scope for this change.

### Use POST streaming for report rendering

Replace or supplement `GET /api/reports/stream?url=...` with:

`POST /api/reports/stream`

Request body:

```json
{ "transcriptToken": "..." }
```

Response content type remains `text/event-stream`. The browser should use `fetch()` and read the response stream instead of `EventSource`, because EventSource only supports GET and cannot send a JSON body.

This keeps SSE semantics while allowing a request body. The browser stream parser can continue handling SSE `data:` frames and typewriter rendering.

### Keep the stream free of transcript fetch and preflight work

The report stream should:
- verify the transcript token
- emit a report-generation state
- call Gemini with the transcript
- parse NDJSON chunks
- emit title, section, paragraph, completion, and sanitized generation errors

It should not:
- run Gemini preflight
- call TranscriptAPI
- validate the original YouTube URL
- emit transcript-fetch progress

## Risks / Trade-offs

- [Risk] Signed transcript tokens may be large for long videos. -> Mitigation: enforce transcript size limits and leave server-side short-lived storage as the next option if token size is too high.
- [Risk] Returning an opaque transcript token still moves transcript-derived data through the browser. -> Mitigation: sign it, expire it quickly, do not render or log it, and do not include provider secrets.
- [Risk] `fetch()` streaming SSE requires custom browser parsing instead of EventSource. -> Mitigation: keep the SSE wire format and implement a small parser around response body chunks.
- [Risk] Users can start report generation without preflight. -> Mitigation: preflight remains optional; report generation still maps Gemini failures to sanitized errors.
- [Risk] Token signing secret misconfiguration can block generation. -> Mitigation: return a clear sanitized configuration error before Gemini is called.

## Migration Plan

1. Add JSON `POST /api/gemini/preflight`.
2. Add JSON `POST /api/transcripts/fetch`.
3. Add transcript token sign/verify helpers using Web Crypto and `TRANSCRIPT_TOKEN_SECRET`.
4. Change report streaming to accept `transcriptToken` via POST body and verify it before Gemini generation.
5. Update browser flow: optional preflight request, transcript fetch request on submit, then report stream request.
6. Remove preflight SSE endpoint usage from the frontend.
7. Remove TranscriptAPI calls from the report stream path.
8. Add tests for JSON preflight, transcript fetch, token verification, POST stream rendering, expired/invalid token errors, and no TranscriptAPI call during report stream.

## Open Questions

- What should the transcript token TTL be? Proposed default: 10 minutes.
- Should the old GET report stream endpoint remain temporarily for compatibility, or be removed immediately?
- Should preflight run automatically before transcript fetch, or remain user-triggered only?
