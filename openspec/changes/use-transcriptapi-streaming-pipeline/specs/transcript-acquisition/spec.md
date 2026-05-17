## MODIFIED Requirements

### Requirement: Discover usable caption tracks
The system SHALL use TranscriptAPI.com to fetch available transcript content for the canonical YouTube video URL without requiring YouTube OAuth, then continue report generation when usable transcript entries are returned.

#### Scenario: Transcript is available
- **WHEN** TranscriptAPI returns transcript entries for the target video
- **THEN** the system continues transcript acquisition
- **AND** the system has not called Gemini

#### Scenario: Default language transcript is returned
- **WHEN** TranscriptAPI returns transcript entries using its default language behavior
- **THEN** the system accepts the returned transcript without applying an additional language preference

#### Scenario: Captions are unavailable
- **WHEN** TranscriptAPI reports that transcript content is unavailable for the target video
- **THEN** the system returns a typed transcript unavailable or transcript acquisition error without calling Gemini

#### Scenario: Provider quota or payment blocks access
- **WHEN** TranscriptAPI returns a quota, credit, payment, rate-limit, timeout, or temporary service failure
- **THEN** the system returns a sanitized transcript provider error without calling Gemini

#### Scenario: OAuth would be required
- **WHEN** a YouTube caption access path would require YouTube OAuth
- **THEN** the system does not use that path
- **AND** reports that the transcript cannot be fetched by the supported TranscriptAPI method

### Requirement: Parse caption content into transcript segments
The system SHALL map TranscriptAPI response entries into ordered, strongly typed transcript segments containing text, timing when available, language when known, caption kind when known, and speaker information when available.

#### Scenario: TranscriptAPI data is parsed
- **WHEN** TranscriptAPI returns transcript entries with text, start, and duration fields
- **THEN** the system creates typed transcript segments in playback order with normalized text and available metadata
- **AND** the system has not called Gemini during parsing

#### Scenario: Provider response is malformed
- **WHEN** TranscriptAPI output cannot be mapped into valid typed transcript segments
- **THEN** the system reports a transcript parsing or provider response error without calling Gemini

#### Scenario: Speaker information is absent
- **WHEN** TranscriptAPI output does not identify a speaker for a segment
- **THEN** the system marks the segment speaker as unknown rather than inventing a speaker

### Requirement: Enforce transcript generation limits
The system SHALL reject videos longer than 100 minutes when duration is known and transcripts that exceed the configured maximum segment count or token budget before sending content to Gemini.

#### Scenario: Video duration is too long
- **WHEN** the target video duration is known and greater than 100 minutes
- **THEN** the system reports a transcript size error without calling Gemini

#### Scenario: Transcript is too large
- **WHEN** a parsed transcript exceeds the configured generation limit
- **THEN** the system reports a transcript size error without calling Gemini

#### Scenario: Video duration is unknown
- **WHEN** TranscriptAPI does not provide reliable video duration
- **THEN** the system enforces available transcript size and token-budget limits before calling Gemini

## ADDED Requirements

### Requirement: Isolate TranscriptAPI dependency
The system SHALL isolate TranscriptAPI usage behind a local transcript client interface and SHALL NOT expose TranscriptAPI-specific response types to report pipeline, Gemini, streaming, or browser modules.

#### Scenario: Pipeline requests transcript
- **WHEN** the report pipeline needs transcript content
- **THEN** it calls the local transcript client interface
- **AND** does not construct TranscriptAPI HTTP requests directly

#### Scenario: TranscriptAPI behavior changes
- **WHEN** TranscriptAPI changes output shape or returns an unexpected provider error
- **THEN** the adapter maps the response to typed transcript output or a typed sanitized transcript error

### Requirement: Protect TranscriptAPI credentials
The system SHALL keep TranscriptAPI credentials in server-side configuration only and SHALL NOT expose them to browser code, request URLs, SSE events, logs, or rendered errors.

#### Scenario: TranscriptAPI request is made
- **WHEN** the Worker calls TranscriptAPI
- **THEN** it sends the API key in the server-side Authorization header
- **AND** the key is not included in client-visible data

#### Scenario: TranscriptAPI key is missing
- **WHEN** transcript fetching starts without a configured TranscriptAPI key
- **THEN** the system reports a sanitized transcript configuration error without calling TranscriptAPI or Gemini

