import { StudentReport, ModuleGrade, AbuData, EgkData, EgkSemesterResult, AbuSemesterResult } from '../types';
import { average, isFailing, isGraded, matchesPrinted, round01, round05, MODULE_AVG_TOLERANCE } from '../utils/grades';

// Swiss grade token: 1.0–6.0 in half-grade steps.
const GRADE = '[1-6]\\.[05]';
const GRADE_TOKEN = new RegExp(`\\b${GRADE}\\b`);
const GRADE_TOKEN_ALL = new RegExp(`\\b${GRADE}\\b`, 'g');
const STANDALONE_GRADE = new RegExp(`^(${GRADE})$`);

const firstMatch = (page: string, regexes: RegExp[], fallback = 'Unknown'): string => {
  for (const re of regexes) {
    const m = page.match(re);
    if (m) return m[1].trim();
  }
  return fallback;
};

const extractGradesBlock = (lines: string[], startLabelRegex: RegExp, stopLabelRegex: RegExp): number[] => {
    let capturing = false;
    const grades: number[] = [];

    for (const line of lines) {
        if (startLabelRegex.test(line)) {
            capturing = true;
            const inlineGrades = line.match(GRADE_TOKEN_ALL);
            if (inlineGrades) {
                grades.push(...inlineGrades.map(n => parseFloat(n)));
            }
            continue;
        }

        if (capturing && stopLabelRegex.test(line)) {
            break;
        }

        // Grade rows carry only numbers; any lowercase text means a label/description line
        if (capturing && !/[a-z]/.test(line)) {
            const found = line.match(GRADE_TOKEN_ALL);
            if (found) {
                grades.push(...found.map(n => parseFloat(n)));
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
    const page = parts[i + 1].trim();

    if (!page || page.length < 50) continue;

    const pageNumber = parseInt(pageNumStr, 10);
    const lines = page.split('\n');

    // 1. Metadata Extraction
    const name = firstMatch(page, [
        /(?:^|\n)\s*für\s+(?!QV)(.+?)(\n|$)/i,
        /Name\/Vorname\s+(.+?)(\n|$)/i,
        /Herr\n(.+?)\n/,
        /Frau\n(.+?)\n/,
    ], "Unknown Student");
    const dob = firstMatch(page, [/Geburtsdatum\s+(\d{2}\.\d{2}\.\d{4})/]);
    const classId = firstMatch(page, [/Klasse\s+(.+?)(\n|$)/, /Klasse\n(.+?)\n/]);
    const company = firstMatch(page, [/Lehrfirma\s+(.+?)(\n|$)/]);
    const profession = firstMatch(page, [/Beruf\s+(.+?)(\n|$)/]);
    const avgMatch = page.match(/Durchschnitt Module.*?(\d\.\d)/);
    const printedAverage = avgMatch ? parseFloat(avgMatch[1]) : 0;

    // 2. ABU & EGK Extraction
    let abuData: AbuData | undefined;
    const abuAvgMatch = page.match(/Allgemeinbildender Unterricht\s+(\d\.\d)/);
    if (abuAvgMatch) {
      const abuPrintedAvg = parseFloat(abuAvgMatch[1]);
      const spracheGrades = extractGradesBlock(lines, /Sprache.*?Kommunikation/, /Gesellschaft/);
      const gesellschaftGrades = extractGradesBlock(lines, /Gesellschaft/, /Erweiterte/);

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

      const abuCalced = round05(average(allAbuGrades));
      abuData = { printedAverage: abuPrintedAvg, calculatedAverage: abuCalced, isValid: matchesPrinted(abuCalced, abuPrintedAvg), semesterResults };
    }

    let egkData: EgkData | undefined;
    const egkAvgMatch = page.match(/Erweiterte Grundkompetenzen\s+(\d\.\d)/);
    if (egkAvgMatch) {
      const egkPrintedAvg = parseFloat(egkAvgMatch[1]);
      const englishGrades = extractGradesBlock(lines, /Englisch/, /Mathematik/);
      const mathGrades = extractGradesBlock(lines, /Mathematik/, /Semesterdurchschnitt/);
      const semesterAvgGrades = extractGradesBlock(lines, /Semesterdurchschnitt EGK/, /Wirtschaft/);

      const semesterResults: EgkSemesterResult[] = [];
      for (let k = 0; k < semesterAvgGrades.length; k++) {
        const printedSem = semesterAvgGrades[k];
        const eng = englishGrades[k];
        const math = mathGrades[k];
        let calc = 0;
        if (eng !== undefined && math !== undefined) calc = round05((eng + math) / 2);
        else calc = eng ?? math ?? 0;

        semesterResults.push({ english: eng, math: math, printedSemAvg: printedSem, isValid: matchesPrinted(calc, printedSem) });
      }

      const egkCalced = round05(average(semesterResults.map(r => r.printedSemAvg)));
      egkData = { printedAverage: egkPrintedAvg, calculatedAverage: egkCalced, isValid: matchesPrinted(egkCalced, egkPrintedAvg), semesterResults };
    }

    // 3. Module Extraction (Overhauled for robust detection)
    const modules: ModuleGrade[] = [];
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
        const inlineGrade = name.match(GRADE_TOKEN);
        if (inlineGrade) {
          grade = parseFloat(inlineGrade[0]);
          name = name.replace(inlineGrade[0], "").trim();
        } else {
          // Lookahead Grade Check (for multi-line or column layouts)
          for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
            const nextLine = lines[k].trim();
            if (modHeaderRegex.test(nextLine) || nextLine.includes("Durchschnitt Module")) break;
            const nextGrade = nextLine.match(STANDALONE_GRADE);
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
    const gradedModules = modules.filter(isGraded);
    const calculatedAverage = round01(average(gradedModules.map(m => m.grade!)));
    const isValidAverage = matchesPrinted(calculatedAverage, printedAverage, MODULE_AVG_TOLERANCE);
    const failingModules = modules.filter(isFailing);

    reports.push({
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${pageNumber}`,
      name, dob, classId, company, profession, modules,
      printedAverage, calculatedAverage, isValidAverage, failingModules,
      pageNumber, abu: abuData, egk: egkData
    });
  }

  return reports;
};
