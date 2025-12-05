import * as pdfjsLib from 'pdfjs-dist';

// Set worker source explicitly to the same version as the library
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
  hasEOL: boolean;
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
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

    let pageText = `==Start of OCR for page ${pageNum}==\n`;
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
  }

  return fullText;
};