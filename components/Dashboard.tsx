import React, { useMemo } from 'react';
import { StudentReport } from '../types';
import StudentCard from './StudentCard';
import DropZone from './DropZone';
import { average, formatGrade } from '../utils/grades';
import { MODULE_NAMES, detectCurriculum } from '../services/curriculumService';
import {
  ChartBarIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  CheckIcon,
  CloudArrowUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Props {
  reports: StudentReport[];
  pdfBuffer: ArrayBuffer | null;
  isProcessing?: boolean;
  onNewFile: (file: File) => void;
  onReset: () => void;
}

type TileStatus = 'graded' | 'mentioned' | 'missing';

const TILE_STYLES: Record<TileStatus, { box: string; id: string; name: string }> = {
  graded: {
    box: 'bg-green-50 border-green-200 text-green-900',
    id: 'text-green-900',
    name: 'text-green-700/80',
  },
  mentioned: {
    box: 'bg-blue-50/30 border-blue-100 text-gray-500',
    id: 'text-blue-900/60',
    name: 'text-gray-400',
  },
  missing: {
    box: 'bg-white border-gray-100 text-gray-300',
    id: 'text-gray-300',
    name: 'text-gray-300/50',
  },
};

const Dashboard: React.FC<Props> = ({ reports, pdfBuffer, isProcessing, onNewFile, onReset }) => {
  const stats = useMemo(() => {
    const total = reports.length;
    const avgMismatch = reports.filter(r => !r.isValidAverage).length;
    const failingStudents = reports.filter(r => r.failingModules.length > 0).length;
    const globalAvg = average(reports.map(r => r.calculatedAverage));

    return { total, avgMismatch, failingStudents, globalAvg };
  }, [reports]);

  const curriculum = detectCurriculum(reports.length > 0 ? reports[0].profession : '');

  // Grades per module ID across all loaded reports, for the curriculum check
  const moduleGrades = useMemo(() => {
    const grades: Record<string, number[]> = {};
    reports.forEach(r => {
      r.modules.forEach(m => {
        if (!grades[m.moduleId]) grades[m.moduleId] = [];
        if (m.grade !== undefined) grades[m.moduleId].push(m.grade);
      });
    });
    return grades;
  }, [reports]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Validation Results</h1>
          <p className="text-gray-500 text-sm mt-1">Bildungszentrum Zürichsee • Informatik/Technik</p>
        </div>

        {/* Compact Integrated Drop Zone */}
        <div className="flex items-center gap-3">
            <button
                onClick={onReset}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
                Clear All
            </button>
            <DropZone
                onFile={onNewFile}
                isProcessing={isProcessing}
                className={(isDragging) => `
                    relative group px-4 py-3 rounded-lg border-2 border-dashed transition-all duration-200
                    flex items-center justify-center cursor-pointer min-w-[200px]
                    ${isDragging
                        ? 'border-indigo-500 bg-indigo-50 scale-105'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                    }
                    ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                {(isDragging) => isProcessing ? (
                    <div className="flex items-center gap-2">
                        <ArrowPathIcon className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span className="text-xs font-semibold text-indigo-700">Processing...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <CloudArrowUpIcon className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-indigo-700">
                            {isDragging ? 'Drop to Update' : 'Drag new PDF here'}
                        </span>
                    </div>
                )}
            </DropZone>
        </div>
      </div>

      {/* Curriculum Grid */}
      {curriculum && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
              <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2 text-indigo-600" />
              CURRICULUM CHECK: {curriculum.label}
            </h3>
            <span className="text-xs text-gray-500 font-medium">
               Verifying document content against expected semester plan
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {curriculum.plan.map((semBlock) => (
              <div key={semBlock.semester} className="bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">SEMESTER {semBlock.semester}</h4>
                <div className="space-y-2">
                  {semBlock.modules.map(modId => {
                    const grades = moduleGrades[modId];
                    const isMentioned = grades !== undefined;
                    const isGraded = isMentioned && grades.length > 0;
                    const status: TileStatus = isGraded ? 'graded' : isMentioned ? 'mentioned' : 'missing';
                    const style = TILE_STYLES[status];
                    const name = MODULE_NAMES[modId] || `Module ${modId}`;

                    return (
                      <div
                        key={modId}
                        className={`text-xs p-2 rounded-lg border transition-all duration-200 flex items-start gap-3 shadow-sm ${style.box}`}
                      >
                         <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-colors ${
                             isMentioned
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-transparent border-gray-200'
                         }`}>
                             {isMentioned && <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />}
                         </div>
                         <div className="min-w-0 flex-1">
                           <div className="flex justify-between items-baseline gap-1">
                             <span className={`font-bold ${style.id}`}>{modId}</span>
                             {isGraded && (
                               <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums">
                                 {formatGrade(average(grades))}
                               </span>
                             )}
                           </div>
                           <span className={`block truncate leading-tight mt-0.5 ${style.name}`} title={name}>
                             {name}
                           </span>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
                <UserGroupIcon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Reports Scanned</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
            <div className="p-3 rounded-full bg-indigo-50 text-indigo-600 mr-4">
                <ChartBarIcon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Calc Average</p>
                <p className="text-2xl font-bold text-gray-900">{stats.globalAvg.toFixed(2)}</p>
            </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
            <div className={`p-3 rounded-full mr-4 ${stats.failingStudents > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Students &lt; 4.0</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failingStudents}</p>
            </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
             <div className={`p-3 rounded-full mr-4 ${stats.avgMismatch > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                <ChartBarIcon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Bad Avg Calc</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgMismatch}</p>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {reports.map((report) => (
          <StudentCard key={report.id} student={report} pdfBuffer={pdfBuffer} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
