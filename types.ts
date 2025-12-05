export interface ModuleGrade {
  semester: string;
  moduleId: string;
  moduleName: string;
  grade: number;
}

export interface StudentReport {
  id: string; // Unique ID usually derived from name
  name: string;
  dob: string; // Date of Birth
  classId: string;
  company: string;
  profession: string; // Beruf
  modules: ModuleGrade[];
  printedAverage: number;
  calculatedAverage: number;
  isValidAverage: boolean;
  failingModules: ModuleGrade[];
  rawText: string;
  pageNumber: number; // 1-based page number in the original PDF
}

export interface ValidationSummary {
  totalStudents: number;
  validReports: number;
  flaggedReports: number;
  averageGradeOverall: number;
}

export enum ValidationStatus {
  VALID = 'VALID',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}