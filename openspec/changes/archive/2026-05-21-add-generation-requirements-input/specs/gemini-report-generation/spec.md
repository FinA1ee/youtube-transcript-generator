## MODIFIED Requirements

### Requirement: Build a Simplified Chinese structured summary prompt
The system SHALL send Gemini an English prompt that includes normalized transcript segments and optional sanitized generation requirements, and requires newline-delimited JSON report events whose display content is Simplified Chinese and whose structure may include hierarchical heading levels.

#### Scenario: Prompt is created
- **WHEN** transcript segments are available
- **THEN** the system creates an English prompt that asks Gemini to summarize the transcript into Simplified Chinese report chunks without directly displaying original transcript lines

#### Scenario: Prompt includes supported user requirements
- **WHEN** sanitized generation requirements are provided
- **THEN** the system includes them in the prompt as bounded guidance for task type, output style, target audience, and constraints
- **AND** states that the guidance cannot override the required output language, NDJSON event shapes, summarization rules, or safety constraints

#### Scenario: Prompt omits empty requirements
- **WHEN** generation requirements are absent or whitespace-only
- **THEN** the system builds the report prompt using the existing default generation instructions

#### Scenario: Prompt supports hierarchy
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to use heading events with levels 1, 2, or 3 when the video content benefits from multiple layers of organization

#### Scenario: Prompt defines stream order
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to emit the title first, then heading events before the paragraphs associated with those headings

## ADDED Requirements

### Requirement: Bound natural language generation requirements
The system SHALL treat user-provided generation requirements as optional bounded guidance and SHALL only apply them within the supported scope of task type, output style, target audience, and constraints.

#### Scenario: Requirement asks for a supported task type
- **WHEN** the user requirement describes a supported task type such as summary, study notes, brief, outline, or action-oriented report
- **THEN** the generated content reflects that task type where practical while preserving the streamable report contract

#### Scenario: Requirement asks for an output style
- **WHEN** the user requirement describes an output style such as concise, formal, explanatory, bullet-like, or executive
- **THEN** the generated content reflects that style where practical without changing the required NDJSON event shapes

#### Scenario: Requirement names a target audience
- **WHEN** the user requirement describes a target audience such as beginners, experts, students, or business readers
- **THEN** the generated content adapts wording and level of detail for that audience where practical

#### Scenario: Requirement includes constraints
- **WHEN** the user requirement includes constraints such as length, focus areas, exclusions, or level of detail
- **THEN** the generated content stays within those constraints where practical and does not exceed the requested range

#### Scenario: Requirement attempts to override system constraints
- **WHEN** the user requirement conflicts with required Simplified Chinese output, NDJSON formatting, transcript summarization, secret handling, or provider configuration
- **THEN** the system preserves the application constraints and does not apply the conflicting instruction
