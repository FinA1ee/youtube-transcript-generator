## 1. Shared Model And Context Storage

- [x] 1.1 Add shared types for report context ids, chapter ids, chapter 5W1H requests, and fixed 5W1H response fields.
- [x] 1.2 Extend stream event types to expose report context availability without exposing transcript or article content.
- [x] 1.3 Add a server-side report generation context store with bounded TTL and count limits.
- [x] 1.4 Build helpers that derive level-1 chapters and descendant chapter context from accumulated headings and paragraphs.

## 2. Report Stream Context Integration

- [x] 2.1 Create and save a report context when `/api/reports/stream` starts from a verified transcript handoff.
- [x] 2.2 Update saved context as title, heading, and paragraph events are emitted.
- [x] 2.3 Emit a typed report context event to the browser before chapter actions are needed.
- [x] 2.4 Ensure context storage preserves transcript context and generation requirements server-side without sending them to the browser.

## 3. Gemini 5W1H Generation

- [x] 3.1 Add a chapter 5W1H prompt builder using full video context and selected chapter context.
- [x] 3.2 Add Gemini client support for generating chapter 5W1H structured JSON.
- [x] 3.3 Validate `who`, `what`, `when`, `where`, `why`, and `how` output fields and handle unavailable fields without inventing details.
- [x] 3.4 Map malformed output and provider failures to sanitized existing error behavior.

## 4. Chapter 5W1H Endpoint

- [x] 4.1 Add a standalone JSON endpoint for chapter 5W1H requests.
- [x] 4.2 Validate report context id and chapter id before calling Gemini.
- [x] 4.3 Reject or ignore frontend-submitted full article, transcript, or paragraph content and use server-saved context only.
- [x] 4.4 Return sanitized context-unavailable, validation, and generation errors.

## 5. React Chapter UI

- [x] 5.1 Treat level-1 headings as chapter titles in the report renderer.
- [x] 5.2 Render a `[5W1H]` button next to each chapter title once a report context id is available.
- [x] 5.3 Send lightweight chapter 5W1H requests containing only report context id and chapter id.
- [x] 5.4 Render loading, error, and successful 5W1H states per chapter without removing existing report content.
- [x] 5.5 Display returned Who, What, When, Where, Why, and How fields in a fixed format.

## 6. Tests And Verification

- [x] 6.1 Add unit tests for context storage, context expiry, chapter derivation, and request validation.
- [x] 6.2 Add unit tests for chapter 5W1H prompt construction and structured output validation.
- [x] 6.3 Add e2e tests proving chapter 5W1H uses server-saved context and does not require frontend full article resubmission.
- [x] 6.4 Add browser asset or component-level tests for `[5W1H]` controls and fixed-format rendering.
- [x] 6.5 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, frontend build, Wrangler dry-run, and `openspec validate add-chapter-5w1h-summary --strict`.
