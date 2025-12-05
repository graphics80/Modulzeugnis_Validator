import React, { useState } from 'react';
import { StudentReport } from '../types';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/solid';

interface Props {
  student: StudentReport;
}

const StudentCard: React.FC<Props> = ({ student }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasFailingGrades = student.failingModules.length > 0;
  const isAverageCorrect = student.isValidAverage;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 transition-all hover:shadow-md">
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
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${
              isAverageCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <span>Avg: {student.printedAverage.toFixed(1)}</span>
              {!isAverageCorrect && (
                 <span className="text-xs opacity-75">(Calc: {student.calculatedAverage.toFixed(2)})</span>
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
        <div className="mt-4 flex space-x-3 border-t border-gray-100 pt-3">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
                {isExpanded ? (
                    <><ChevronUpIcon className="w-4 h-4 mr-1"/> Hide Modules</>
                ) : (
                    <><ChevronDownIcon className="w-4 h-4 mr-1"/> Show {student.modules.length} Modules</>
                )}
            </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
            <div className="mt-4">
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
                            <tr key={`${student.id}-m-${idx}`} className={m.grade < 4.0 ? 'bg-red-50' : ''}>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{m.semester}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">
                                    <span className="font-mono text-gray-400 mr-2">{m.moduleId}</span>
                                    {m.moduleName}
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${
                                    m.grade < 4.0 ? 'text-red-600' : 'text-gray-900'
                                }`}>
                                    {m.grade.toFixed(1)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentCard;