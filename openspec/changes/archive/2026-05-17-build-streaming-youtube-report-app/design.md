## Context

The repository is an early Node.js/Cloudflare deployment project with OpenSpec configuration and contributor guidance, but no application code or package tooling yet. The first product slice must define the TypeScript backend architecture, browser flow, external service boundaries, deployment adapter, and report model before implementation begins.

The target workflow is:

1. A user opens the web page and submits a YouTube video URL.
2. The browser opens an SSE stream request to the backend with the YouTube URL.
3. The backend validates and normalizes the URL, fetches available subtitle/caption data, builds transcript segments, and calls Gemini AI Studio's free API path.
4. The backend streams progress, partial report chunks, errors, retry hints, and completion events back over SSE.
5. The browser progressively renders a structured Simplified Chinese HTML report containing a title, subtitle, sections, and speaker-labeled summarized paragraphs derived from the transcript.

The implementation must keep API keys and user-submitted transcript content out of source control. It must also treat YouTube captions and Gemini free-tier quota as unreliable external dependencies.

## Goals / Non-Goals

**Goals:**

- Build a full-stack TypeScript application using an edge-compatible Node.js framework and deploy it on Cloudflare.
- Support one-user-at-a-time Simplified Chinese summary report generation over SSE with progressive rendering.
- Use Gemini 3 Flash Preview as the initial default model through the official `gemini-3-flash-preview` model code.
- Run a lightweight Gemini setup preflight when a report SSE stream starts, before sending transcript content to Gemini, and notify the user if Gemini calling or configuration is not working.
- Support manually authored and auto-generated YouTube captions when caption tracks are exposed.
- Mark whether the selected caption track is manually authored or auto-generated in the English UI.
- Reject videos longer than 100 minutes before Gemini generation.
- Render streamed Simplified Chinese report content with a typewriter-style effect as SSE data arrives, without waiting for the full report.
- Show a simple English loading state after submit until streamed report content starts rendering, then use concise completion, cancellation, retry, and error notifications.
- Notify users when a video has no usable subtitles and return the page to an idle input state without attempting a fallback transcript source.
- Handle SSE disconnected, reconnecting, retrying, and failed-retry states in the browser.
- Keep all UI chrome, controls, and state notifications in English; only generated report content is Simplified Chinese.
- Keep modules separated by responsibility: backend routes, Cloudflare deployment adapter, YouTube URL handling, transcript acquisition, Gemini client, report generation, streaming events, and browser rendering.
- Define a stable internal report schema that can be tested without real Gemini calls.
- Provide clear error states for unsupported URLs, videos without usable subtitles, YouTube fetch failures, Gemini quota/rate-limit failures, and malformed model output.
- Add package scripts, environment examples, and tests before production code.
- Enforce strict TypeScript, lint, commit, and CI/CD rules before deployment.

**Non-Goals:**

- Generating subtitles for videos that do not already expose subtitles or captions.
- Downloading or transcribing audio/video content.
- Falling back to pasted/uploaded transcripts when YouTube captions are unavailable.
- User-selectable Gemini model choices in the frontend for the first release.
- Report download/export in the first release.
- Durable resumable report jobs in the first release.
- User accounts, saved report history, billing, sharing, or multi-user collaboration.
- Supporting paid LLM providers unless the project owner approves a separate change.
- Perfect speaker diarization. If captions do not identify speakers, the system will preserve unknown speakers and let Gemini infer names only when transcript evidence supports it.
- Displaying the original transcript as the final report. Captions are source material for summarization, not user-facing report content.

## Decisions

### Use TypeScript with Hono and a Cloudflare deployment adapter

Use TypeScript for backend code, browser code, and tests. Use Hono as the backend framework because it provides a small Node.js-style routing layer that can run on Cloudflare Workers without coupling domain logic to deployment APIs. Wrangler should provide local development and deployment scripts, while `src/worker/` should act as the Cloudflare adapter around the Hono app.

Alternatives considered:

- Plain JavaScript: lower setup cost, but weaker contracts for report events, transcript segments, and service boundaries.
- Express server: familiar for Node.js, but it is not a natural fit for Cloudflare Workers deployment.
- Direct Worker handlers only: fewer dependencies, but route composition, middleware, and testing are cleaner through Hono.

### Enforce strict transcript typing and quality gates

