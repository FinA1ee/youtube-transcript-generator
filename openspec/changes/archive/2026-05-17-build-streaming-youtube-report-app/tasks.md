## 1. Project Setup

- [x] 1.1 Create `package.json`, TypeScript config, Wrangler config, Vitest config, Hono dependency setup, and stable npm scripts for dev, test, lint, format, and deploy.
- [x] 1.2 Add `.gitignore`, `.env.example`, and README setup notes covering Gemini API key configuration through local vars and Worker secrets.
- [x] 1.3 Create the initial source layout under `src/server/`, `src/worker/`, `src/youtube/`, `src/transcripts/`, `src/llm/`, `src/reports/`, `src/client/`, and `src/shared/`.
- [x] 1.4 Create test layout under `tests/unit/`, `tests/e2e/`, and fixture folders for safe caption samples and mocked provider responses.
- [x] 1.5 Configure strict TypeScript and ESLint rules that prevent untyped transcript/report handling, including disallowing unapproved `any` in `src/transcripts/`, `src/reports/`, `src/llm/`, and `src/shared/`.
- [x] 1.6 Configure commit message rules for concise imperative or conventional commit messages and document the expected format.
- [x] 1.7 Add CI/CD workflow configuration that runs install, typecheck, lint, format check, unit tests, and e2e tests on pull requests, then deploys to Cloudflare only after checks pass on the deployment branch or approved workflow.

## 2. Domain Contracts and Test Fixtures

- [x] 2.1 Define shared TypeScript types for report generation requests, caption tracks, transcript segments with caption kind, Simplified Chinese report sections, speaker-labeled summary paragraphs, report models, generation states, and stream events.
- [x] 2.2 Add unit test fixtures for supported YouTube URLs, unsupported URLs, caption payloads, transcript segments, Gemini stream chunks, and malformed report output.
- [x] 2.3 Add test helpers for mocked fetch responses and SSE event collection.

## 3. YouTube Input Capability

- [x] 3.1 Write unit tests for standard YouTube watch URLs, short URLs, malformed URLs, unsupported hosts, and missing video identifiers.
- [x] 3.2 Implement URL validation and normalization in `src/youtube/`.
- [x] 3.3 Ensure invalid input returns typed validation errors before any transcript or Gemini dependency is called.

## 4. Transcript Acquisition Capability

- [x] 4.1 Write unit tests for default-language caption selection, manual caption discovery, auto-generated caption discovery, no-subtitle notification errors, typed caption parsing, parser validation failures, unknown speaker handling, ordering, 100-minute duration limit, and transcript size limits.
- [x] 4.2 Implement YouTube metadata/caption track discovery behind a `youtubeClient` interface.
- [x] 4.3 Implement caption fetching with mocked-network coverage and no raw transcript logging.
- [x] 4.4 Implement caption parsing and normalization into ordered, validated `TranscriptSegment` records with caption kind labels.
- [x] 4.5 Implement a 100-minute video duration limit and configurable transcript token/segment limits before Gemini generation.

## 5. Gemini Report Generation Capability

- [x] 5.1 Write unit tests for missing API key handling, default `gemini-3-flash-preview` model selection, English prompt construction, Simplified Chinese speaker-labeled summary output parsing, malformed output handling, non-Chinese output rejection, Traditional Chinese rejection, verbatim transcript dump rejection, and quota/rate-limit mapping.
- [x] 5.2 Implement `geminiClient` with environment-based API key access and configurable default model set to `gemini-3-flash-preview`.
- [x] 5.3 Implement the English Gemini prompt template from `design.md` with instructions for Simplified Chinese title, subtitle, sections, and speaker-labeled summarized paragraphs.
- [x] 5.4 Implement streamed Gemini response handling that emits partial Simplified Chinese summary report events where possible.
- [x] 5.5 Implement final report validation into the shared `Report` model.
- [x] 5.6 Validate that final report content is Simplified Chinese speaker-labeled summary content rather than a verbatim transcript dump.
- [x] 5.7 Sanitize all Gemini errors before exposing them to browser stream events.
- [x] 5.8 Add unit tests for Gemini setup preflight success, missing API key, invalid credentials, unavailable model, quota or rate-limit failure, network failure, and proof that the preflight prompt contains no user URL or transcript content.
- [x] 5.9 Implement a lightweight Gemini setup preflight method that uses the configured default model, sends a tiny diagnostic prompt, maps provider failures to sanitized errors, and never treats preflight output as report content.

