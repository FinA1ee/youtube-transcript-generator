## ADDED Requirements

### Requirement: Discover usable caption tracks
The system SHALL discover available subtitle or caption tracks for the canonical YouTube video identifier and select a usable manually authored or auto-generated track in the video's default caption language for report generation.

#### Scenario: Captions are available
- **WHEN** the target video exposes at least one supported caption track
- **THEN** the system selects a caption track and continues transcript acquisition

#### Scenario: Default language captions are available
- **WHEN** the target video exposes supported caption tracks in multiple languages
- **THEN** the system selects a supported caption track from the video's default caption language without applying any additional language preference

#### Scenario: Auto-generated captions are available
- **WHEN** the target video exposes a supported auto-generated caption track and no preferred manually authored track is available
- **THEN** the system selects the auto-generated caption track and continues transcript acquisition

#### Scenario: Captions are unavailable
- **WHEN** the target video exposes no supported caption tracks
- **THEN** the system returns a typed transcript unavailable error without calling Gemini

### Requirement: Parse caption content into transcript segments
The system SHALL parse fetched caption data into ordered, strongly typed transcript segments containing text, timing, language when known, caption kind, and speaker information when available.

#### Scenario: Caption data is parsed
- **WHEN** fetched caption data contains timed subtitle entries
- **THEN** the system creates typed transcript segments in playback order with normalized text, timing, language, and caption kind

#### Scenario: Parser output is untyped
- **WHEN** caption parsing cannot produce valid typed transcript segments
- **THEN** the system reports a transcript parsing error without calling Gemini

#### Scenario: Speaker information is absent
- **WHEN** caption data does not identify a speaker for a segment
- **THEN** the system marks the segment speaker as unknown rather than inventing a speaker

### Requirement: Enforce transcript generation limits
The system SHALL reject videos longer than 100 minutes and transcripts that exceed the configured maximum segment count or token budget before sending content to Gemini.

#### Scenario: Video duration is too long
- **WHEN** the target video duration is greater than 100 minutes
- **THEN** the system reports a transcript size error without calling Gemini

#### Scenario: Transcript is too large
- **WHEN** a parsed transcript exceeds the configured generation limit
- **THEN** the system reports a transcript size error without calling Gemini

### Requirement: Avoid raw transcript persistence
The system SHALL avoid persisting raw fetched captions or full transcript text in source-controlled files, durable storage, or application logs during the initial report flow.

#### Scenario: Transcript is processed
- **WHEN** the system fetches and parses captions for a request
- **THEN** it keeps transcript content in request scope only and does not log the full transcript
