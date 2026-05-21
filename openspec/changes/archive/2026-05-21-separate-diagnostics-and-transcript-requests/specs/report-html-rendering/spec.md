## MODIFIED Requirements

### Requirement: Render report input and status
The system SHALL render an English-language HTML page where users can submit a YouTube URL, test Gemini setup separately, fetch transcript readiness, and see current generation or diagnostic status without navigating away.

#### Scenario: Page loads
- **WHEN** a user opens the application root page
- **THEN** the system displays a YouTube URL input, a submit control, a Gemini test control, and an empty report area

#### Scenario: Generation status updates
- **WHEN** the browser receives report stream events
- **THEN** the page updates the visible English report status for the current generation step

#### Scenario: Submit starts transcript fetch
- **WHEN** a user submits a YouTube URL
- **THEN** the page immediately displays an English transcript-fetching notification
- **AND** sends a standalone transcript fetch request before opening the report stream

#### Scenario: Transcript fetch succeeds
- **WHEN** the standalone transcript fetch request returns a valid transcript handoff
- **THEN** the page starts the report rendering stream

#### Scenario: Backend state changes
- **WHEN** standalone preflight, standalone transcript fetch, or report stream state changes occur
- **THEN** the page displays concise English loading, completion, cancellation, retry, or error notifications for the current step

#### Scenario: Caption kind is known
- **WHEN** the selected caption track is manually authored or auto-generated
- **THEN** the page displays an English label indicating whether captions are manual or auto-generated

### Requirement: Render Gemini preflight diagnostics
The system SHALL render Gemini preflight diagnostic state and result in English without using the report content area.

#### Scenario: User clicks Gemini test button
- **WHEN** the user clicks the Gemini test button
- **THEN** the page sends a standalone Gemini preflight request
- **AND** displays an English checking state

#### Scenario: Gemini test succeeds
- **WHEN** the standalone preflight request returns success
- **THEN** the page displays an English success notification
- **AND** does not create report title, section, paragraph, or caption elements

#### Scenario: Gemini test fails
- **WHEN** the standalone preflight request returns a sanitized Gemini error
- **THEN** the page displays an English error notification
- **AND** leaves any existing report content unchanged

