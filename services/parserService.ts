import { StudentReport, ModuleGrade, AbuData, EgkData, EgkSemesterResult, AbuSemesterResult } from '../types';

const round05 = (num: number) => Math.round(num * 2) / 2;
const round01 = (num: number) => Math.round(num * 10) / 10;

// Helper to extract a list of grades from a line matching a label
const extractGradesFromLine = (text: string, labelRegex: RegExp): number[] => {
  const match = text.match(labelRegex);
  if (!match) return [];
  
  const content = text.substring(match.index! + match[0].length).split('\n')[0];
  const numberPattern = /\b[1-6]\.[05]\b/g;
  const numbers = content.match(numberPattern);
  
  return numbers ? numbers.map(n => parseFloat(n)) : [];
};

const extractGradesBlock = (page: string, startLabelRegex: RegExp, stopLabelRegex: RegExp): number[] => {
    const lines = page.split('\n');
    let capturing = false;
    let grades: number[] = [];

    for (const line of lines) {
        if (startLabelRegex.test(line)) {
            capturing = true;
            const inlineGrades = line.match(/\b[1-6]\.[05]\b/g);
            if (inlineGrades) {
                grades.push(...inlineGrades.map(n => parseFloat(n)));
            }
            continue;
        }

        if (capturing && stopLabelRegex.test(line)) {
            break;
        }

        if (capturing) {
            const hasGrade = /\b[1-6]\.[05]\b/.test(line);
            const hasText = /[a-z]/.test(line); 

            if (hasGrade && !hasText) {
                 const found = line.match(/\b[1-6]\.[05]\b/g);
                 if (found) {
                     grades.push(...found.map(n => parseFloat(n)));
                 }
            }
        }
    }
    return grades;
};

