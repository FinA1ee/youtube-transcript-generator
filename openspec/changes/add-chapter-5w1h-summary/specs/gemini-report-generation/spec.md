## MODIFIED Requirements

### Requirement: Produce a validated report model
The system SHALL parse Gemini output into streamable report content containing a Simplified Chinese title, Simplified Chinese subtitle, ordered hierarchical chapter headings, and Simplified Chinese speaker-labeled summary paragraphs, while applying lightweight shape validation needed to keep the UI stable.

#### Scenario: Structured output is valid
- **WHEN** Gemini returns output matching the streamable report chunk schema
- **THEN** the system emits typed title, heading, paragraph, and completion events

#### Scenario: Heading output is valid
- **WHEN** Gemini returns a heading event with id, text, and level 1, 2, or 3
- **THEN** the system accepts the heading and emits it for incremental rendering
- **AND** treats level-1 headings as chapter boundaries

#### Scenario: Heading output level is invalid
- **WHEN** Gemini returns a heading event with a level outside 1, 2, or 3
- **THEN** the system rejects or clamps the heading according to implementation policy without exposing provider internals

#### Scenario: Paragraph references heading
- **WHEN** Gemini returns a paragraph event
- **THEN** the system associates it with a heading when a heading id is provided

#### Scenario: Output contains verbatim transcript dump
- **WHEN** Gemini output directly reproduces original transcript lines instead of summarizing them
- **THEN** the system reports a generation validation error instead of completing the report

## ADDED Requirements

### Requirement: Build chapter 5W1H summary prompts
The system SHALL build a chapter 5W1H prompt from server-saved full video context and the selected chapter context.

#### Scenario: Chapter prompt is created
- **WHEN** a valid chapter 5W1H request is accepted
- **THEN** the system creates an English prompt containing bounded full video context and selected chapter context
- **AND** asks Gemini to answer Who, What, When, Where, Why, and How for that chapter in Simplified Chinese

#### Scenario: Prompt uses server context
- **WHEN** the system creates a chapter 5W1H prompt
- **THEN** it uses the transcript/report context saved on the server
- **AND** does not rely on article content submitted by the browser

#### Scenario: Prompt cannot answer a field
- **WHEN** the available context does not support a 5W1H answer
- **THEN** the prompt instructs Gemini to use a stable unavailable value instead of inventing details

### Requirement: Parse structured chapter 5W1H output
The system SHALL parse Gemini chapter 5W1H output into structured fields for fixed-format rendering.

#### Scenario: Valid 5W1H output is returned
- **WHEN** Gemini returns JSON with `who`, `what`, `when`, `where`, `why`, and `how`
- **THEN** the backend validates and returns those fields to the browser

#### Scenario: 5W1H output is malformed
- **WHEN** Gemini returns prose, Markdown, missing fields, or invalid JSON for a chapter 5W1H request
- **THEN** the backend returns a sanitized generation validation error instead of rendering the malformed result

#### Scenario: Provider fails during 5W1H
- **WHEN** Gemini returns quota, authentication, model, network, or service failure during chapter 5W1H generation
- **THEN** the backend maps the failure to existing sanitized Gemini error behavior
