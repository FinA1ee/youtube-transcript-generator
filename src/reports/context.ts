import {
  AppError,
  ChapterId,
  ChapterSummaryContext,
  Report,
  ReportContextId,
  ReportGenerationOptions,
  ReportHeading,
  ReportParagraph,
  StreamEvent,
  Transcript
} from "../shared/types";

export interface ReportGenerationContext {
  id: ReportContextId;
  transcript: Transcript;
  generationRequirements?: string | undefined;
  report: Report;
  createdAt: number;
  updatedAt: number;
}

export interface ReportContextStoreOptions {
  now?: () => number;
  ttlMs?: number;
  maxContexts?: number;
  createId?: () => string;
}

const DEFAULT_CONTEXT_TTL_MS = 20 * 60 * 1000;
const DEFAULT_MAX_CONTEXTS = 50;

export class ReportContextStore {
  private readonly contexts = new Map<ReportContextId, ReportGenerationContext>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxContexts: number;
  private readonly createId: () => string;

  constructor(options: ReportContextStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_CONTEXT_TTL_MS;
    this.maxContexts = options.maxContexts ?? DEFAULT_MAX_CONTEXTS;
    this.createId = options.createId ?? createContextId;
  }

  create(transcript: Transcript, options: ReportGenerationOptions = {}): ReportGenerationContext {
    this.prune();
    const now = this.now();
    const context: ReportGenerationContext = {
      id: this.createUniqueId(),
      transcript,
      ...(options.generationRequirements
        ? { generationRequirements: options.generationRequirements }
        : {}),
      report: {
        title: "",
        subtitle: "",
        captionKind: transcript.captionKind,
        headings: [],
        sections: []
      },
      createdAt: now,
      updatedAt: now
    };
    this.contexts.set(context.id, context);
    this.prune();
    return context;
  }

  applyEvent(contextId: ReportContextId, event: StreamEvent): void {
    const context = this.contexts.get(contextId);
    if (!context) return;
    applyReportEvent(context.report, event);
    context.updatedAt = this.now();
  }

  get(contextId: ReportContextId): ReportGenerationContext {
    this.prune();
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new AppError(
        "report_context_unavailable",
        "Report context is no longer available.",
        404
      );
    }
    return context;
  }

  getChapterSummaryContext(
    contextId: ReportContextId,
    chapterId: ChapterId
  ): ChapterSummaryContext {
    const context = this.get(contextId);
    const chapter = deriveReportChapters(context.report).find((item) => item.id === chapterId);
    if (!chapter) {
      throw new AppError("generation_validation_error", "Chapter is not available.", 400);
    }
    return {
      reportContextId: context.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      transcript: context.transcript,
      ...(context.generationRequirements
        ? { generationRequirements: context.generationRequirements }
        : {}),
      reportTitle: context.report.title || undefined,
      reportSubtitle: context.report.subtitle || undefined,
      headings: chapter.headings,
      paragraphs: chapter.paragraphs
    };
  }

  size(): number {
    this.prune();
    return this.contexts.size;
  }

  private createUniqueId(): ReportContextId {
    for (;;) {
      const id = this.createId();
      if (!this.contexts.has(id)) return id;
    }
  }

  private prune(): void {
    const expiresBefore = this.now() - this.ttlMs;
    for (const [id, context] of this.contexts) {
      if (context.updatedAt < expiresBefore) {
        this.contexts.delete(id);
      }
    }
    while (this.contexts.size > this.maxContexts) {
      const oldest = [...this.contexts.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
      if (!oldest) return;
      this.contexts.delete(oldest.id);
    }
  }
}

export interface ReportChapterContext {
  id: ChapterId;
  title: string;
  headings: ReportHeading[];
  paragraphs: ReportParagraph[];
}

export function deriveReportChapters(report: Report): ReportChapterContext[] {
  const headings = report.headings ?? [];
  const chapters: ReportChapterContext[] = [];
  let current: ReportChapterContext | undefined;

  for (const heading of headings) {
    if (heading.level === 1) {
      current = {
        id: heading.id,
        title: heading.text,
        headings: [heading],
        paragraphs: []
      };
      chapters.push(current);
      continue;
    }
    if (current) {
      current.headings.push(heading);
    }
  }

  for (const chapter of chapters) {
    const headingIds = new Set(chapter.headings.map((heading) => heading.id));
    chapter.paragraphs = report.sections
      .filter((section) => headingIds.has(section.id))
      .flatMap((section) => section.paragraphs);
  }

  return chapters;
}

function applyReportEvent(report: Report, event: StreamEvent): void {
  if (event.type === "title") {
    report.title = event.title;
    report.subtitle = event.subtitle;
    return;
  }
  if (event.type === "heading") {
    report.headings ??= [];
    report.headings.push(event.heading);
    if (!report.sections.some((section) => section.id === event.heading.id)) {
      report.sections.push({ id: event.heading.id, heading: event.heading.text, paragraphs: [] });
    }
    return;
  }
  if (event.type === "section") {
    if (!report.sections.some((section) => section.id === event.section.id)) {
      report.sections.push({ ...event.section, paragraphs: [] });
    }
    return;
  }
  if (event.type === "summary_paragraph") {
    const section = report.sections.find((item) => item.id === event.sectionId);
    if (section) {
      section.paragraphs.push(event.paragraph);
    }
  }
}

function createContextId(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
