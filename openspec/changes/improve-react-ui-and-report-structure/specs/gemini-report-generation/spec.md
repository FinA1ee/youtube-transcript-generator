## MODIFIED Requirements

### Requirement: Build a Simplified Chinese structured summary prompt
The system SHALL send Gemini an English prompt that includes normalized transcript segments and requires newline-delimited JSON report events whose display content is Simplified Chinese and whose structure may include hierarchical heading levels.

#### Scenario: Prompt is created
- **WHEN** transcript segments are available
- **THEN** the system creates an English prompt that asks Gemini to summarize the transcript into Simplified Chinese report chunks without directly displaying original transcript lines

#### Scenario: Prompt supports hierarchy
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to use heading events with levels 1, 2, or 3 when the video content benefits from multiple layers of organization

#### Scenario: Prompt defines stream order
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to emit the title first, then heading events before the paragraphs associated with those headings

### Requirement: Produce a validated report model
The system SHALL parse Gemini output into streamable report content containing a Simplified Chinese title, Simplified Chinese subtitle, ordered hierarchical headings, and Simplified Chinese speaker-labeled summary paragraphs, while applying lightweight shape validation needed to keep the UI stable.

#### Scenario: Structured output is valid
- **WHEN** Gemini returns output matching the streamable report chunk schema
- **THEN** the system emits typed title, heading, paragraph, and completion events

#### Scenario: Heading output is valid
- **WHEN** Gemini returns a heading event with id, text, and level 1, 2, or 3
- **THEN** the system accepts the heading and emits it for incremental rendering

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

### Requirement: Use hierarchical NDJSON report chunks
The system SHALL support newline-delimited JSON report chunks for title, heading, and paragraph events.

#### Scenario: Title event line
- **WHEN** Gemini emits `{"type":"title","title":"...","subtitle":"..."}`
- **THEN** the backend maps it to the typed title stream event

#### Scenario: Heading event line
- **WHEN** Gemini emits `{"type":"heading","id":"...","level":2,"parentId":"...","text":"..."}`
- **THEN** the backend maps it to the typed heading stream event

#### Scenario: Paragraph event line
- **WHEN** Gemini emits `{"type":"paragraph","headingId":"...","speaker":"...","text":"..."}`
- **THEN** the backend maps it to the typed summary paragraph stream event

