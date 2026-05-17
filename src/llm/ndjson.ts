import { AppError, StreamEvent } from "../shared/types";

type NdjsonReportEvent =
  | { type: "title"; title: string; subtitle: string }
  | { type: "section"; id: string; heading: string }
  | { type: "heading"; id: string; level: 1 | 2 | 3; text: string; parentId?: string | undefined }
  | {
      type: "paragraph";
      sectionId: string;
      headingId?: string | undefined;
      speaker: string;
      text: string;
    };

export class NdjsonReportEventParser {
  private buffer = "";
  private paragraphIndex = 0;

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];
    let newlineIndex = this.buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const event = this.parseLine(line);
      if (event) {
        events.push(event);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }

    return events;
  }

  flush(): StreamEvent[] {
    if (this.buffer.trim().length === 0) {
      this.buffer = "";
      return [];
    }
    const event = this.parseLine(this.buffer);
    this.buffer = "";
    return event ? [event] : [];
  }

  private parseLine(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "```" || trimmed === "```json" || !trimmed.startsWith("{")) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      throw new AppError(
        "generation_validation_error",
        "Gemini returned malformed report chunks.",
        502
      );
    }

    const event = parseNdjsonReportEvent(parsed);
    if (event.type === "title") {
      return { type: "title", title: event.title, subtitle: event.subtitle };
    }
    if (event.type === "section") {
      return { type: "section", section: { id: event.id, heading: event.heading } };
    }
    if (event.type === "heading") {
      return {
        type: "heading",
        heading: {
          id: event.id,
          level: event.level,
          text: event.text,
          ...(event.parentId ? { parentId: event.parentId } : {})
        }
      };
    }

    this.paragraphIndex += 1;
    return {
      type: "summary_paragraph",
      sectionId: event.headingId ?? event.sectionId,
      paragraph: {
        id: `p-${String(this.paragraphIndex)}`,
        ...(event.headingId ? { headingId: event.headingId } : {}),
        text: `${event.speaker}: ${event.text}`
      }
    };
  }
}

function parseNdjsonReportEvent(value: unknown): NdjsonReportEvent {
  if (!isRecord(value) || typeof value["type"] !== "string") {
    throw invalidChunk();
  }

  if (value["type"] === "title") {
    const title = readString(value, "title");
    const subtitle = readString(value, "subtitle");
    return { type: "title", title, subtitle };
  }

  if (value["type"] === "section") {
    const id = readString(value, "id");
    const heading = readString(value, "heading");
    return { type: "section", id, heading };
  }

  if (value["type"] === "heading") {
    const id = readString(value, "id");
    const text = readString(value, "text");
    const level = readHeadingLevel(value["level"]);
    const parentId = typeof value["parentId"] === "string" ? value["parentId"].trim() : undefined;
    return {
      type: "heading",
      id,
      level,
      text,
      ...(parentId ? { parentId } : {})
    };
  }

  if (value["type"] === "paragraph") {
    const sectionId =
      typeof value["sectionId"] === "string" && value["sectionId"].trim()
        ? value["sectionId"].trim()
        : readString(value, "headingId");
    const headingId =
      typeof value["headingId"] === "string" && value["headingId"].trim()
        ? value["headingId"].trim()
        : undefined;
    const speaker = readString(value, "speaker");
    const text = readString(value, "text");
    return { type: "paragraph", sectionId, ...(headingId ? { headingId } : {}), speaker, text };
  }

  throw invalidChunk();
}

function readHeadingLevel(value: unknown): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw invalidChunk();
}

function readString(value: Record<string, unknown>, key: string): string {
  const raw = value[key];
  if (typeof raw !== "string" || raw.trim().length === 0 || raw.length > 8000) {
    throw invalidChunk();
  }
  return raw.trim();
}

function invalidChunk(): AppError {
  return new AppError(
    "generation_validation_error",
    "Gemini returned an invalid report chunk.",
    502
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
