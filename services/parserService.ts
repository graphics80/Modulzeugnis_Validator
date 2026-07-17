import { StudentReport, ModuleGrade, AbuData, EgkData, EgkSemesterResult, AbuSemesterResult } from '../types';
import { average, isFailing, isGraded, matchesPrinted, round01, round05, MODULE_AVG_TOLERANCE } from '../utils/grades';

// Swiss grade token: 1.0–6.0 in half-grade steps.
const GRADE = '[1-6]\\.[05]';
const GRADE_TOKEN = new RegExp(`\\b${GRADE}\\b`);
const GRADE_TOKEN_ALL = new RegExp(`\\b${GRADE}\\b`, 'g');
const STANDALONE_GRADE = new RegExp(`^(${GRADE})$`);
// "Prüfung nicht absolviert" — printed in place of a grade
const PNAB = /\bPnab\b/i;

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

// EGK per-semester validation, position-independent.
//
// Englisch is graded every semester, so its flat-text order maps cleanly to the
// semester columns. Mathematik is also a per-semester grade, but it is not taught
// in every semester, so it carries fewer values than Englisch — and which semester
// it skips is lost when the PDF text layer is flattened (empty cells leave no
// marker). Pairing Englisch and Mathematik by index therefore misaligns every
// semester after the gap and falsely flags correct certificates.
//
// Instead: a printed semester average must be reachable from that semester's
// Englisch grade either alone (no Mathematik that semester) or combined with
// exactly one of the available Mathematik grades. Each Mathematik grade may back
// only one semester — enforced with a bipartite matching (Kuhn's algorithm) — so
// a semester is invalid only when no assignment can reconcile it.
const validateEgkSemesters = (english: number[], math: number[], printedAvg: number[]): boolean[] => {
  const n = printedAvg.length;
  // Without a complete Englisch row we can't pin each semester → not checkable.
  if (english.length !== n) return printedAvg.map(() => true);

  // Semesters not explained by Englisch alone must each claim a distinct Mathematik grade.
  const needMath: number[] = [];
  printedAvg.forEach((avg, i) => { if (!matchesPrinted(english[i], avg)) needMath.push(i); });

  const candidates = needMath.map(i =>
    math.map((m, mi) => (matchesPrinted(round05((english[i] + m) / 2), printedAvg[i]) ? mi : -1)).filter(mi => mi >= 0)
  );

  const matchOf: number[] = new Array(math.length).fill(-1); // math index → needMath slot
  const assign = (s: number, seen: boolean[]): boolean => {
    for (const mi of candidates[s]) {
      if (seen[mi]) continue;
      seen[mi] = true;
      if (matchOf[mi] === -1 || assign(matchOf[mi], seen)) { matchOf[mi] = s; return true; }
    }
    return false;
  };

  const valid = printedAvg.map(() => true);
  needMath.forEach((sem, s) => {
    if (!assign(s, new Array(math.length).fill(false))) valid[sem] = false;
  });
  return valid;
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
    // Class label is often absent on the ABU/EGK certificate; fall back to the
    // bare class code (e.g. "ME23 6a", "IA23 a") printed above the grade grid.
    const classId = firstMatch(page, [/Klasse\s+(.+?)(\n|$)/, /Klasse\n(.+?)\n/, /\b([A-Z]{2}\d{2}\s+\d?[a-z])\b/]);
    const company = firstMatch(page, [/Lehrfirma\s+(.+?)(\n|$)/]);
    // PDF text layer often separates the "Beruf" label from its value (column
    // sorting), so prefer the line carrying the EFZ/EBA profession title
    const profession = firstMatch(page, [
        /^(?:Beruf\s+)?([^\n]*\b(?:EFZ|EBA)\b[^\n]*)$/m,
        /Beruf\s+(.+?)(\n|$)/,
    ]);
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
      // The printed "Semesterdurchschnitt EGK" row is the reliable anchor across
      // all curricula (Sport follows it on the Mediamatiker ABU certificate).
      const semesterAvgGrades = extractGradesBlock(lines, /Semesterdurchschnitt EGK/, /Sport|Wirtschaft|Durchschnitt/);

      // Per-semester subject recomputation only holds for the Informatiker layout
      // (Englisch + Mathematik). Mediamatiker EGK lists more subjects (Französisch,
      // Betriebskommunikation, Marketingfachsprache) that begin in different
      // semesters; their columns can't be recovered from the flat text layer, so
      // only the overall average (mean of the printed semester averages) is checked.
      const hasMathRow = /\bMathematik\b/.test(page);
      const englishGrades = hasMathRow ? extractGradesBlock(lines, /Englisch/, /Mathematik/) : [];
      const mathGrades = hasMathRow ? extractGradesBlock(lines, /Mathematik/, /Semesterdurchschnitt/) : [];

      // Per-semester validity. Mathematik is a per-semester grade that isn't
      // taught every semester, so its missing column is lost when the text is
      // flattened and the natural column order is often wrong. A semester is
      // valid when the printed average reconciles EITHER in natural order OR
      // after re-assigning the year's Mathematik notes (see validateEgkSemesters):
      // the reorder recovers the true columns, so it is arithmetically correct.
      // Only a semester that no assignment can explain is a real error.
      const matchingValid = validateEgkSemesters(englishGrades, mathGrades, semesterAvgGrades);
      const englishComplete = englishGrades.length === semesterAvgGrades.length && englishGrades.length > 0;
      const semesterResults: EgkSemesterResult[] = semesterAvgGrades.map((printedSem, k) => {
        const eng = englishGrades[k];
        const math = mathGrades[k];
        // Not checkable per-semester from the flattened text → assume valid.
        let isValid = true;
        if (englishComplete && eng !== undefined) {
          const posCalc = math === undefined ? eng : round05((eng + math) / 2);
          isValid = matchesPrinted(posCalc, printedSem) || matchingValid[k];
        }
        return { english: eng, math, printedSemAvg: printedSem, isValid };
      });

      const egkCalced = round05(average(semesterAvgGrades));
      // Section is invalid when the overall average disagrees or any semester
      // can't be explained by any assignment of the printed grades.
      const egkValid = matchesPrinted(egkCalced, egkPrintedAvg) && semesterResults.every(r => r.isValid);
      egkData = { printedAverage: egkPrintedAvg, calculatedAverage: egkCalced, isValid: egkValid, semesterResults };
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
        let pnab = false;
        let name = line.substring(match.index! + match[0].length).trim();

        // Inline Grade Check
        const inlineGrade = name.match(GRADE_TOKEN);
        if (inlineGrade) {
          grade = parseFloat(inlineGrade[0]);
          name = name.replace(inlineGrade[0], "").trim();
        } else if (PNAB.test(name)) {
          pnab = true;
          name = name.replace(PNAB, "").trim();
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
            if (/^Pnab$/i.test(nextLine)) {
              pnab = true;
              break;
            }
          }
        }

        name = name.replace(/\s+/g, " ").trim();
        modules.push({ semester, moduleId, moduleName: name || `Module ${moduleId}`, grade, pnab: pnab || undefined });
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
      hasModules: gradedModules.length > 0,
      printedAverage, calculatedAverage, isValidAverage, failingModules,
      pageNumber, abu: abuData, egk: egkData
    });
  }

  return reports;
};
