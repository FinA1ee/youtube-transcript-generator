# report-html-rendering Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Render report input and status
The system SHALL render an English-language React UI where users can submit a YouTube URL, optionally provide natural language generation requirements, fetch transcript readiness, generate a streamed report, clearly understand current status, and optionally test Gemini setup in diagnostic mode without navigating away.

#### Scenario: Page loads
- **WHEN** a user opens the application root page
- **THEN** the system displays a themed React interface with a YouTube URL input, an optional generation requirements input, a submit control, a prominent status area, and an empty report area

#### Scenario: Generation requirements are optional
- **WHEN** a user submits a YouTube URL without generation requirements
- **THEN** the page starts the existing transcript fetch and report generation workflow without requiring additional input

#### Scenario: User enters generation requirements
- **WHEN** a user enters natural language generation requirements before submitting
- **THEN** the page keeps the requirements associated with the current report request for stream startup and retry
- **AND** the requirements can describe task type, output style, target audience, or constraints

#### Scenario: Generation status updates
- **WHEN** the browser receives report stream events or standalone request results
- **THEN** the page updates a visually prominent English status banner for the current step

#### Scenario: Submit starts transcript fetch
- **WHEN** a user submits a YouTube URL
- **THEN** the page immediately displays an English transcript-fetching notification
- **AND** sends a standalone transcript fetch request before opening the report stream

#### Scenario: Transcript fetch succeeds
- **WHEN** the standalone transcript fetch request returns a valid transcript handoff
- **THEN** the page starts the report rendering stream with the transcript handoff and any non-empty generation requirements

#### Scenario: Backend state changes
- **WHEN** standalone transcript fetch or report stream state changes occur
- **THEN** the page displays concise English loading, completion, cancellation, retry, or error notifications for the current step

#### Scenario: Caption kind is known
- **WHEN** the selected caption track is manually authored or auto-generated
- **THEN** the page displays an English label indicating whether captions are manual or auto-generated

#### Scenario: User clears current content
- **WHEN** the user clicks the clear-content or new-link control
- **THEN** the page closes any active stream, clears current report content and status derived from that report, hides report-only controls, and focuses the URL input

### Requirement: Render streamed Simplified Chinese summary structure
The system SHALL progressively render Simplified Chinese report title, subtitle, hierarchical headings, and speaker-labeled summary paragraphs as typed stream events arrive.

#### Scenario: Title and subtitle arrive
- **WHEN** the browser receives title and subtitle report events
- **THEN** the page creates report header elements immediately
- **AND** renders their Simplified Chinese text incrementally through the stream renderer

#### Scenario: Hierarchical heading content arrives
- **WHEN** the browser receives a heading event with level 1, 2, or 3
- **THEN** the page renders the heading in report order with visual hierarchy equivalent to h1, h2, or h3
- **AND** renders heading text incrementally through the stream renderer

#### Scenario: Summary paragraph arrives
- **WHEN** the browser receives summary paragraph events linked to a heading
- **THEN** the page renders each paragraph as a speaker-labeled Simplified Chinese summary of transcript content rather than original transcript lines

### Requirement: Use typewriter-style incremental rendering
The system SHALL display streamed report title, subtitle, heading, and paragraph text with a typewriter-style effect as content arrives, without waiting for the complete report.

#### Scenario: First report content arrives
- **WHEN** the browser receives the first title, heading, or summary paragraph event
- **THEN** the page begins displaying that text incrementally before receiving a complete event

#### Scenario: Stream arrives faster than rendering
- **WHEN** report events arrive faster than the typewriter effect can display them
- **THEN** the page queues the content and renders it in order without dropping report content

#### Scenario: Reduced motion is preferred
- **WHEN** the user environment indicates reduced motion preference
- **THEN** the page disables or shortens the typewriter effect while still rendering streamed content incrementally

#### Scenario: User skips animation
- **WHEN** report generation has begun and the user clicks the skip animation control
- **THEN** the page immediately renders queued report content and disables the typewriter effect for the current report

#### Scenario: Report generation has not begun
- **WHEN** no report stream is active and no report content is queued
- **THEN** the page hides the skip animation control

### Requirement: Avoid rendering original transcript as final content
The system SHALL NOT render raw original transcript lines as the final report content.

#### Scenario: Report content is displayed
- **WHEN** report content is shown in the browser
- **THEN** it appears as structured speaker-labeled Simplified Chinese summaries and not as a verbatim transcript listing

### Requirement: Render final and error states
The system SHALL clearly render completion, validation errors, transcript errors, provider errors, and disconnected states.

#### Scenario: Generation completes
- **WHEN** the browser receives a complete event
- **THEN** the page marks the report as complete and keeps the generated content visible

#### Scenario: Generation fails
- **WHEN** the browser receives a report error event
- **THEN** the page displays a sanitized error message and allows the user to submit another URL

#### Scenario: Video has no subtitles
- **WHEN** the browser receives a transcript unavailable error because the video has no usable subtitles
- **THEN** the page displays a clear no-subtitles notification and returns the input controls to an idle state

#### Scenario: SSE stream disconnects
- **WHEN** the report SSE stream disconnects before completion
- **THEN** the page displays a disconnected or reconnecting state without losing the user's submitted URL

#### Scenario: SSE retry is exhausted
- **WHEN** the browser cannot restore the report SSE stream after configured retries
- **THEN** the page leaves already rendered partial content visible, displays a retry-failed notification, and shows a control for re-entering the URL

#### Scenario: User cancels generation
- **WHEN** the user clicks the cancel button during active generation
- **THEN** the page closes the active report SSE connection, preserves already rendered content, and returns the input controls to an idle state

### Requirement: Avoid exposing secrets in the browser
The system SHALL keep Gemini API keys and Worker secret values out of all HTML, JavaScript, SSE request parameters, SSE event payloads, and rendered error messages.

#### Scenario: App shell is served
- **WHEN** the browser downloads the application HTML and JavaScript
- **THEN** the response contains no Gemini API key or Cloudflare credential values

### Requirement: Render Gemini preflight diagnostics
The system SHALL render Gemini preflight diagnostic state and result in English without using the report content area, and SHALL hide diagnostic controls unless diagnostic mode is enabled.

#### Scenario: Diagnostic mode is disabled
- **WHEN** the page loads without diagnostic controls enabled
- **THEN** the Gemini test button is not visible

#### Scenario: Diagnostic mode is enabled
- **WHEN** the page loads with diagnostic controls enabled
- **THEN** the Gemini test button is visible

#### Scenario: User clicks Gemini test button
- **WHEN** the user clicks the Gemini test button
- **THEN** the page sends a standalone Gemini preflight request
- **AND** displays an English checking state

#### Scenario: Gemini test succeeds
- **WHEN** the standalone preflight request returns success
- **THEN** the page displays an English success notification
- **AND** does not create report title, heading, paragraph, or caption elements

#### Scenario: Gemini test fails
- **WHEN** the standalone preflight request returns a sanitized Gemini error
- **THEN** the page displays an English error notification
- **AND** leaves any existing report content unchanged

