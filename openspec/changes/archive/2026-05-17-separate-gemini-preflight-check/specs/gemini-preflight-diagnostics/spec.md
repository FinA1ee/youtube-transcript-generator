## ADDED Requirements

### Requirement: User-triggered Gemini preflight
The system SHALL provide a separate user-triggered control for testing whether the configured Gemini API call is valid.

#### Scenario: User starts preflight
- **WHEN** the user clicks the Gemini test button
- **THEN** the browser opens the dedicated Gemini preflight SSE stream
- **AND** does not require or send a YouTube URL

#### Scenario: Preflight uses no user content
- **WHEN** the backend runs the Gemini preflight
- **THEN** it sends only the tiny setup-check prompt
- **AND** it does not send any YouTube URL, caption segment, transcript text, report prompt, or report content

### Requirement: Stream Gemini preflight result
The system SHALL stream Gemini preflight progress and terminal result over SSE.

#### Scenario: Preflight succeeds
- **WHEN** Gemini accepts the setup-check call and returns the expected diagnostic output
- **THEN** the SSE stream emits a success result
- **AND** the browser shows an English success notification

#### Scenario: Preflight fails
- **WHEN** Gemini authentication, quota, rate-limit, model availability, network, service, or output validation fails during preflight
- **THEN** the SSE stream emits a sanitized error event
- **AND** the browser shows an English error notification

#### Scenario: Preflight stream completes
- **WHEN** the preflight emits success or error
- **THEN** the browser closes the diagnostic SSE connection
- **AND** restores the test button to an idle state

### Requirement: Keep preflight diagnostics separate from report rendering
The system SHALL keep Gemini preflight diagnostic results out of the report rendering area.

#### Scenario: Preflight fails with an existing report visible
- **WHEN** a Gemini preflight error occurs while report content is already visible
- **THEN** the browser preserves existing report content
- **AND** updates only the diagnostic status or notification area

#### Scenario: Preflight succeeds before report generation
- **WHEN** the Gemini preflight succeeds before the user submits a YouTube URL
- **THEN** the browser displays the diagnostic success
- **AND** does not create report title, section, paragraph, or caption elements
