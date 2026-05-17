import { describe, expect, it } from "vitest";
import { NdjsonReportEventParser } from "../../src/llm/ndjson";

describe("NdjsonReportEventParser", () => {
  it("parses complete title, heading, and paragraph lines", () => {
    const parser = new NdjsonReportEventParser();
    const events = parser.push(
      [
        '{"type":"title","title":"标题","subtitle":"副标题"}',
        '{"type":"heading","id":"h1","level":1,"text":"开场"}',
        '{"type":"heading","id":"h2","level":2,"parentId":"h1","text":"背景"}',
        '{"type":"paragraph","headingId":"h2","speaker":"旁白","text":"这里是总结。"}'
      ].join("\n") + "\n"
    );

    expect(events).toEqual([
      { type: "title", title: "标题", subtitle: "副标题" },
      { type: "heading", heading: { id: "h1", level: 1, text: "开场" } },
      { type: "heading", heading: { id: "h2", level: 2, parentId: "h1", text: "背景" } },
      {
        type: "summary_paragraph",
        sectionId: "h2",
        paragraph: { id: "p-1", headingId: "h2", text: "旁白: 这里是总结。" }
      }
    ]);
  });

  it("buffers split lines until a newline arrives", () => {
    const parser = new NdjsonReportEventParser();

    expect(parser.push('{"type":"title","title":"标')).toEqual([]);
    expect(parser.push('题","subtitle":"副标题"}\n')).toEqual([
      { type: "title", title: "标题", subtitle: "副标题" }
    ]);
  });

  it("flushes a trailing complete line", () => {
    const parser = new NdjsonReportEventParser();
    parser.push('{"type":"section","id":"s1","heading":"开场"}');

    expect(parser.flush()).toEqual([{ type: "section", section: { id: "s1", heading: "开场" } }]);
  });

  it("ignores markdown fences and non-json prose lines", () => {
    const parser = new NdjsonReportEventParser();

    expect(parser.push("```json\nSome note\n```\n")).toEqual([]);
  });

  it("rejects malformed json lines", () => {
    const parser = new NdjsonReportEventParser();

    expect(() => parser.push('{"type":"title"\n')).toThrow();
  });

  it("rejects unknown event types", () => {
    const parser = new NdjsonReportEventParser();

    expect(() => parser.push('{"type":"unknown"}\n')).toThrow();
  });

  it("rejects heading levels outside h1 to h3", () => {
    const parser = new NdjsonReportEventParser();

    expect(() => parser.push('{"type":"heading","id":"h4","level":4,"text":"过深"}\n')).toThrow();
  });

  it("keeps section chunks as a compatibility alias", () => {
    const parser = new NdjsonReportEventParser();
    parser.push('{"type":"section","id":"s1","heading":"开场"}');

    expect(parser.flush()).toEqual([{ type: "section", section: { id: "s1", heading: "开场" } }]);
  });
});
