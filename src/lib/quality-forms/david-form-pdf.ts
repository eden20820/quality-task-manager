import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";

export const FORM_FONT_SIZE = 12;
const height = 841.89, left = 36, width = 523.28, bottom = 778, lineHeight = 15;
type Cell = { text: string; bold?: boolean; shade?: boolean; image?: string; imageHeight?: number; minHeight?: number; align?: "center" | "right" };
export type FormCell = string | Cell;
type Direction = "rtl" | "ltr";
function tokens(text: string) { return text.split(/(\[X\]|\[ \])/).filter(Boolean); }
const measuredWidths = new WeakMap<PDFFont, Map<string, number>>();
function textWidth(font: PDFFont, value: string) {
  let cache = measuredWidths.get(font);
  if (!cache) { cache = new Map(); measuredWidths.set(font, cache); }
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  const width = font.widthOfTextAtSize(value, FORM_FONT_SIZE);
  cache.set(value, width); return width;
}
function layoutUnits(font: PDFFont, text: string) {
  return tokens(text).flatMap(token => /^\[(X| )\]$/.test(token)
    ? [{ text: token, checkbox: true, width: 12, leading: false, trailing: false }]
    : directionalTextLayout(token).runs.filter(run => run.text.trim()).map(run => {
      const value = run.text.trim();
      return { text: run.direction === "rtl" ? value.replace(/[()]/g, character => character === "(" ? ")" : "(") : value, checkbox: false, width: textWidth(font, value), leading: /^\s/.test(run.text), trailing: /\s$/.test(run.text) };
    }));
}
function measure(font: PDFFont, text: string) { const units = layoutUnits(font, text); return units.reduce((total, unit, index) => total + unit.width + (index < units.length - 1 && (unit.trailing || units[index + 1].leading) ? 3.5 : 0), 0); }
export function directionalTextLayout(value: string) {
  const characters = Array.from(value);
  const strong = characters.map((character): Direction | null => /\p{Script=Hebrew}/u.test(character) ? "rtl" : /[A-Za-z0-9]/.test(character) ? "ltr" : null);
  const baseDirection = strong.find((direction): direction is Direction => direction !== null) ?? "ltr";
  const parentheses: number[] = [];
  characters.forEach((character, index) => {
    if (character === "(") parentheses.push(index);
    else if (character === ")" && parentheses.length) {
      const opening = parentheses.pop()!;
      const direction = strong.slice(opening + 1, index).find(value => value !== null) ?? baseDirection;
      strong[opening] = direction; strong[index] = direction;
    }
  });
  const resolved = strong.map((direction, index) => {
    if (direction) return direction;
    for (let previous = index - 1; previous >= 0; previous--) if (strong[previous]) return strong[previous] as Direction;
    for (let next = index + 1; next < strong.length; next++) if (strong[next]) return strong[next] as Direction;
    return baseDirection;
  });
  const runs: Array<{ direction: Direction; text: string }> = [];
  characters.forEach((character, index) => { const last = runs.at(-1); if (last?.direction === resolved[index]) last.text += character; else runs.push({ direction: resolved[index], text: character }); });
  return { baseDirection, runs };
}

