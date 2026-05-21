# transcript-acquisition Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Discover usable caption tracks
The system SHALL fetch available transcript content for a canonical YouTube video URL through a standalone server request before report streaming starts.

#### Scenario: Transcript is available
- **WHEN** the browser submits a YouTube URL to the transcript fetch endpoint
- **THEN** the backend fetches transcript content through the configured transcript provider
- **AND** the report stream has not started
- **AND** Gemini has not been called

#### Scenario: Default language transcript is returned
- **WHEN** the transcript provider returns transcript entries using its default language behavior
- **THEN** the system accepts the returned transcript without applying an additional language preference

#### Scenario: Captions are unavailable
- **WHEN** the transcript provider reports that transcript content is unavailable for the target video
- **THEN** the standalone transcript fetch request returns a typed transcript unavailable or transcript acquisition error without calling Gemini

#### Scenario: Provider quota or payment blocks access
- **WHEN** the transcript provider returns a quota, credit, payment, rate-limit, timeout, or temporary service failure
- **THEN** the standalone transcript fetch request returns a sanitized transcript provider error without calling Gemini

### Requirement: Parse caption content into transcript segments
The system SHALL map transcript provider response entries into ordered, strongly typed transcript segments containing text, timing when available, language when known, caption kind when known, and speaker information when available.

#### Scenario: Transcript data is parsed
- **WHEN** the transcript provider returns transcript entries with text, start, and duration fields
- **THEN** the system creates typed transcript segments in playback order with normalized text and available metadata
- **AND** the system has not called Gemini during parsing

#### Scenario: Provider response is malformed
- **WHEN** transcript provider output cannot be mapped into valid typed transcript segments
- **THEN** the standalone transcript fetch request returns a transcript parsing or provider response error without calling Gemini

#### Scenario: Speaker information is absent
- **WHEN** transcript provider output does not identify a speaker for a segment
- **THEN** the system marks the segment speaker as unknown rather than inventing a speaker

### Requirement: Enforce transcript generation limits
The system SHALL reject videos longer than 100 minutes when duration is known and transcripts that exceed the configured maximum segment count or token budget before returning a transcript handoff for report generation.

#### Scenario: Video duration is too long
- **WHEN** the target video duration is known and greater than 100 minutes
- **THEN** the standalone transcript fetch request reports a transcript size error without calling Gemini

#### Scenario: Transcript is too large
- **WHEN** a parsed transcript exceeds the configured generation limit
- **THEN** the standalone transcript fetch request reports a transcript size error without calling Gemini

#### Scenario: Video duration is unknown
- **WHEN** the transcript provider does not provide reliable video duration
- **THEN** the system enforces available transcript size and token-budget limits before returning a transcript handoff

### Requirement: Avoid raw transcript persistence
The system SHALL avoid persisting raw fetched captions or full transcript text in source-controlled files, durable storage, or application logs during the initial report flow.

#### Scenario: Transcript is processed
- **WHEN** the system fetches and parses captions for a request
- **THEN** it keeps transcript content in request scope or a short-lived signed handoff only
- **AND** it does not log the full transcript

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

### Requirement: Return transcript handoff for report streaming
The system SHALL return a short-lived server-verifiable transcript handoff from the standalone transcript fetch request.

#### Scenario: Transcript fetch succeeds
- **WHEN** the standalone transcript fetch request succeeds
- **THEN** the response includes an opaque transcript token or reference for report generation
- **AND** the response does not expose provider credentials or raw provider payloads

#### Scenario: Transcript token is expired or invalid
- **WHEN** report streaming starts with an expired or invalid transcript handoff
- **THEN** the system rejects the stream request before calling Gemini

