## Context

The report generator currently streams a Simplified Chinese title, subtitle, hierarchical headings, and summary paragraphs to the browser. The frontend renders heading levels visually, but it does not yet treat top-level headings as actionable chapters. The backend verifies a transcript handoff, streams the report, and then forgets the generation context once the stream completes.

Chapter 5W1H summaries need an additional on-demand generation path. The request must be lightweight from the browser and must use server-saved context, because resubmitting the full generated article from the frontend would increase payload size, duplicate sensitive context, and make the browser authoritative for data the server already produced.

## Goals / Non-Goals

**Goals:**
- Treat each level-1 heading and its descendants as a report chapter.
- Store bounded server-side generation context for the completed or currently generated report.
- Expose a lightweight chapter 5W1H summary request that includes only a context id and chapter id.
- Generate structured Who, What, When, Where, Why, and How fields using full video context plus selected chapter context.
- Render returned 5W1H data in a fixed format near the selected chapter.

**Non-Goals:**
- No frontend resubmission of the full article, transcript, or generated report content for 5W1H.
- No persistent database requirement in the first implementation.
- No 5W1H summaries for arbitrary user-selected text outside generated chapters.
- No change to the primary report stream event order beyond carrying a context identifier and enough chapter metadata for later requests.

## Decisions

1. Use level-1 headings as chapters.

   Existing hierarchical output already supports level 1, 2, and 3 headings. A level-1 heading can become the chapter title, and all following lower-level headings and paragraphs belong to that chapter until the next level-1 heading.

   Alternative considered: ask Gemini for a separate `chapter` event type. That would create a broader stream contract change and duplicate heading semantics.

2. Store context server-side under a generated report context id.

   The backend should create a context id when report streaming starts and return it to the browser in a typed event or response metadata. The server context should include the transcript, generation requirements, accumulated report structure, and chapter index needed for 5W1H. Context entries should be bounded by TTL and count to fit Cloudflare Worker runtime constraints.

   Alternative considered: sign all context into a browser token. That would avoid memory state but would move large transcript/report payloads to the browser and conflict with the requirement not to resubmit full content.

3. Add a dedicated JSON endpoint for chapter 5W1H.

   The browser should call a standalone endpoint such as `POST /api/reports/chapter-5w1h` with `{ reportContextId, chapterId }`. The endpoint validates both fields, looks up server context, builds selected chapter context from the stored report, calls Gemini, validates structured JSON, and returns a fixed response shape.

   Alternative considered: extend the report SSE stream with command messages. The current stream is one-way from server to browser, so a standalone POST keeps the interaction simpler.

4. Return structured data, not prose.

   The backend should validate a response with exact fields for `who`, `what`, `when`, `where`, `why`, and `how`. Each field should be a concise Simplified Chinese string or a stable empty/unknown value when the video lacks that information.

   Alternative considered: render Gemini prose directly. That would be hard to test and would not satisfy the fixed-format rendering requirement.

## Risks / Trade-offs

- Worker memory is ephemeral -> Use short TTL context storage and return a clear expired-context error when unavailable.
- Multiple concurrent reports may collide -> Generate unguessable context ids and scope chapter requests to that id.
- Full transcript plus report context can be large -> Store bounded transcript/report excerpts and enforce existing transcript limits.
- Gemini may omit a 5W1H field -> Validate output and coerce missing information to a fixed unknown value or return a sanitized generation validation error.
- User clicks before chapter context is ready -> Disable or show loading until the chapter id and report context id are available.
