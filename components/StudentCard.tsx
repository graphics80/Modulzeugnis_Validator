import React, { useState } from 'react';
import { StudentReport, GradeSection, AbuSemesterResult, EgkSemesterResult } from '../types';
import { slicePdfPage } from '../services/pdfService';
import { formatGrade, isFailing } from '../utils/grades';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentIcon,
  AcademicCapIcon,
  CalculatorIcon
} from '@heroicons/react/24/solid';

interface Props {
  student: StudentReport;
  pdfBuffer: ArrayBuffer | null;
}

interface SectionRow<T> {
  label: string;
  className?: string;
  cell: (result: T, index: number) => React.ReactNode;
}

interface SectionPanelProps<T> {
  title: string;
  icon: React.ReactNode;
  data: GradeSection<T>;
  rows: SectionRow<T>[];
}

// Shared panel for the ABU / EGK curriculum sections
function SectionPanel<T>({ title, icon, data, rows }: SectionPanelProps<T>) {
  return (
    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center">
          {icon} {title}
        </h4>
        <div className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${data.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
           {formatGrade(data.printedAverage)}
           {data.isValid ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3"/>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="text-gray-400 border-b border-gray-200">
              <th className="text-left font-normal pb-1">Sem</th>
              {data.semesterResults.map((_, i) => <th key={i} className="font-normal pb-1 px-1">{i+1}</th>)}
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {rows.map(row => (
              <tr key={row.label} className={row.className}>
                <td className="text-left py-1 text-gray-500">{row.label}</td>
                {data.semesterResults.map((r, i) => row.cell(r, i))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!data.isValid && (
           <div className="text-right text-xs text-red-600 mt-2 font-medium">Calc Final: {formatGrade(data.calculatedAverage)}</div>
      )}
    </div>
  );
}

const StudentCard: React.FC<Props> = ({ student, pdfBuffer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);

  const hasFailingGrades = student.failingModules.length > 0;
  const isAverageCorrect = student.isValidAverage;
  const pnabModules = student.modules.filter(m => m.pnab);

  const abuInvalid = !!student.abu && !student.abu.isValid;
  const egkInvalid = !!student.egk && !student.egk.isValid;
  const abuEgkInvalid = abuInvalid || egkInvalid;
  // Semester only explainable by re-sorting the year-graded Mathematik columns.
  const egkAmbiguous = !!student.egk?.semesterResults.some(r => r.status === 'ambiguous');
  // EGK subject rows only carry meaning for the Informatiker layout (Englisch +
  // Mathematik); the Mediamatiker certificate is validated on the semester average.
  const egkHasSubjects = !!student.egk?.semesterResults.some(r => r.english !== undefined || r.math !== undefined);

  // Hard errors (red) win over ambiguous/Pnab (amber) in the list highlight.
  const ringClass = abuEgkInvalid
    ? 'border-red-400 ring-2 ring-red-200'
    : (egkAmbiguous || pnabModules.length > 0)
      ? 'border-amber-400 ring-2 ring-amber-200'
      : 'border-gray-200';

  const handleOpenPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pdfBuffer || !student.pageNumber) return;

    setIsOpeningPdf(true);
    try {
        const url = await slicePdfPage(pdfBuffer, student.pageNumber);
        window.open(url, '_blank');
    } catch (err) {
        console.error("Failed to open PDF slice", err);
        alert("Could not generate PDF for this student.");
    } finally {
        setIsOpeningPdf(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden mb-4 transition-all hover:shadow-md ${ringClass}`}>
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{student.name}</h3>
            <div className="text-sm text-gray-500 mt-1 space-y-1">
              <p>DOB: {student.dob} • Class: {student.classId}</p>
              <p className="font-medium text-gray-700">{student.company}</p>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {student.hasModules && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${
                isAverageCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <span>Avg: {formatGrade(student.printedAverage)}</span>
                {!isAverageCorrect && (
                   <span className="text-xs opacity-75">(Calc: {formatGrade(student.calculatedAverage)})</span>
                )}
                {isAverageCorrect ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
              </div>
            )}

            {student.abu && (
              <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold ${
                abuInvalid ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`} title="Allgemeinbildender Unterricht">
                <span>ABU: {formatGrade(student.abu.printedAverage)}</span>
                {abuInvalid && <span className="text-xs opacity-75">(Calc: {formatGrade(student.abu.calculatedAverage)})</span>}
                {abuInvalid ? <XCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
              </div>
            )}

            {student.egk && (
              <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold ${
                egkInvalid ? 'bg-red-100 text-red-800' : egkAmbiguous ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
              }`} title={egkAmbiguous ? 'EGK: Semester nur durch Umsortieren der Mathematik-Noten erklärbar — prüfen' : 'Erweiterte Grundkompetenzen'}>
                <span>EGK: {formatGrade(student.egk.printedAverage)}</span>
                {egkInvalid && <span className="text-xs opacity-75">(Calc: {formatGrade(student.egk.calculatedAverage)})</span>}
                {egkInvalid ? <XCircleIcon className="w-4 h-4" /> : egkAmbiguous ? <ExclamationTriangleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
              </div>
            )}

            {hasFailingGrades && (
              <div className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>{student.failingModules.length} Failed</span>
              </div>
            )}

            {pnabModules.length > 0 && (
              <div className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800" title={`Prüfung nicht absolviert: ${pnabModules.map(m => m.moduleId).join(', ')}`}>
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>{pnabModules.length} Pnab</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-4 flex justify-between items-center border-t border-gray-100 pt-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
                {isExpanded ? (
                    <><ChevronUpIcon className="w-4 h-4 mr-1"/> Hide Details</>
                ) : (
                    <><ChevronDownIcon className="w-4 h-4 mr-1"/> Show Details</>
                )}
            </button>

            {pdfBuffer && student.pageNumber && (
                <button
                    onClick={handleOpenPdf}
                    disabled={isOpeningPdf}
                    className="flex items-center text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                    <DocumentIcon className="w-4 h-4 mr-1" />
                    {isOpeningPdf ? 'Opening...' : 'View PDF'}
                </button>
            )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
            <div className="mt-4 space-y-6">

                {/* Additional Curriculum (ABU & EGK) */}
                {(student.abu || student.egk) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {student.abu && (
                      <SectionPanel<AbuSemesterResult>
                        title="ABU (Allgemein)"
                        icon={<AcademicCapIcon className="w-3 h-3 mr-1" />}
                        data={student.abu}
                        rows={[
                          { label: 'Sprache', cell: (r, i) => <td key={i} className="px-1">{formatGrade(r.sprache)}</td> },
                          { label: 'Gesell', cell: (r, i) => <td key={i} className="px-1">{formatGrade(r.gesellschaft)}</td> },
                        ]}
                      />
                    )}

                    {student.egk && (
                      <SectionPanel<EgkSemesterResult>
                        title="EGK (Erweitert)"
                        icon={<CalculatorIcon className="w-3 h-3 mr-1" />}
                        data={student.egk}
                        rows={[
                          ...(egkHasSubjects ? [
                            { label: 'Eng', cell: (r: EgkSemesterResult, i: number) => <td key={i} className="px-1">{formatGrade(r.english)}</td> },
                            { label: 'Mat', cell: (r: EgkSemesterResult, i: number) => <td key={i} className="px-1">{formatGrade(r.math)}</td> },
                          ] : []),
                          {
                            label: egkHasSubjects ? 'Avg' : 'Sem-Ø',
                            className: 'border-t border-gray-200 font-medium bg-white',
                            cell: (r: EgkSemesterResult, i: number) => (
                              <td key={i} className={`px-1 ${
                                r.status === 'invalid' ? 'text-red-600 bg-red-50'
                                : r.status === 'ambiguous' ? 'text-amber-700 bg-amber-50'
                                : 'text-green-600'
                              }`} title={r.status === 'ambiguous' ? 'Nur durch Umsortieren der Mathematik-Noten erklärbar' : undefined}>
                                {formatGrade(r.printedSemAvg)}
                              </td>
                            ),
                          },
                        ]}
                      />
                    )}
                  </div>
                )}

                {/* Modules Table — omitted on the separate ABU/EGK certificate */}
                {student.modules.length > 0 && (
                <div className="overflow-hidden border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sem</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {student.modules.map((m, idx) => {
                              const failing = isFailing(m);
                              return (
                                <tr key={`${student.id}-m-${idx}`} className={m.pnab ? 'bg-orange-50' : failing ? 'bg-red-50' : ''}>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{m.semester}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900">
                                        <span className="font-mono text-gray-400 mr-2">{m.moduleId}</span>
                                        <span className="min-w-0 truncate block max-w-md">{m.moduleName}</span>
                                    </td>
                                    <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${
                                        m.pnab ? 'text-orange-700 font-bold' : failing ? 'text-red-600' : 'text-gray-900'
                                    }`}>
                                        {m.pnab ? 'Pnab' : formatGrade(m.grade)}
                                    </td>
                                </tr>
                              );
                          })}
                      </tbody>
                  </table>
                </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentCard;