## 6. Report Pipeline and SSE Delivery

- [x] 6.1 Write unit tests for report pipeline event ordering, generation state events, cancellation, invalid request handling, no-subtitle handling, transcript failure handling, Gemini failure handling, and successful completion.
- [x] 6.2 Implement a reusable `reportPipeline` that composes URL validation, transcript acquisition, Gemini generation, final validation, and typed event emission.
- [x] 6.3 Implement the Hono backend app and Cloudflare Worker adapter for `GET /` and SSE report generation.
- [x] 6.4 Keep the SSE route transport-focused by translating request parameters into pipeline requests and pipeline events into SSE messages.
- [x] 6.5 Implement client disconnect cancellation with abort signals where supported.
- [x] 6.6 Implement cancel-button-driven SSE closure and downstream abort handling.
- [x] 6.7 Implement ordered SSE event IDs and browser-visible retry or retry-failed states for interrupted streams, using 5 retry attempts with exponential backoff and jitter.
- [x] 6.8 Run Gemini setup preflight when the report SSE stream starts, before caption fetching and before transcript content is sent to Gemini, and emit a terminal sanitized provider error event if it fails.

## 7. HTML Report Rendering

- [ ] 7.1 Write browser-side tests or e2e assertions for English UI copy, form submission, simple loading state before render, caption kind labels, typewriter rendering, skip animation, immediate Simplified Chinese title/subtitle rendering, immediate section heading rendering, speaker-labeled summary paragraph rendering, no-subtitle notification, cancel button behavior, SSE disconnect/retry states, retry-failed partial-content preservation, error display, and completion state.
- [x] 7.2 Implement the app shell HTML, CSS, and client script served by the Worker.
- [x] 7.3 Implement browser EventSource/SSE connection management, input validation feedback, cancellation, bounded retry, reconnect-safe cleanup, and sanitized error display.
- [x] 7.4 Implement a structured render queue and typewriter-style renderer with a default speed of about 45 Chinese characters per second for paragraph bodies.
- [x] 7.5 Render report titles and section headings immediately instead of animating them.
- [x] 7.6 Add a skip animation control that flushes queued content and disables typewriter animation for the current report.
- [x] 7.7 Implement visible English notifications with a simple loading state before report render, plus reconnecting, retry failed, complete, canceled, and error states.
- [x] 7.8 Add a cancel button that closes the current SSE connection, preserves rendered content, and restores input controls.
- [x] 7.9 Preserve partial rendered content after retry failure and show a control for re-entering the URL.
- [x] 7.10 Respect reduced-motion preferences by disabling or shortening the typewriter effect.
- [x] 7.11 Display English labels for manual versus auto-generated caption tracks when the selected caption kind is known.
- [x] 7.12 Ensure no Gemini API key or Worker secret value is present in served HTML, JavaScript, SSE request parameters, SSE payloads, or rendered errors.
- [x] 7.13 Display a clear English notification when Gemini setup preflight fails, reset controls to allow URL entry again, and avoid rendering empty report structure.

## 8. E2E Coverage and Documentation

- [ ] 8.1 Add backend/e2e tests for the root page, invalid URL submission, successful mocked SSE report stream, no-subtitle notification, auto-generated caption path, caption kind label, 100-minute duration rejection, cancel behavior, Gemini quota error, and disconnected SSE 5-retry behavior.
- [x] 8.2 Document supported YouTube URL forms, default-language caption selection, manual and auto-generated subtitle support, 100-minute video limit, unknown transcript token budget, default Gemini model, deferred download/model-picker/resumable-job capabilities, Gemini free-tier setup, local development commands, deployment commands, commit rules, CI/CD gates, and known limits in README.
- [x] 8.3 Run `npm test`, `npm run lint`, `npm run format`, and the CI-equivalent typecheck after implementation and record results for the pull request.
- [x] 8.4 Verify CI/CD deploy configuration uses Cloudflare secrets and deploys only after checks pass.
- [ ] 8.5 Verify the OpenSpec requirements are satisfied and update any tasks or docs that drift during implementation.
- [x] 8.6 Add e2e or backend stream coverage for Gemini setup preflight failure notifying the user before caption fetching or report rendering.
