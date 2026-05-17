## MODIFIED Requirements

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

## ADDED Requirements

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
