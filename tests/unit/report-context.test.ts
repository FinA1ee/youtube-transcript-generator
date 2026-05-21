import { describe, expect, it } from "vitest";
import { ReportContextStore, deriveReportChapters } from "../../src/reports/context";
import { AppError } from "../../src/shared/types";
import { hierarchicalReport, transcript } from "../fixtures/captions";

describe("ReportContextStore", () => {
  it("stores report generation context and derives level-1 chapters", () => {
    const store = new ReportContextStore({ createId: () => "ctx-1" });
    const context = store.create(transcript, { generationRequirements: "Study notes." });

    store.applyEvent(context.id, { type: "title", title: "产品讨论总结", subtitle: "副标题" });
    for (const heading of hierarchicalReport.headings ?? []) {
      store.applyEvent(context.id, { type: "heading", heading });
    }
    for (const section of hierarchicalReport.sections) {
      for (const paragraph of section.paragraphs) {
        store.applyEvent(context.id, {
          type: "summary_paragraph",
          sectionId: section.id,
          paragraph
        });
      }
    }

    const chapterContext = store.getChapterSummaryContext(context.id, "h1-intro");

    expect(chapterContext.reportContextId).toBe("ctx-1");
    expect(chapterContext.chapterTitle).toBe("开场与目标");
    expect(chapterContext.generationRequirements).toBe("Study notes.");
    expect(chapterContext.headings.map((heading) => heading.id)).toEqual([
      "h1-intro",
      "h2-context",
      "h3-detail"
    ]);
    expect(chapterContext.paragraphs).toHaveLength(1);
  });

  it("expires unavailable contexts", () => {
    let now = 1000;
    const store = new ReportContextStore({
      now: () => now,
      ttlMs: 100,
      createId: () => "ctx-expired"
    });
    const context = store.create(transcript);
    now = 1200;

    expect(() => store.get(context.id)).toThrow(AppError);
    expect(() => store.get(context.id)).toThrow("Report context is no longer available.");
  });

  it("prunes contexts when count limit is exceeded", () => {
    let id = 0;
    const store = new ReportContextStore({ maxContexts: 1, createId: () => `ctx-${String(++id)}` });
    const first = store.create(transcript);
    const second = store.create(transcript);

    expect(store.size()).toBe(1);
    expect(() => store.get(first.id)).toThrow(AppError);
    expect(store.get(second.id).id).toBe(second.id);
  });
});

describe("deriveReportChapters", () => {
  it("groups descendant headings and paragraphs under level-1 chapters", () => {
    const chapters = deriveReportChapters(hierarchicalReport);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]).toMatchObject({
      id: "h1-intro",
      title: "开场与目标"
    });
    expect(chapters[0]?.headings.map((heading) => heading.id)).toEqual([
      "h1-intro",
      "h2-context",
      "h3-detail"
    ]);
    expect(chapters[0]?.paragraphs.map((paragraph) => paragraph.id)).toEqual(["p-1"]);
  });
});
