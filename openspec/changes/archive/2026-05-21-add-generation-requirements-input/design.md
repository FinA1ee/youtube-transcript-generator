## Context

The application currently separates transcript acquisition from report rendering: the browser first requests a transcript handoff, then starts a POST-based report stream with the transcript token. Gemini prompt construction is centralized in `src/llm/prompt.ts`, and the React page owns the form, status, cancellation, retry, and streamed rendering states.

The new requirement is optional generation guidance entered in natural language. It should influence report generation only within supported categories: task type, output style, target audience, and constraints. It must not become a model picker, provider override, raw prompt editor, or a way to bypass the Simplified Chinese structured report contract.

## Goals / Non-Goals

**Goals:**
- Add an optional natural language requirement input to the page without disrupting the existing URL-first workflow.
- Carry sanitized requirements with the report stream startup request, not the transcript fetch request.
- Incorporate requirements into Gemini prompt construction as bounded guidance for task type, output style, target audience, and constraints.
- Preserve existing output format, stream event types, secret handling, cancellation, retry behavior, and no-requirements behavior.

**Non-Goals:**
- No frontend model selection or provider selection.
- No persistent storage of user requirements.
- No guarantee that every user instruction is satisfied; the system should apply supported constraints where practical and stay within the supported scope.
- No support for arbitrary prompt injection, output language override, raw transcript rendering, or unsafe/system-level instruction override.

## Decisions

1. Requirements travel with report stream startup only.

   The transcript fetch endpoint should continue to accept only the YouTube URL and return a transcript handoff. The optional requirement belongs to generation, so the browser sends it in the `/api/reports/stream` POST body alongside `transcriptToken`.

   Alternative considered: include requirements in the transcript token. This would enlarge the handoff payload and mix generation concerns into transcript acquisition.

2. Store the input as a bounded string, not a parsed requirements model.

   The first implementation should trim and length-limit the natural language field, then pass it to prompt construction. The prompt should tell Gemini to interpret the text only as guidance for task type, output style, target audience, and constraints. This avoids premature taxonomy design while matching the user's request for natural language input.

   Alternative considered: add four structured fields. That is easier to validate but less natural for users and more rigid than requested.

3. Prompt-level constraints remain authoritative.

   The prompt should place user requirements below system output constraints and explicitly state that requirements cannot override Simplified Chinese output, NDJSON formatting, summarization rules, secret handling, or supported event shapes.

   Alternative considered: append the raw requirement at the end of the prompt. That is simpler but makes instruction priority ambiguous and increases prompt-injection risk.

4. Omitted requirements preserve existing behavior.

   Empty or whitespace-only requirements should be treated as absent. The browser should not show a special state when omitted, and backend tests should prove the generated stream still starts with only `transcriptToken`.

## Risks / Trade-offs

- Prompt injection in user requirements -> Mitigate by placing requirements in a bounded "user guidance" section with explicit scope and non-override rules.
- Very long requirements increase request and prompt size -> Mitigate with frontend and backend length limits and trimming.
- Users may expect exact compliance with every sentence -> Mitigate by UI copy and prompt wording that frames the field as optional generation requirements within supported categories.
- Retry behavior could lose requirements if only token is retained -> Mitigate by storing the sanitized requirement alongside the current transcript token for retry calls.
