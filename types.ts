export interface ModuleGrade {
  semester: string;
  moduleId: string;
  moduleName: string;
  grade?: number; // Absent when the module appears in the PDF but is not yet graded
  pnab?: boolean; // "Prüfung nicht absolviert" — exam not taken, printed as "Pnab" instead of a grade
}

// Shared shape of a validated grade section (ABU, EGK, ...)
export interface GradeSection<T> {
  printedAverage: number;
  calculatedAverage: number;
  isValid: boolean;
  semesterResults: T[];
}

export interface AbuSemesterResult {
  sprache?: number;
  gesellschaft?: number;
}

export type AbuData = GradeSection<AbuSemesterResult>;

export interface EgkSemesterResult {
  english?: number;
  math?: number;
  printedSemAvg: number;
  // Valid when the printed semester average reconciles in natural column order
  // OR after re-assigning the year-graded Mathematik columns; invalid when no
  // assignment of the printed grades explains it.
  isValid: boolean;
}

export type EgkData = GradeSection<EgkSemesterResult>;

export interface StudentReport {
  id: string; // Unique ID usually derived from name
  name: string;
  dob: string; // Date of Birth
  classId: string;
  company: string;
  profession: string; // Beruf
  modules: ModuleGrade[];
  hasModules: boolean; // false for separate ABU/EGK certificates that carry no module grades
  printedAverage: number;
  calculatedAverage: number;
  isValidAverage: boolean;
  failingModules: ModuleGrade[];
  pageNumber: number; // 1-based page number in the original PDF
  abu?: AbuData;
  egk?: EgkData;
}
