## Context

The current app has a working Hono/Cloudflare backend, standalone preflight/transcript requests, signed transcript handoff, and fetch-based POST report streaming. The frontend is still an embedded HTML/CSS/JavaScript string in `src/client/assets.ts`, which keeps the first release simple but makes UI state, rendering polish, and hierarchical report display increasingly awkward.

The next improvement should stay compatible with Hono and Cloudflare Workers while moving the client to React for maintainable UI state, conditional controls, streamed rendering, and a stronger visual system.

## Goals / Non-Goals

**Goals:**
- Use React for the browser UI while keeping Hono as the backend/server.
- Add a modern, restrained theme suitable for an operational report-generation tool.
- Make status and error states visually obvious.
- Hide Gemini test controls except in configured test/dry-run UI mode.
- Show skip-animation only while streamed report rendering is active.
- Add a clear-content/new-link control.
- Support hierarchical report chunks with heading levels equivalent to h1/h2/h3.
- Stream title and heading text through the same incremental renderer used for paragraphs.

**Non-Goals:**
- Do not migrate to Next.js.
- Do not change TranscriptAPI, Gemini provider, or signed transcript handoff architecture.
- Do not add durable jobs, download/export, or authentication.
- Do not make the UI a marketing landing page.

## Decisions

### Use React + Vite as a client bundle served by Hono

Add a `src/client/react/` or similar frontend source tree and build it into static assets served by Hono. Vite is enough here because the app is a single-page tool and does not need Next.js routing, SSR, or server components.

Alternatives considered:
- Keep embedded vanilla JS: rejected because conditional workflow state, streamed rendering, and richer report layout are becoming hard to maintain.
- Next.js: rejected for this change because it adds deployment and routing complexity that the current Hono Worker does not need.

### Use Tailwind plus local shadcn-style components

Use Tailwind for layout/theme tokens and local component primitives inspired by shadcn/ui patterns: Button, Input, StatusBanner, Toolbar, ReportDocument, HeadingBlock, ParagraphBlock. Avoid depending on a generated component registry at runtime. Use lucide-react for icons if available during implementation.

The UI should feel like a focused work tool: dense but readable, clear control grouping, visible progress/status area, and a report area optimized for reading generated summaries. Avoid card-within-card layouts and decorative gradients.

### Gate Gemini test UI by configuration

The Gemini test button should be hidden unless a frontend-exposed flag enables diagnostic controls, for example `ENABLE_DIAGNOSTIC_CONTROLS=true` mapped to a safe client config value. The button remains useful for local testing/dry runs but should not clutter normal usage.

### Model report hierarchy explicitly

Extend the Gemini NDJSON chunk format so headings can include a level:

```json
{"type":"title","title":"...","subtitle":"..."}
{"type":"heading","id":"h1-intro","level":1,"text":"..."}
{"type":"heading","id":"h2-context","level":2,"parentId":"h1-intro","text":"..."}
{"type":"heading","id":"h3-detail","level":3,"parentId":"h2-context","text":"..."}
{"type":"paragraph","headingId":"h3-detail","speaker":"旁白","text":"..."}
```

The renderer maps level 1/2/3 to h1/h2/h3-like visual hierarchy inside the report body. The top report title remains the report document title; level 1 headings are major sections.

This replaces the previous flat `section`/`summary_paragraph` mental model over time, but the implementation may keep compatibility aliases during migration.

### Stream titles and headings incrementally

Title, subtitle, and heading text should enter the same typewriter queue as paragraph text. The report shell can create placeholder elements immediately, then fill their text progressively as stream events arrive.

## Risks / Trade-offs

- [Risk] Adding React/Vite increases build complexity. -> Mitigation: keep Hono backend unchanged, add clear scripts, and verify Worker dry-run after asset integration.
- [Risk] Tailwind setup can dominate the codebase with styling churn. -> Mitigation: centralize theme tokens and keep component primitives small.
- [Risk] Hierarchical chunks may be harder for Gemini to follow. -> Mitigation: provide explicit NDJSON examples, validate level/id/parent fields lightly, and allow fallback to level 1 when parent data is missing.
- [Risk] Streaming heading text can create layout movement. -> Mitigation: reserve stable spacing for heading blocks and use predictable typography.
- [Risk] Diagnostic button could disappear when needed. -> Mitigation: document the enable flag and default it for local development if desired.

## Migration Plan

1. Add React/Vite/Tailwind client build setup and Hono static serving for built assets.
2. Recreate the current workflow in React: transcript fetch, POST report stream, cancel, retry, skip animation, clear/new link.
3. Add themed components and prominent status banner.
4. Add diagnostic-control gating for Gemini test.
5. Update Gemini prompt and NDJSON parser to support `heading` chunks with levels and parent ids.
6. Update stream event types and report renderer for hierarchical headings.
7. Stream title and heading text through the typewriter queue.
8. Add tests for frontend asset config, conditional controls, hierarchy parsing, and streaming title/heading rendering.
9. Run unit/e2e tests, typecheck, lint, format, frontend build, and Wrangler dry-run.

## Open Questions

- What flag name should control diagnostic visibility? Proposed: `ENABLE_DIAGNOSTIC_CONTROLS`.
- Should local development show the Gemini test button by default, or should it be hidden unless explicitly enabled?
- Should heading levels be limited to 1-3 for now? Proposed: yes, reject or clamp anything outside 1-3.