Transcript and caption data should be strongly typed at module boundaries. Core transcript types should use explicit fields for timing, text, language, caption kind, source track metadata, and optional speaker evidence. Caption kind should be a union such as `manual | auto_generated`, not a free-form string. Any parser output should be validated before entering the report pipeline so Gemini prompt construction never receives untyped raw caption payloads.

The TypeScript configuration should be strict. Lint rules should reject `any` in transcript, report, and streaming modules unless a line has an explicit justification. Formatting should be automated and checked in CI. Commit messages should follow an imperative/conventional style and be validated before merge.

CI/CD should run typecheck, lint, format check, unit tests, and e2e tests for pull requests. Deployment to Cloudflare should happen only from the main branch or a manually approved workflow after checks pass and required secrets are present.

Alternatives considered:

- Rely on informal review for transcript shapes: too risky because transcript parsing sits upstream of prompt construction and report validation.
- Deploy directly from local machines: faster initially, but weaker auditability and easy to drift from tested code.

### Use SSE as the primary streaming transport

Expose an SSE endpoint for report generation. The browser opens a stream such as `GET /api/reports/stream?url=<encoded YouTube URL>`, and the backend returns typed JSON event payloads with event names such as `progress`, `report_delta`, `report_section`, `summary_paragraph`, `retrying`, `error`, and `complete`.

Alternatives considered:

- WebSocket: useful for bidirectional protocols, but this flow is request-in and stream-out. SSE is sufficient, simpler to consume through `EventSource`, and includes native reconnect behavior.
- Polling: easy to implement, but worse user experience and unnecessary for streamed model output.

### Keep the SSE route transport-only

The Hono route should parse the request, create an SSE response, translate query parameters into a `ReportGenerationRequest`, and forward emitted domain events from a reusable `reportPipeline`. It should not fetch YouTube captions or call Gemini directly.

Alternatives considered:

- Put all generation logic in the route handler: faster for a prototype, but duplicates logic across tests and future routes.
- Create a job queue immediately: better for long-running workloads, but larger than the initial no-history requirement.

### Normalize transcripts before calling Gemini

YouTube caption tracks should be parsed into a shared `TranscriptSegment` model with timing, text, language, caption kind, and optional speaker fields. The acquisition layer should support both manually authored caption tracks and auto-generated caption tracks when YouTube exposes them. Selection should use the video's default caption language without additional language preference. If multiple tracks exist in the default language, manually authored captions should be preferred over auto-generated captions; otherwise, an exposed auto-generated track is acceptable. Gemini prompts should receive this normalized structure, not raw caption XML/JSON.

Alternatives considered:

- Send raw captions to Gemini: lower parser effort, but expensive in tokens, harder to test, and more likely to produce inconsistent reports.
- Support pasted transcript fallback: out of scope for the initial product because this feature only processes YouTube videos with available captions.

### Use Gemini 3 Flash Preview by default

The Gemini client should default to the official Gemini 3 Flash Preview model code, `gemini-3-flash-preview`. This model supports structured outputs and a large context window in current Google AI for Developers documentation. The configured default should still live behind a single constant or environment-backed setting so a later frontend model picker can be added without rewriting the report pipeline.

Alternatives considered:

- Hard-code the model in each Gemini call: simple but makes future frontend model choice harder.
- Add a model picker now: useful later, but unnecessary for the first release and adds validation/configuration surface before the base workflow is working.

### Run a Gemini setup preflight when the stream starts

When the browser opens the report SSE stream, the backend should run a lightweight Gemini preflight request before fetching captions or sending any transcript content to Gemini. The request should use the configured API key and default model, but the prompt should be a tiny setup check that does not include the YouTube URL, transcript text, user content, or report instructions. A suitable prompt is:

```text
Respond with exactly this JSON object and no extra text: {"ok":true}
```

The preflight result should only prove that the application can call Gemini with the current configuration. It should not be treated as report content. If the preflight fails because the API key is missing or invalid, the model is unavailable, quota or rate limits are exceeded, or the provider/network request fails, the pipeline should emit a sanitized provider error event and close the stream before transcript acquisition continues. The frontend should show an English notification explaining that Gemini setup failed and allow the user to enter a URL again.

This adds one small Gemini call per generation attempt. The first release should favor clear diagnostics over caching because the current failure mode is setup uncertainty. If quota pressure becomes material, a later change can add a short-lived per-isolate preflight cache or an explicit admin diagnostics endpoint.

Alternatives considered:

