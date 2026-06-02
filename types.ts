
export interface ModuleGrade {
  semester: string;
  moduleId: string;
  moduleName: string;
  grade?: number; // Made optional to support modules present in PDF but not yet graded
}

export interface AbuSemesterResult {
  sprache?: number;
  gesellschaft?: number;
}

export interface AbuData {
  printedAverage: number;
  calculatedAverage: number;
  isValid: boolean;
  semesterResults: AbuSemesterResult[];
}

export interface EgkSemesterResult {
  english?: number;
  math?: number;
  printedSemAvg: number;
  calculatedSemAvg: number;
  isValid: boolean;
}

export interface EgkData {
  printedAverage: number;
  calculatedAverage: number;
  isValid: boolean;
  semesterResults: EgkSemesterResult[];
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
  abu?: AbuData;
  egk?: EgkData;
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