export const parseOCRText = (text: string): StudentReport[] => {
  const parts = text.split(/==Start of OCR for page (\d+)==/);
  const reports: StudentReport[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const pageNumStr = parts[i];
    let page = parts[i + 1].trim();
    
    if (!page || page.length < 50) continue;

    const pageNumber = parseInt(pageNumStr, 10);

    // 1. Metadata Extraction
    const nameMatch = 
        page.match(/(?:^|\n)\s*für\s+(?!QV)(.+?)(\n|$)/i) || 
        page.match(/Name\/Vorname\s+(.+?)(\n|$)/i) ||
        page.match(/Herr\n(.+?)\n/) || 
        page.match(/Frau\n(.+?)\n/);
    
    const name = nameMatch ? nameMatch[1].trim() : "Unknown Student";
    const dobMatch = page.match(/Geburtsdatum\s+(\d{2}\.\d{2}\.\d{4})/);
    const dob = dobMatch ? dobMatch[1] : "Unknown";
    const classMatch = page.match(/Klasse\s+(.+?)(\n|$)/) || page.match(/Klasse\n(.+?)\n/);
    const classId = classMatch ? classMatch[1].trim() : "Unknown";
    const companyMatch = page.match(/Lehrfirma\s+(.+?)(\n|$)/);
    const company = companyMatch ? companyMatch[1].trim() : "Unknown";
    const professionMatch = page.match(/Beruf\s+(.+?)(\n|$)/);
    const profession = professionMatch ? professionMatch[1].trim() : "Unknown";
    const avgMatch = page.match(/Durchschnitt Module.*?(\d\.\d)/);
    const printedAverage = avgMatch ? parseFloat(avgMatch[1]) : 0;

    // 2. ABU & EGK Extraction
    let abuData: AbuData | undefined;
    const abuAvgMatch = page.match(/Allgemeinbildender Unterricht\s+(\d\.\d)/);
    if (abuAvgMatch) {
      const abuPrintedAvg = parseFloat(abuAvgMatch[1]);
      let spracheGrades = extractGradesBlock(page, /Sprache.*?Kommunikation/, /Gesellschaft/);
      let gesellschaftGrades = extractGradesBlock(page, /Gesellschaft/, /Erweiterte/);
      
      const semesterResults: AbuSemesterResult[] = [];
      const allAbuGrades: number[] = [];
      const maxSemesters = Math.max(spracheGrades.length, gesellschaftGrades.length);

      for (let k = 0; k < maxSemesters; k++) {
          const s = spracheGrades[k];
          const g = gesellschaftGrades[k];
          if (s !== undefined) allAbuGrades.push(s);
          if (g !== undefined) allAbuGrades.push(g);
          semesterResults.push({ sprache: s, gesellschaft: g });
      }

      const abuCalced = allAbuGrades.length > 0 ? round05(allAbuGrades.reduce((a,b) => a+b, 0) / allAbuGrades.length) : 0;
      abuData = { printedAverage: abuPrintedAvg, calculatedAverage: abuCalced, isValid: Math.abs(abuCalced - abuPrintedAvg) < 0.1, semesterResults };
    }

    let egkData: EgkData | undefined;
    const egkAvgMatch = page.match(/Erweiterte Grundkompetenzen\s+(\d\.\d)/);
    if (egkAvgMatch) {
      const egkPrintedAvg = parseFloat(egkAvgMatch[1]);
      let englishGrades = extractGradesBlock(page, /Englisch/, /Mathematik/);
      let mathGrades = extractGradesBlock(page, /Mathematik/, /Semesterdurchschnitt/);
      let semesterAvgGrades = extractGradesBlock(page, /Semesterdurchschnitt EGK/, /Wirtschaft/);

      const semesterResults: EgkSemesterResult[] = [];
      for (let k = 0; k < semesterAvgGrades.length; k++) {
        const printedSem = semesterAvgGrades[k];
        const eng = englishGrades[k];
        const math = mathGrades[k];
        let calc = 0;
        if (eng !== undefined && math !== undefined) calc = round05((eng + math) / 2);
        else calc = eng ?? math ?? 0;

        semesterResults.push({ english: eng, math: math, printedSemAvg: printedSem, calculatedSemAvg: calc, isValid: Math.abs(calc - printedSem) < 0.1 });
      }

      const egkCalced = semesterResults.length > 0 ? round05(semesterResults.reduce((a,b) => a + b.printedSemAvg, 0) / semesterResults.length) : 0;
      egkData = { printedAverage: egkPrintedAvg, calculatedAverage: egkCalced, isValid: Math.abs(egkCalced - egkPrintedAvg) < 0.1, semesterResults };
    }

    // 3. Module Extraction (Overhauled for robust detection)
    const modules: ModuleGrade[] = [];
    const lines = page.split('\n');
    const modHeaderRegex = /([A-Z]{2}\s*\/\s*\d{2})\s+(\d{3})/;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j].trim();
      const match = line.match(modHeaderRegex);
      
      if (match) {
        const semester = match[1].replace(/\s+/g, '');
        const moduleId = match[2];
        let grade: number | undefined = undefined;
        let name = line.substring(match.index! + match[0].length).trim();
        
        // Inline Grade Check
        const inlineGrade = name.match(/\b[1-6]\.[05]\b/);
        if (inlineGrade) {
          grade = parseFloat(inlineGrade[0]);
          name = name.replace(inlineGrade[0], "").trim();
        } else {
          // Lookahead Grade Check (for multi-line or column layouts)
          for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
            const nextLine = lines[k].trim();
            if (modHeaderRegex.test(nextLine) || nextLine.includes("Durchschnitt Module")) break;
            const nextGrade = nextLine.match(/^\s*([1-6]\.[05])\s*$/);
            if (nextGrade) {
              grade = parseFloat(nextGrade[1]);
              break;
            }
          }
        }

        name = name.replace(/\s+/g, " ").trim();
        modules.push({ semester, moduleId, moduleName: name || `Module ${moduleId}`, grade });
      }
    }

    // Final Report Assembly
    const gradedModules = modules.filter(m => m.grade !== undefined);
    const calculatedAverage = gradedModules.length > 0 ? round01(gradedModules.reduce((a, b) => a + (b.grade || 0), 0) / gradedModules.length) : 0;
    const isValidAverage = Math.abs(calculatedAverage - printedAverage) < 0.11; 
    const failingModules = gradedModules.filter(m => (m.grade || 0) < 4.0);

    reports.push({
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${pageNumber}`,
      name, dob, classId, company, profession, modules,
      printedAverage, calculatedAverage, isValidAverage, failingModules,
      rawText: page, pageNumber, abu: abuData, egk: egkData
    });
  }

  return reports;
};