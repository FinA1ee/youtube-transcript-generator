## Why

Users currently get a fixed report shape from the YouTube transcript generator. Adding an optional natural language requirement field lets users steer the generated content toward a task, style, audience, or bounded constraints without exposing model configuration or requiring a separate workflow.

## What Changes

- Add an optional natural language generation requirement input to the React page.
- Include the user's requirement text when starting report generation, while preserving the existing transcript fetch and report stream separation.
- Interpret supported requirement categories as guidance for task type, output style, target audience, and constraints.
- Update Gemini prompt construction so generated Simplified Chinese report content reflects supported user requirements where practical, without exceeding the requested scope.
- Validate and sanitize the requirement field so it cannot expose secrets, break streaming, or override system-level safety and output contracts.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `report-html-rendering`: Add an optional generation requirement input and maintain clear UI state around submitted requirements.
- `streaming-report-delivery`: Carry sanitized generation requirements from the browser to the report stream endpoint.
- `gemini-report-generation`: Incorporate supported generation requirements into prompt construction and output validation boundaries.

## Impact

- React form state, validation, and submit flow.
- Shared browser/backend request types for report stream startup.
- Worker report stream request parsing and sanitization.
- Gemini prompt builder and related unit tests.
- Browser/e2e coverage for optional requirement submission and unchanged behavior when omitted.
