import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Worker must match the library version exactly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
}

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
        if (yDiff < 5) { // 5 unit tolerance for same line
          return a.transform[4] - b.transform[4];
        }
        return b.transform[5] - a.transform[5]; // Top of page (higher Y) first
      });

      let pageText = `==Start of OCR for page ${pageIndex + 1}==\n`;
      let lastY = -1;
      let lastX = -1;
      let lastWidth = 0;

      items.forEach((item) => {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += "\n";
          lastX = -1;
        } else if (lastX !== -1) {
          // Calculate horizontal gap between end of previous item and start of current
          const currentX = item.transform[4];
          const previousEnd = lastX + lastWidth;
          const gap = currentX - previousEnd;

          // COLUMN DETECTION:
          // If the gap is large (> 15 units), assume it's a column break and force a newline.
          // This unwraps the 2-column layout into a linear list.
          if (gap > 15) {
            pageText += "\n";
          }
          // WORD SEPARATION:
          // Only add space if gap is significant (> 3.5 units).
          // This prevents splitting kerned numbers (e.g. "1 17" -> "117") while separating words.
          else if (gap > 3.5) {
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
