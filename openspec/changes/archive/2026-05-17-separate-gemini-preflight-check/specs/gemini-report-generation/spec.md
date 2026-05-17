## MODIFIED Requirements

### Requirement: Preflight Gemini setup before transcript content is sent
The system SHALL NOT run Gemini setup preflight automatically as part of report generation. Gemini setup preflight SHALL be available through the separate user-triggered Gemini preflight diagnostics capability.

#### Scenario: Report stream starts
- **WHEN** the report SSE stream starts with a valid YouTube URL
- **THEN** the system validates the URL and continues to transcript acquisition without calling Gemini preflight

#### Scenario: Report generation reaches Gemini
- **WHEN** transcript segments are available and the system starts report generation
- **THEN** the system sends the report-generation prompt to Gemini
- **AND** maps any Gemini setup, authentication, quota, rate-limit, model, network, or service failure to sanitized generation errors

#### Scenario: User wants to test Gemini setup
- **WHEN** the user wants to verify Gemini setup before report generation
- **THEN** the user uses the separate Gemini preflight diagnostics control