// Every text operation uses exactly 12 pt. Cells grow and wrap instead of shrinking.
export class DavidFormPdf {
  private page!: PDFPage;
  private top = 96;
  private padding = 5;
  private constructor(readonly pdf: PDFDocument, private regular: PDFFont, private bold: PDFFont, private logo: PDFImage, private title: string, private annex: string) { this.newPage(); }
  static async create(title: string, annex: string, options: { cellPadding?: number } = {}) {
    const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
    const [regular, bold, logo] = await Promise.all([readFile(path.join(process.cwd(), "assets/fonts/David.ttf")), readFile(path.join(process.cwd(), "assets/fonts/David-Bold.ttf")), readFile(path.join(process.cwd(), "public/caeli-logo.png"))]);
    const form = new DavidFormPdf(pdf, await pdf.embedFont(regular, { subset: true }), await pdf.embedFont(bold, { subset: true }), await pdf.embedPng(logo), title, annex);
    form.padding = Math.max(5, Math.min(12, options.cellPadding ?? 5));
    pdf.setTitle(title); pdf.setSubject(`נספח ${annex}`); return form;
  }
  private newPage() {
    this.page = this.pdf.addPage([595.28, height]); this.top = 96;
    this.page.drawImage(this.logo, { x: left, y: height - 70, width: 74, height: 52 });
    this.paint(this.title, left + 84, 58, width - 84, true);
  }
  private paint(text: string, x: number, top: number, available: number, bold = false, align = "center") {
    if (!text) return;
    const font = bold ? this.bold : this.regular;
    const layout = directionalTextLayout(text.replace(/\[(X| )\]/g, ""));
    const units = layoutUnits(font, text);
    const total = measure(font, text);
    const start = x + Math.max(0, align === "right" ? available - total : (available - total) / 2);
    let cursor = layout.baseDirection === "rtl" ? start + total : start;
    for (const [index, unit] of units.entries()) {
        const unitX = layout.baseDirection === "rtl" ? cursor - unit.width : cursor;
        if (unit.checkbox) {
          const y = height - top - 12;
          this.page.drawRectangle({ x: unitX + 1, y, width: 10, height: 10, borderColor: rgb(0, 0, 0), borderWidth: 0.7 });
          if (unit.text === "[X]") for (const reverse of [false, true]) this.page.drawLine({ start: { x: unitX + 3, y: y + (reverse ? 2 : 8) }, end: { x: unitX + 9, y: y + (reverse ? 8 : 2) }, thickness: 0.8 });
        } else this.page.drawText(unit.text, { x: unitX, y: height - top - FORM_FONT_SIZE, font, size: FORM_FONT_SIZE, color: rgb(0, 0, 0) });
      const gap = index < units.length - 1 && (unit.trailing || units[index + 1].leading) ? 3.5 : 0;
      cursor += (layout.baseDirection === "rtl" ? -1 : 1) * (unit.width + gap);
    }
  }
  private wrap(text: string, available: number, bold = false): string[] {
    const font = bold ? this.bold : this.regular;
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.match(/\[(X| )\]|\S+/g) ?? []) {
        if (current && measure(font, `${current} ${word}`) <= available) { current += ` ${word}`; continue; }
        if (current) { lines.push(current); current = ""; }
        for (const character of Array.from(word)) {
          if (current && measure(font, current + character) > available) { lines.push(current); current = ""; }
          current += character;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  async table(rows: FormCell[][], weights: number[], headers?: FormCell[]) {
    const sum = weights.reduce((a, b) => a + b, 0), widths = weights.map(weight => width * weight / sum);
    const render = async (source: FormCell[], header = false) => {
      const cells = source.map(cell => typeof cell === "string" ? { text: cell } : cell);
      const wrapped = cells.map((cell, index) => this.wrap(cell.text, widths[index] - 12, cell.bold || header));
      const lineCount = Math.max(1, ...wrapped.map(lines => lines.length));
      for (let offset = 0; offset < lineCount;) {
        const remaining = lineCount - offset;
        let count = Math.min(remaining, 40);
        const minimumHeight = offset === 0 ? Math.min(630, Math.max(0, ...cells.map(cell => cell.minHeight ?? 0))) : 0;
        const required = Math.max(cells.some(cell => cell.image) ? 38 : 25, minimumHeight, count * lineHeight + this.padding * 2);
        if (this.top + required > bottom) {
          this.newPage();
          if (!header && headers) await render(headers, true);
          count = Math.min(remaining, Math.floor((bottom - this.top - this.padding * 2) / lineHeight));
        }
        const rowHeight = Math.max(cells.some(cell => cell.image) ? 38 : 25, minimumHeight, count * lineHeight + this.padding * 2);
        let x = left;
        for (let index = 0; index < cells.length; index++) {
          const cell = cells[index];
          this.page.drawRectangle({ x, y: height - this.top - rowHeight, width: widths[index], height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 0.6, color: header || cell.shade ? rgb(0.94, 0.94, 0.94) : undefined });
          const lines = wrapped[index].slice(offset, offset + count);
          lines.forEach((line, lineIndex) => this.paint(line, x + 6, this.top + this.padding + lineIndex * lineHeight, widths[index] - 12, cell.bold || header, cell.align));
          if (cell.image && offset === 0) {
            const match = cell.image.match(/^data:image\/(png|jpeg);base64,(.+)$/);
            if (match) {
              // pdf-lib's JPEG reader uses the backing ArrayBuffer, so avoid pooled Buffer offsets.
              const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
              const image = await (match[1] === "jpeg" ? this.pdf.embedJpg(bytes) : this.pdf.embedPng(bytes));
              const scale = Math.min((widths[index] - 16) / image.width, Math.min(cell.imageHeight ?? 18, rowHeight - this.padding * 2) / image.height);
              const imageHeight = image.height * scale, imageWidth = image.width * scale;
              this.page.drawImage(image, { x: x + (widths[index] - imageWidth) / 2, y: height - this.top - (rowHeight + imageHeight) / 2, width: imageWidth, height: imageHeight });
            }
          }
          x += widths[index];
        }
        this.top += rowHeight; offset += count;
      }
    };
    if (headers) await render(headers, true);
    for (const row of rows) await render(row);
  }
  async section(title: string) { this.top += 10; if (this.top + 70 > bottom) this.newPage(); await this.table([[{ text: title, bold: true, shade: true }]], [1]); }
  startPage() { this.newPage(); }
  gap(points = 12) { this.top += points; }
  ensureSpace(points: number) { if (this.top + points > bottom) this.newPage(); }
  async finish() {
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      this.page = page;
      this.paint("נספח", left + 85, 809, 45, true);
      this.paint(this.annex, left, 809, 80, true);
      this.paint(`${index + 1} / ${pages.length}`, 495, 809, 64);
    });
    return Buffer.from(await this.pdf.save());
  }
}
