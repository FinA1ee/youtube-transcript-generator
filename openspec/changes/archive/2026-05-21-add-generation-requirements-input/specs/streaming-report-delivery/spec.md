## MODIFIED Requirements

### Requirement: Use POST-capable streaming for report rendering
The system SHALL support starting report rendering with a request body containing the transcript handoff and optional sanitized generation requirements.

#### Scenario: Browser starts report stream
- **WHEN** transcript fetch has returned a valid transcript handoff
- **THEN** the browser sends the handoff in the report stream request body
- **AND** includes non-empty generation requirements when the user provided them
- **AND** the backend responds with a streaming event response for rendering

#### Scenario: Transcript handoff is too large for a query string
- **WHEN** the transcript handoff would be large or sensitive
- **THEN** the browser does not put it in the URL query string

#### Scenario: Generation requirements are omitted
- **WHEN** the browser starts report streaming without generation requirements
- **THEN** the backend starts the existing report stream from the transcript handoff

#### Scenario: Generation requirements are invalid
- **WHEN** the report stream request includes generation requirements with an unsupported shape or excessive length
- **THEN** the backend rejects the request with a sanitized validation error before calling Gemini

### Requirement: Protect the stream from secret leakage
The system SHALL never send Gemini API keys, TranscriptAPI keys, transcript token secrets, Cloudflare credentials, internal stack traces, raw provider error payloads, or raw generation requirement validation internals to the browser over the report stream.

#### Scenario: Provider error occurs
- **WHEN** an upstream provider fails with a detailed internal error
- **THEN** the system emits a sanitized user-visible error event

#### Scenario: Heading or title chunk is malformed
- **WHEN** Gemini returns malformed heading or title output
- **THEN** the system emits a sanitized generation error or skips the malformed chunk according to implementation policy

#### Scenario: Requirement validation fails
- **WHEN** generation requirement validation fails before streaming begins
- **THEN** the system returns a sanitized JSON error without echoing secrets or internal validation details
