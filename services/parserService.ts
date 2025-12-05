import { StudentReport, ModuleGrade } from '../types';

export const parseOCRText = (text: string): StudentReport[] => {
  // Split content by the separator usually found in OCR streams or double newlines implying pages
  // The provided input has "==Start of OCR for page X=="
  const pages = text.split(/==Start of OCR for page \d+==/);
  
  const reports: StudentReport[] = [];

  pages.forEach((pageRaw) => {
    let page = pageRaw.trim();
    if (!page || page.length < 50) return;

    // --- NORMALIZATION STEP ---
    // Aggressively insert newlines before any Semester/Year pattern (e.g., HE/22, FR/24).
    // STRICTLY matches HE or FR followed by 2 digits.
    // This fixes issues where two columns are merged onto one line (e.g. "HE/22 ... 4.5 FR/24 ...")
    page = page.replace(/((?:HE|FR)\s*\/\s*\d{2})/g, '\n$1');

    // 1. Extract Name
    // Pattern 1: "für [Name]" (ignoring footer "für QV")
    // Pattern 2: "Name/Vorname [Name]"
    // Pattern 3: Standard header address block "Herr\n[Name]" or "Frau\n[Name]"
    const nameMatch = 
        page.match(/(?:^|\n)\s*für\s+(?!QV)(.+?)(\n|$)/i) || 
        page.match(/Name\/Vorname\s+(.+?)(\n|$)/i) ||
        page.match(/Herr\n(.+?)\n/) || 
        page.match(/Frau\n(.+?)\n/);
    
    const name = nameMatch ? nameMatch[1].trim() : "Unknown Student";

    // 2. Extract DOB
    const dobMatch = page.match(/Geburtsdatum\s+(\d{2}\.\d{2}\.\d{4})/);
    const dob = dobMatch ? dobMatch[1] : "Unknown";

    // 3. Extract Class
    const classMatch = page.match(/Klasse\s+(.+?)(\n|$)/);
    const classId = classMatch ? classMatch[1].trim() : "Unknown";

    // 4. Extract Company
    const companyMatch = page.match(/Lehrfirma\s+(.+?)(\n|$)/);
    const company = companyMatch ? companyMatch[1].trim() : "Unknown";

    // 5. Extract Profession (Beruf)
    const professionMatch = page.match(/Beruf\s+(.+?)(\n|$)/);
    const profession = professionMatch ? professionMatch[1].trim() : "Unknown";

    // 6. Extract Printed Average
    // Regex looks for "Durchschnitt Module ... 4.8"
    const avgMatch = page.match(/Durchschnitt Module.*?(\d\.\d)/);
    const printedAverage = avgMatch ? parseFloat(avgMatch[1]) : 0;

    // 7. Extract Modules (State Machine for Multi-line support)
    const modules: ModuleGrade[] = [];
    const lines = page.split('\n');
    
    // Pattern: HE/22 117 Module Name 4.5
    // Start Pattern: Semester (Group 1), ID (Group 2), Rest (Group 3)
    // Strict Regex: Only matches HE or FR followed by 2 digits (e.g. "HE / 22")
    const moduleStartRegex = /^((?:HE|FR)\s*\/\s*\d{2})\s+(\d{3})\s+(.*)/;
    
    // Grade Pattern: Ends with float (e.g. " 4.5")
    const gradeRegex = /\s+(\d\.\d)\s*$/;
    // Standalone Grade Pattern: Line is just "4.5"
    const standaloneGradeRegex = /^(\d\.\d)\s*$/;

    let currentModule: Partial<ModuleGrade> | null = null;
    let accumulatedName = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // GUARD: Stop processing if we hit the footer line
        // This prevents the average grade from being attached to the last module
        if (line.includes("Durchschnitt Module")) {
            currentModule = null;
            accumulatedName = "";
            continue;
        }

        const startMatch = line.match(moduleStartRegex);

        if (startMatch) {
            // New module found. 
            
            // Normalize semester (remove spaces e.g. "HE / 22" -> "HE/22")
            const semester = startMatch[1].replace(/\s+/g, '');
            const moduleId = startMatch[2];
            const rest = startMatch[3];

            // Check if grade is on this line
            const gradeMatch = rest.match(gradeRegex);
            if (gradeMatch) {
                // Single line module
                const grade = parseFloat(gradeMatch[1]);
                const moduleName = rest.substring(0, rest.lastIndexOf(gradeMatch[0])).trim();
                modules.push({ semester, moduleId, moduleName, grade });
                currentModule = null;
                accumulatedName = "";
            } else {
                // Multi-line module started
                currentModule = { semester, moduleId };
                accumulatedName = rest;
            }
        } else if (currentModule) {
            // We are inside a module, looking for continuation or grade
            
            const gradeOnlyMatch = line.match(standaloneGradeRegex);
            const endGradeMatch = line.match(gradeRegex);

            if (gradeOnlyMatch) {
                // Case: Line is just "4.5"
                const grade = parseFloat(gradeOnlyMatch[1]);
                modules.push({
                    semester: currentModule.semester!,
                    moduleId: currentModule.moduleId!,
                    moduleName: accumulatedName.trim(),
                    grade
                });
                currentModule = null;
                accumulatedName = "";
            } else if (endGradeMatch) {
                // Case: Line is "Description Part 2 4.5"
                const grade = parseFloat(endGradeMatch[1]);
                const textPart = line.substring(0, line.lastIndexOf(endGradeMatch[0])).trim();
                accumulatedName += " " + textPart;
                
                modules.push({
                    semester: currentModule.semester!,
                    moduleId: currentModule.moduleId!,
                    moduleName: accumulatedName.trim(),
                    grade
                });
                currentModule = null;
                accumulatedName = "";
            } else {
                // Case: Just more text description
                accumulatedName += " " + line;
            }
        }
    }

    // 8. Calculations
    // Use precise arithmetic mean
    const totalScore = modules.reduce((acc, curr) => acc + curr.grade, 0);
    const rawAvg = modules.length > 0 ? totalScore / modules.length : 0;
    
    // User requirement: Average of modules rounded to 0.1 accuracy
    const calculatedRoundedAvg = Math.round(rawAvg * 10) / 10;
    
    // Check strict equality of the rounded values
    const isValidAverage = Math.abs(calculatedRoundedAvg - printedAverage) < 0.001; 
    
    // Identify failing modules (Grade < 4.0)
    const failingModules = modules.filter(m => m.grade < 4.0);

    reports.push({
      id: crypto.randomUUID(),
      name,
      dob,
      classId,
      company,
      profession,
      modules,
      printedAverage,
      calculatedAverage: calculatedRoundedAvg,
      isValidAverage,
      failingModules,
      rawText: page
    });
  });

  return reports;
};