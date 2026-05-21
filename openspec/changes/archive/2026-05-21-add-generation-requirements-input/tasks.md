## 1. Request Model And Validation

- [x] 1.1 Add an optional generation requirements field to shared report stream request types.
- [x] 1.2 Implement backend trimming, empty-string omission, type validation, and maximum length validation for generation requirements.
- [x] 1.3 Ensure invalid generation requirements return sanitized JSON validation errors before Gemini is called.

## 2. Backend Generation Flow

- [x] 2.1 Thread sanitized generation requirements from `/api/reports/stream` into report streaming.
- [x] 2.2 Update report pipeline and Gemini client boundaries to accept optional generation requirements without affecting transcript fetch.
- [x] 2.3 Preserve retry, cancellation, stream events, and no-requirements behavior.

## 3. Gemini Prompting

- [x] 3.1 Update prompt construction to include bounded user guidance only when non-empty requirements are provided.
- [x] 3.2 Explicitly scope user guidance to task type, output style, target audience, and constraints.
- [x] 3.3 Ensure user guidance cannot override Simplified Chinese output, NDJSON event shapes, summarization rules, or safety constraints.
- [x] 3.4 Add prompt tests for omitted, trimmed, supported, and conflicting generation requirements.

## 4. React UI

- [x] 4.1 Add an optional natural language generation requirements input to the report controls.
- [x] 4.2 Keep requirements associated with the current report stream and retry attempts.
- [x] 4.3 Send non-empty requirements in the report stream POST body and omit them when blank.
- [x] 4.4 Clear or preserve the requirements field according to the existing clear-content/new-link workflow chosen during implementation.
- [x] 4.5 Keep status, cancellation, skip-animation, diagnostic controls, and streamed report rendering behavior unchanged.

## 5. Tests And Verification

- [x] 5.1 Add or update unit tests for report stream request validation and sanitized error behavior.
- [x] 5.2 Add or update unit tests proving transcript fetch does not receive generation requirements.
- [x] 5.3 Add e2e or browser asset tests for submitting with and without generation requirements.
- [x] 5.4 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, frontend build, and Wrangler dry-run where available.