- Wait until report generation to discover Gemini setup failures: cheaper by one request, but users wait through validation and caption fetching before learning that provider setup is broken.
- Add a separate manual diagnostics page: useful later, but the requested behavior is to notify the user when streaming starts.
- Include transcript data in the preflight: rejected because preflight should verify setup without sending user content.

### Require Simplified Chinese structured Gemini output with streaming tolerance

The Gemini client should use an English prompt that requests a predictable report shape written entirely in Simplified Chinese and parse streamed output into tolerant partial events. The final result should be validated into a `Report` model before completion. Each report paragraph should summarize a coherent part of the video rather than reproduce transcript lines. Paragraphs should prefer a dialog-style label when there is transcript evidence for a speaker or role, for example `Jack: 这一段总结了...`; when no speaker is known, use a neutral Chinese label such as `旁白:` or `未知发言者:`. If Gemini returns non-Chinese prose, verbatim transcript dumps, or malformed JSON, the UI should show a recoverable generation error instead of rendering corrupt structure.

Alternatives considered:

- Render raw model text: easier streaming, but does not meet the Simplified Chinese title, subtitle, sections, and speaker-labeled paragraph summary requirements.
- Wait for the full model response before rendering: simpler validation, but fails the progressive rendering requirement.

### Use a clear English Gemini prompt template

The prompt text should be maintained as an English template in the codebase so developers can review and test it consistently. Only the model's report output is required to be Simplified Chinese.

Prompt template:

```text
You are a video report writer.

Create a structured report from the provided YouTube caption segments.

Output language:
- The report content must be written in Simplified Chinese.
- Proper names may stay in their original form when the transcript provides them.

Output style:
- Do not output the original transcript.
- Do not list raw subtitle lines.
- Summarize the content into coherent report paragraphs.
- Each paragraph should use a dialog-style label when possible, such as "Jack: <Simplified Chinese summary>".
- If the speaker is unknown, use a neutral Chinese label such as "旁白:" or "未知发言者:".
- The text after the label must be a summary, not a direct quote.
- Do not invent speaker names. Only use a name when the transcript provides enough evidence.

Required structure:
- title: a concise Simplified Chinese title
- subtitle: a one-sentence Simplified Chinese subtitle
- sections: ordered sections grouped by topic or timeline
- sections[].heading: a Simplified Chinese section heading
- sections[].paragraphs[]: speaker-labeled Simplified Chinese summary paragraphs
- sections[].paragraphs[].sourceRange: approximate startMs and endMs from the transcript evidence

Return only valid JSON matching the provided schema.

Caption segments:
{{TRANSCRIPT_SEGMENTS_JSON}}
```

### Serve a minimal app shell from the backend

The initial UI can be served by the Hono app as HTML/CSS/JS assets through the Cloudflare deployment adapter. The first screen should be the usable form and report surface, not a marketing page. The renderer should consume typed SSE events and update stable DOM regions for status, Simplified Chinese title, subtitle, sections, and speaker-labeled summary paragraphs.

Alternatives considered:

- Add a separate frontend framework immediately: useful later, but unnecessary for the initial surface and adds build complexity before product behavior is proven.
- API-only backend: incomplete for the requested full-stack application.

### Render streamed content with a typewriter effect

The browser renderer should append incoming report fields to an in-memory render queue and reveal text progressively with a typewriter-style effect. The effect should start as soon as the first title, section, or paragraph event arrives and should continue while later SSE chunks are still being received. It must not wait for the `complete` event before showing report content.

The typewriter effect is presentation-only. The underlying report state should still be stored as structured data so validation, retry handling, and final rendering are not coupled to animation timing. Titles and section headings should appear immediately for scanability. Speaker-labeled paragraph bodies should render at a default speed of about 45 Chinese characters per second. If stream events arrive faster than the animation can display them, the renderer should queue content and drain it in order. The UI should include a `Skip animation` control that immediately renders queued content and disables the typewriter effect for the current report. If the user prefers reduced motion, the renderer should disable or shorten the animation and render chunks immediately.

Alternatives considered:

- Render only after completion: simpler but makes the app feel stalled during long report generation.
- Append full chunks instantly: technically fine, but less clear that the report is actively being generated.

### Show simple user-facing generation states

After the user clicks submit or confirm, the UI should immediately show a simple English loading notification. Internal typed events can still track validation, caption fetching, transcript preparation, Gemini generation, and streaming, but the first release does not need to expose every internal state to the user.

