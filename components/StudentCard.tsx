
import React, { useState } from 'react';
import { StudentReport } from '../types';
import { slicePdfPage } from '../services/pdfService';
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

const StudentCard: React.FC<Props> = ({ student, pdfBuffer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);

  const hasFailingGrades = (student.failingModules || []).length > 0;
  const isAverageCorrect = !!student.isValidAverage;

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

  const safeFixed = (val: number | undefined, digits: number = 1) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return val.toFixed(digits);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 transition-all hover:shadow-md">
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{student.name || 'Unknown Student'}</h3>
            <div className="text-sm text-gray-500 mt-1 space-y-1">
              <p>DOB: {student.dob || 'N/A'} • Class: {student.classId || 'N/A'}</p>
              <p className="font-medium text-gray-700">{student.company || 'Private'}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-2">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${
              isAverageCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <span>Avg: {safeFixed(student.printedAverage)}</span>
              {!isAverageCorrect && (
                 <span className="text-xs opacity-75">(Calc: {safeFixed(student.calculatedAverage)})</span>
              )}
              {isAverageCorrect ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
            </div>

            {hasFailingGrades && (
              <div className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>{student.failingModules.length} Failed</span>
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
                    {/* ABU Section */}
                    {student.abu && (
                      <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center">
                            <AcademicCapIcon className="w-3 h-3 mr-1" /> ABU (Allgemein)
                          </h4>
                          <div className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${student.abu.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {safeFixed(student.abu.printedAverage)} 
                             {student.abu.isValid ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3"/>}
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right">
                            <thead>
                              <tr className="text-gray-400 border-b border-gray-200">
                                <th className="text-left font-normal pb-1">Sem</th>
                                {student.abu.semesterResults.map((_, i) => <th key={i} className="font-normal pb-1 px-1">{i+1}</th>)}
                              </tr>
                            </thead>
                            <tbody className="text-gray-700">
                              <tr>
                                <td className="text-left py-1 text-gray-500">Sprache</td>
                                {student.abu.semesterResults.map((r, i) => <td key={i} className="px-1">{safeFixed(r.sprache)}</td>)}
                              </tr>
                              <tr>
                                <td className="text-left py-1 text-gray-500">Gesell</td>
                                {student.abu.semesterResults.map((r, i) => <td key={i} className="px-1">{safeFixed(r.gesellschaft)}</td>)}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        
                        {!student.abu.isValid && (
                             <div className="text-right text-xs text-red-600 mt-2 font-medium">Calc Final: {safeFixed(student.abu.calculatedAverage)}</div>
                        )}
                      </div>
                    )}

                    {/* EGK Section */}
                    {student.egk && (
                      <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center">
                            <CalculatorIcon className="w-3 h-3 mr-1" /> EGK (Erweitert)
                          </h4>
                          <div className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${student.egk.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {safeFixed(student.egk.printedAverage)} 
                             {student.egk.isValid ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3"/>}
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right">
                            <thead>
                              <tr className="text-gray-400 border-b border-gray-200">
                                <th className="text-left font-normal pb-1">Sem</th>
                                {student.egk.semesterResults.map((_, i) => <th key={i} className="font-normal pb-1 px-1">{i+1}</th>)}
                              </tr>
                            </thead>
                            <tbody className="text-gray-700">
                              <tr>
                                <td className="text-left py-1 text-gray-500">Eng</td>
                                {student.egk.semesterResults.map((r, i) => <td key={i} className="px-1">{safeFixed(r.english)}</td>)}
                              </tr>
                              <tr>
                                <td className="text-left py-1 text-gray-500">Mat</td>
                                {student.egk.semesterResults.map((r, i) => <td key={i} className="px-1">{safeFixed(r.math)}</td>)}
                              </tr>
                              <tr className="border-t border-gray-200 font-medium bg-white">
                                <td className="text-left py-1 text-gray-500">Avg</td>
                                {student.egk.semesterResults.map((r, i) => (
                                  <td key={i} className={`px-1 ${r.isValid ? 'text-green-600' : 'text-red-600 bg-red-50'}`}>
                                    {safeFixed(r.printedSemAvg)}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {!student.egk.isValid && (
                             <div className="text-right text-xs text-red-600 mt-2 font-medium">Calc Final: {safeFixed(student.egk.calculatedAverage)}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Modules Table */}
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
                          {student.modules.map((m, idx) => (
                              <tr key={`${student.id}-m-${idx}`} className={m.grade !== undefined && m.grade < 4.0 ? 'bg-red-50' : ''}>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{m.semester}</td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                      <span className="font-mono text-gray-400 mr-2">{m.moduleId}</span>
                                      <span className="min-w-0 truncate block max-w-md">{m.moduleName}</span>
                                  </td>
                                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${
                                      m.grade !== undefined && m.grade < 4.0 ? 'text-red-600' : 'text-gray-900'
                                  }`}>
                                      {safeFixed(m.grade)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentCard;
