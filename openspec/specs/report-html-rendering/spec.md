# report-html-rendering Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Render report input and status
The system SHALL render an English-language HTML page where users can submit a YouTube URL, test Gemini setup separately, and see current generation or diagnostic status without navigating away.

#### Scenario: Page loads
- **WHEN** a user opens the application root page
- **THEN** the system displays a YouTube URL input, a submit control, a Gemini test control, and an empty report area

#### Scenario: Generation status updates
- **WHEN** the browser receives report progress events
- **THEN** the page updates the visible English report status for the current generation step

#### Scenario: Submit starts state notifications
- **WHEN** a user submits a YouTube URL
- **THEN** the page immediately displays a generation state notification before report content is available

#### Scenario: Backend state changes
- **WHEN** the browser receives report state or progress events for validation, caption fetching, transcript preparation, Gemini generation, streaming, completion, retry, or errors
- **THEN** the page displays a simple English loading state before report content renders and concise English completion, cancellation, retry, or error notifications afterward

#### Scenario: Caption kind is known
- **WHEN** the selected caption track is manually authored or auto-generated
- **THEN** the page displays an English label indicating whether captions are manual or auto-generated

### Requirement: Render streamed Simplified Chinese summary structure
The system SHALL progressively render Simplified Chinese report title, subtitle, sections, and speaker-labeled summary paragraphs as typed stream events arrive.

#### Scenario: Title and subtitle arrive
- **WHEN** the browser receives title and subtitle report events
- **THEN** the page renders Simplified Chinese title and subtitle content immediately in the report header area

#### Scenario: Section content arrives
- **WHEN** the browser receives section report events
- **THEN** the page appends or updates Simplified Chinese section headings immediately in report order

#### Scenario: Summary paragraph arrives
- **WHEN** the browser receives summary paragraph events
- **THEN** the page renders each paragraph as a speaker-labeled Simplified Chinese summary of transcript content rather than original transcript lines

### Requirement: Use typewriter-style incremental rendering
The system SHALL display streamed report text with a typewriter-style effect as content arrives, without waiting for the complete report.

#### Scenario: First report content arrives
- **WHEN** the browser receives the first summary paragraph event
- **THEN** the page begins displaying that paragraph incrementally before receiving a complete event

#### Scenario: Stream arrives faster than rendering
- **WHEN** report events arrive faster than the typewriter effect can display them
- **THEN** the page queues the content and renders it in order without dropping report content

#### Scenario: Reduced motion is preferred
- **WHEN** the user environment indicates reduced motion preference
- **THEN** the page disables or shortens the typewriter effect while still rendering streamed content incrementally

#### Scenario: User skips animation
- **WHEN** the user clicks the skip animation control
- **THEN** the page immediately renders queued report content and disables the typewriter effect for the current report

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
The system SHALL render Gemini preflight diagnostic state and result in English without using the report content area.

#### Scenario: User clicks Gemini test button
- **WHEN** the user clicks the Gemini test button
- **THEN** the page opens the Gemini preflight SSE stream
- **AND** displays an English checking state

#### Scenario: Gemini test succeeds
- **WHEN** the browser receives a successful Gemini preflight event
- **THEN** the page displays an English success notification
- **AND** does not create report title, section, paragraph, or caption elements

#### Scenario: Gemini test fails
- **WHEN** the browser receives a sanitized Gemini preflight error event
- **THEN** the page displays an English error notification
- **AND** leaves any existing report content unchanged