```text
idle
  -> loading
  -> streaming_report
  -> complete
```

Error and interruption states can branch from that flow:

```text
transcript_unavailable
provider_error
validation_error
disconnected
reconnecting
retry_failed
canceled
```

The `loading` state should be shown before any report content is rendered. Once report content starts rendering, the content itself becomes the primary progress signal. The submit control should be disabled while a generation is active and restored when the stream reaches `complete`, a terminal error, cancellation, or retry failure. The UI should expose a `Cancel` button during active generation; clicking it closes the current SSE connection, requests cancellation through abort signals where supported, preserves content already rendered, and returns controls to an idle state.

Alternatives considered:

- Only show a spinner: easy but vague, especially when caption fetching or Gemini generation takes time.
- Show every internal pipeline state: more precise, but too noisy for the first release when a simple loading state is enough before render starts.

### Treat no-subtitle videos as recoverable user input failures

When transcript acquisition finds no usable caption track, the pipeline should emit a typed transcript-unavailable error. The frontend should show a clear notification that the video has no available subtitles, reset the input controls to idle, and avoid attempting a fallback source.

Alternatives considered:

- Attempt audio transcription or ask for a pasted transcript fallback: out of scope and conflicts with the requirement that input videos must have subtitles.
- Silently fail in the report area: confusing because it does not tell the user how to recover.

### Handle SSE disconnections and retries explicitly

The frontend should show disconnected and reconnecting states when the EventSource errors before a `complete` event. It should retry up to 5 times using exponential backoff with jitter and a reasonable delay cap. If retries are exhausted or the backend cannot resume safely, the UI should stop streaming, leave any already rendered partial content visible, show a sanitized retry-failed notification, and provide a button that resets the input area so the user can re-enter the URL.

Alternatives considered:

- Rely only on default EventSource reconnect behavior: simple, but users get no clear feedback and repeated streams could restart generation without context.
- Add durable resumable jobs immediately: more robust, but larger than the initial no-history product slice.

## Risks / Trade-offs

- YouTube caption access can be unavailable, region-dependent, or format-variable -> isolate YouTube fetch and parsing behind interfaces, use fixtures, and return clear "no subtitles available" errors.
- Gemini AI Studio free-tier quota and rate limits can change -> document that users must verify current quota in Google AI Studio, handle quota/rate-limit responses explicitly, and keep model/provider details configurable.
- Gemini setup preflight consumes an extra small request and may hit the same quota limits as generation -> keep the prompt tiny, sanitize failures, and defer caching or admin-only diagnostics until quota impact is understood.
- SSE connections can be interrupted during long generations -> emit ordered events, show disconnected/reconnecting states, use bounded retry, and defer durable persisted resume support to a later change.
- Cloudflare Worker execution limits may constrain long videos -> cap accepted transcript length, provide a useful validation error for oversized transcripts, and keep report generation incremental.
- Transcript parsing bugs can corrupt prompt input -> enforce strict transcript types, parser validation, and lint rules that prevent untyped transcript handling.
- Deployment can drift from tested code -> use CI/CD gates and deploy only after typecheck, lint, format, and tests pass.
- Speaker attribution may be absent from captions -> preserve unknown speaker metadata, use neutral labels such as `旁白:` or `未知发言者:`, and instruct Gemini not to invent names.
- Gemini may quote transcript text too directly -> prompt for Simplified Chinese speaker-labeled summaries, validate against excessive verbatim transcript reuse, and keep original transcript display out of the UI.
- Streaming structured output is harder than rendering final text -> define event contracts and parser tests before building the UI.
- Typewriter rendering can fall behind fast streams or distract some users -> keep structured state separate from animation, bound animation speed, and respect reduced-motion preferences.
- User transcript content is sent to Gemini -> document this behavior, avoid logging raw transcript text, and avoid storing generated reports in the initial version.

## Migration Plan

This is a greenfield implementation. Add tooling and code in small vertical slices: project setup, Hono app and Cloudflare adapter, URL validation, transcript fixtures/parser, Gemini client abstraction, report pipeline, SSE route, UI renderer, then e2e coverage. Rollback is to disable the new route or revert the feature branch before deployment.

## Open Questions

- What transcript token budget should be enforced alongside the 100-minute video duration limit?
- Should Gemini preflight success be cached for a short time per Worker isolate, or should every report stream perform a fresh check until provider setup is stable?
