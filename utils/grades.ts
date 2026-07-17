import { ModuleGrade } from '../types';

export const round05 = (num: number) => Math.round(num * 2) / 2;
export const round01 = (num: number) => Math.round(num * 10) / 10;

export const average = (nums: number[]): number =>
  nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

// Module averages print at 0.1 precision, so tolerate one full rounding step of drift
export const MODULE_AVG_TOLERANCE = 0.11;

export const matchesPrinted = (calculated: number, printed: number, tolerance = 0.1): boolean =>
  Math.abs(calculated - printed) < tolerance;

export const isGraded = (m: ModuleGrade): boolean => m.grade !== undefined;

export const isFailing = (m: ModuleGrade): boolean => m.grade !== undefined && m.grade < 4.0;

export const formatGrade = (val: number | undefined, digits = 1): string =>
  val == null || isNaN(val) ? '-' : val.toFixed(digits);
