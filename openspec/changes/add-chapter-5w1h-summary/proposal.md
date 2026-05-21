## Why

Users need a quick structured way to understand each generated chapter without rereading the full report. A chapter-level 5W1H summary gives focused Who/What/When/Where/Why/How answers while still using the full video context already processed by the server.

## What Changes

- Organize generated article/report results by chapter so each top-level chapter can expose chapter actions.
- Add a `[5W1H]` action next to chapter titles in the React report renderer.
- Add an on-demand chapter 5W1H summary request that returns structured data for Who, What, When, Where, Why, and How.
- Generate each 5W1H summary from server-saved generation context that combines the full video transcript/report context with the selected chapter context.
- Prevent the frontend from resubmitting the full article content when requesting a chapter 5W1H summary.
- Render 5W1H summary results in a fixed, predictable format under or near the selected chapter.

## Capabilities

### New Capabilities
- `chapter-5w1h-summary`: On-demand structured 5W1H summaries for generated report chapters using server-side generation context.

### Modified Capabilities
- `report-html-rendering`: Add chapter-level 5W1H controls and fixed-format rendering for returned summaries.
- `streaming-report-delivery`: Preserve a server-side generation context identifier during report generation and expose only lightweight chapter summary request metadata to the browser.
- `gemini-report-generation`: Support a chapter 5W1H prompt/output contract that combines full video context with selected chapter context and returns structured data.

## Impact

- Shared types for report generation context, chapter identifiers, and 5W1H result shape.
- Worker routes for server-side context lookup and chapter 5W1H summary requests.
- In-memory or bounded server-side context storage suitable for Cloudflare Worker runtime constraints.
- Gemini client/prompt/parser additions for structured 5W1H output.
- React chapter rendering, action state, loading/error states, and fixed-format summary display.
- Unit and e2e tests for context storage, request validation, prompt construction, and UI asset behavior.
