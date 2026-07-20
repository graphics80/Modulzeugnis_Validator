import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Worker must match the library version exactly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
}

// Text-flattening tuning: how the 2D PDF text layer is linearised into lines.
// Y_LINE_TOLERANCE is used both to group items onto a line (sort) and to decide
// line breaks (emit) — they must stay identical or items sort onto one line but
// split across two.
const Y_LINE_TOLERANCE = 5; // items within this Y distance are the same line
const COLUMN_GAP = 15;      // X gap above this = column break → newline
const WORD_GAP = 3.5;       // X gap above this = word break → space

export const extractTextFromPDF = async (buffer: ArrayBuffer): Promise<string> => {
  // pdf.js transfers the buffer to its worker (detaching it), so hand over a copy
  const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
  const pdf = await loadingTask.promise;

  try {
    const contents = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1).then(page => page.getTextContent())
      )
    );

    let fullText = "";

    contents.forEach((content, pageIndex) => {
      // PDF.js returns items in render order, which might not be reading order.
      // We filter for actual text items (ignoring TextMarkedContent)
      const items = content.items.filter((item: any) => item.str !== undefined) as TextItem[];

      // Sort items: Primary by Y (descending, top to bottom), Secondary by X (ascending, left to right)
      // We use a tolerance for Y to group items on the "same line"
      items.sort((a, b) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff < Y_LINE_TOLERANCE) {
          return a.transform[4] - b.transform[4];
        }
        return b.transform[5] - a.transform[5]; // Top of page (higher Y) first
      });

      let pageText = `==Start of OCR for page ${pageIndex + 1}==\n`;
      let lastY = -1;
      let lastX = -1;
      let lastWidth = 0;

      items.forEach((item) => {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > Y_LINE_TOLERANCE) {
          pageText += "\n";
          lastX = -1;
        } else if (lastX !== -1) {
          // Calculate horizontal gap between end of previous item and start of current
          const currentX = item.transform[4];
          const previousEnd = lastX + lastWidth;
          const gap = currentX - previousEnd;

          // COLUMN DETECTION: a large gap is a column break → newline, unwrapping
          // the 2-column layout into a linear list.
          if (gap > COLUMN_GAP) {
            pageText += "\n";
          }
          // WORD SEPARATION: a significant (but sub-column) gap is a space. Kept
          // above kerning noise so "1 17" doesn't split into "1 17" vs "117".
          else if (gap > WORD_GAP) {
            pageText += " ";
          }
        }
        pageText += item.str;
        lastY = item.transform[5];
        lastX = item.transform[4];
        lastWidth = item.width;
      });

      fullText += pageText + "\n\n";
    });

    return fullText;
  } finally {
    pdf.destroy();
  }
};

// Per-buffer cache: avoids re-parsing the source PDF on every "View PDF" click
// and lets us revoke stale blob URLs when a new file is loaded.
let sliceCache: { buffer: ArrayBuffer; doc: Promise<PDFDocument>; urls: Map<number, string> } | null = null;

/**
 * Creates a Blob URL for a single page of the PDF
 */
export const slicePdfPage = async (pdfBuffer: ArrayBuffer, pageNumber: number): Promise<string> => {
  if (sliceCache?.buffer !== pdfBuffer) {
    sliceCache?.urls.forEach(url => URL.revokeObjectURL(url));
    sliceCache = { buffer: pdfBuffer, doc: PDFDocument.load(pdfBuffer), urls: new Map() };
  }

  const cachedUrl = sliceCache.urls.get(pageNumber);
  if (cachedUrl) return cachedUrl;

  const srcDoc = await sliceCache.doc;

  if (pageNumber < 1 || pageNumber > srcDoc.getPageCount()) {
    throw new Error(`Invalid page number ${pageNumber}`);
  }

  const newDoc = await PDFDocument.create();
  const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNumber - 1]);
  newDoc.addPage(copiedPage);

  const pdfBytes = await newDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  sliceCache.urls.set(pageNumber, url);
  return url;
};

/**
 * Builds a new PDF containing only the given 1-based pages of the source PDF,
 * in ascending page order. Used to split a multi-class file into one PDF per
 * class. Reuses the per-buffer slice cache so the source is parsed only once.
 */
export const buildClassPdf = async (pdfBuffer: ArrayBuffer, pageNumbers: number[]): Promise<Uint8Array> => {
  if (sliceCache?.buffer !== pdfBuffer) {
    sliceCache?.urls.forEach(url => URL.revokeObjectURL(url));
    sliceCache = { buffer: pdfBuffer, doc: PDFDocument.load(pdfBuffer), urls: new Map() };
  }

  const srcDoc = await sliceCache.doc;
  const pageCount = srcDoc.getPageCount();
  const indices = [...new Set(pageNumbers)]
    .filter(n => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b)
    .map(n => n - 1);

  if (indices.length === 0) throw new Error('No valid pages for this class');

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, indices);
  copied.forEach(page => newDoc.addPage(page));
  return newDoc.save();
};

/**
 * Releases the cached PDF document and revokes its blob URLs. Call on reset so
 * the previous file's bytes and object URLs don't linger for the whole session.
 */
export const disposeSliceCache = (): void => {
  sliceCache?.urls.forEach(url => URL.revokeObjectURL(url));
  sliceCache = null;
};
