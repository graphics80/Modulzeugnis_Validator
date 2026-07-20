import React, { useMemo, useState } from 'react';
import { StudentReport } from '../types';
import StudentCard from './StudentCard';
import DropZone from './DropZone';
import { average, formatGrade } from '../utils/grades';
import { MODULE_NAMES, detectCurriculum } from '../services/curriculumService';
import { buildClassPdf } from '../services/pdfService';
import {
  ChartBarIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  CheckIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Props {
  reports: StudentReport[];
  pdfBuffer: ArrayBuffer | null;
  isProcessing?: boolean;
  onNewFile: (file: File) => void;
  onReset: () => void;
}

// Normalises a printed module title for comparison so that legitimate variants
// of the same module collapse to one string and only a genuinely different
// title deviates. Bilingual rows carry a "bili" marker and a
// "(zweisprachig d/e)" suffix, and the flattened text can prepend the module
// number to the title — all of that is stripped, along with digits and
// parentheticals (also the non-discriminating "(UIs)").
const normTitle = (s: string): string =>
  s.toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // drop parentheticals: (zweisprachig d/e), (UIs)
    .replace(/\bbili\b/g, ' ')
    .replace(/zweisprachig|d\s*\/\s*e/g, ' ') // fallback if the paren was truncated
    .replace(/[^a-zäöüß]+/g, ' ')         // strip digits, slashes and punctuation
    .replace(/\s+/g, ' ')
    .trim();

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
    box: 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-200',
    id: 'text-amber-900',
    name: 'text-amber-700',
  },
};

const Dashboard: React.FC<Props> = ({ reports, pdfBuffer, isProcessing, onNewFile, onReset }) => {
  const stats = useMemo(() => {
    const total = reports.length;
    // Module-average metrics ignore separate ABU/EGK certificates (no module grades).
    const moduleReports = reports.filter(r => r.hasModules);
    const avgMismatch = moduleReports.filter(r => !r.isValidAverage).length;
    const failingStudents = reports.filter(r => r.failingModules.length > 0).length;
    const globalAvg = average(moduleReports.map(r => r.calculatedAverage));

    return { total, avgMismatch, failingStudents, globalAvg, moduleCount: moduleReports.length };
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

  // Curriculum modules the plan expects but a class never lists — computed PER
  // class, because two classes in one file can differ (e.g. IMS IM25 a lists 426
  // but IM25 b does not). An aggregate check lets one class mask another's gap.
  const missingByClass = useMemo(() => {
    if (!curriculum) return [] as { classId: string; missing: string[] }[];
    const planIds = curriculum.plan.flatMap(s => s.modules);
    const byClass = new Map<string, Set<string>>();
    for (const r of reports) {
      let ids = byClass.get(r.classId);
      if (!ids) { ids = new Set(); byClass.set(r.classId, ids); }
      r.modules.forEach(m => ids!.add(m.moduleId));
    }
    return [...byClass.entries()]
      .map(([classId, ids]) => ({ classId, missing: planIds.filter(id => !ids.has(id)) }))
      .filter(e => e.missing.length > 0);
  }, [curriculum, reports]);

  // Modules missing in at least one class — these tiles go orange even if
  // another class has them (orange outranks green in the grid).
  const missingAnywhere = useMemo(
    () => new Set(missingByClass.flatMap(e => e.missing)),
    [missingByClass],
  );

  // Reports grouped by class, with their 1-based source pages, for the
  // per-class PDF split. Sorted so classes and pages come out in file order.
  const classGroups = useMemo(() => {
    const map = new Map<string, number[]>();
    reports.forEach(r => {
      if (!r.pageNumber) return;
      const pages = map.get(r.classId) ?? [];
      pages.push(r.pageNumber);
      map.set(r.classId, pages);
    });
    return [...map.entries()]
      .map(([classId, pages]) => ({ classId, pages: pages.sort((a, b) => a - b) }))
      .sort((a, b) => a.classId.localeCompare(b.classId, 'de'));
  }, [reports]);

  // Title/number consistency check. Two classes in one file print identical
  // module titles per number, so the majority title per moduleId is the
  // reference; a report whose title for a number deviates from that majority
  // has a mismatched title (swap or typo). Compared within the uploaded file,
  // not against the hand-typed catalog, whose wording differs from the print.
  const titleMismatches = useMemo(() => {
    const counts = new Map<string, Map<string, { count: number; display: string }>>();
    reports.forEach(r =>
      r.modules.forEach(m => {
        const norm = normTitle(m.moduleName);
        if (!norm || m.moduleName === `Module ${m.moduleId}`) return;
        let byNorm = counts.get(m.moduleId);
        if (!byNorm) { byNorm = new Map(); counts.set(m.moduleId, byNorm); }
        const entry = byNorm.get(norm) ?? { count: 0, display: m.moduleName };
        entry.count++;
        byNorm.set(norm, entry);
      }),
    );

    const majority = new Map<string, { norm: string; display: string }>();
    counts.forEach((byNorm, id) => {
      let best: { norm: string; display: string; count: number } | null = null;
      byNorm.forEach((v, norm) => {
        if (!best || v.count > best.count) best = { norm, display: v.display, count: v.count };
      });
      if (best) majority.set(id, { norm: best.norm, display: best.display });
    });

    return reports
      .map(r => ({
        report: r,
        bad: r.modules
          .filter(m => {
            const norm = normTitle(m.moduleName);
            if (!norm || m.moduleName === `Module ${m.moduleId}`) return false;
            const maj = majority.get(m.moduleId);
            return maj && norm !== maj.norm;
          })
          .map(m => ({ moduleId: m.moduleId, printed: m.moduleName, expected: majority.get(m.moduleId)!.display })),
      }))
      .filter(e => e.bad.length > 0);
  }, [reports]);

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadClass = async (classId: string, pages: number[]) => {
    if (!pdfBuffer) return;
    setDownloading(classId);
    try {
      const bytes = await buildClassPdf(pdfBuffer, pages);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Modulzeugnis ${classId}.pdf`.replace(/[\/\\:*?"<>|]/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to build class PDF', err);
      alert(`Could not build PDF for class ${classId}.`);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllClasses = async () => {
    for (const { classId, pages } of classGroups) {
      // Sequential: browsers throttle rapid parallel downloads.
      await downloadClass(classId, pages);
    }
  };

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

      {/* Class Splitter — split the uploaded file into one PDF per class */}
      {pdfBuffer && classGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
              <ArrowDownTrayIcon className="w-5 h-5 mr-2 text-indigo-600" />
              Zeugnisse nach Klasse ({classGroups.length})
            </h3>
            {classGroups.length > 1 && (
              <button
                onClick={downloadAllClasses}
                disabled={downloading !== null}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {downloading !== null ? 'Wird erstellt…' : 'Alle herunterladen'}
              </button>
            )}
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classGroups.map(({ classId, pages }) => (
              <button
                key={classId}
                onClick={() => downloadClass(classId, pages)}
                disabled={downloading !== null}
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:pointer-events-none text-left"
              >
                <div className="min-w-0">
                  <span className="block font-bold text-sm text-gray-900">{classId}</span>
                  <span className="block text-xs text-gray-500">{pages.length} Zeugnis{pages.length > 1 ? 'se' : ''}</span>
                </div>
                {downloading === classId
                  ? <ArrowPathIcon className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
                  : <ArrowDownTrayIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Curriculum Grid — the separate ABU/EGK certificate carries no modules
          (every tile would read "missing"), so only render it when grades exist. */}
      {curriculum && stats.moduleCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
              <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2 text-indigo-600" />
              CURRICULUM CHECK: {curriculum.label}
            </h3>
            {missingByClass.length > 0 ? (
              <div className="flex flex-col items-end gap-1">
                {missingByClass.map(({ classId, missing }) => (
                  <span key={classId} className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-3 py-1 flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    {classId}: Modul{missing.length > 1 ? 'e' : ''} {missing.join(', ')} {missing.length > 1 ? 'fehlen' : 'fehlt'}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500 font-medium">
                 Verifying document content against expected semester plan
              </span>
            )}
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
                    // Orange (missing in some class) outranks green: flag it even
                    // if another loaded class has the module.
                    const status: TileStatus = missingAnywhere.has(modId)
                      ? 'missing'
                      : isGraded ? 'graded' : isMentioned ? 'mentioned' : 'missing';
                    const style = TILE_STYLES[status];
                    const name = MODULE_NAMES[modId] || `Module ${modId}`;

                    return (
                      <div
                        key={modId}
                        className={`text-xs p-2 rounded-lg border transition-all duration-200 flex items-start gap-3 shadow-sm ${style.box}`}
                      >
                         <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-colors ${
                             status === 'missing'
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-green-500 border-green-500 text-white'
                         }`}>
                             {status === 'missing'
                               ? <XMarkIcon className="w-2.5 h-2.5 stroke-[3]" />
                               : <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />}
                         </div>
                         <div className="min-w-0 flex-1">
                           <div className="flex justify-between items-baseline gap-1">
                             <span className={`font-bold ${style.id}`}>{modId}</span>
                             {status === 'graded' && (
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

      {/* Pnab Warning */}
      {(() => {
        const pnabStudents = reports
          .map(r => ({ report: r, pnab: r.modules.filter(m => m.pnab) }))
          .filter(e => e.pnab.length > 0);
        if (pnabStudents.length === 0) return null;
        return (
          <div className="mb-8 bg-orange-50 border border-orange-300 rounded-lg p-4 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-900">
              <p className="font-semibold mb-1">
                {pnabStudents.length} Zeugnis{pnabStudents.length > 1 ? 'se' : ''} mit nicht absolvierten Prüfungen (Pnab)
              </p>
              <ul className="space-y-0.5">
                {pnabStudents.map(({ report, pnab }) => (
                  <li key={report.id}>
                    <span className="font-medium">{report.name}</span>
                    <span className="text-orange-700"> ({report.classId}) — Modul{pnab.length > 1 ? 'e' : ''} {pnab.map(m => m.moduleId).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* ABU / EGK Validation Errors */}
      {(() => {
        const abuEgkErrors = reports
          .map(r => {
            const issues: string[] = [];
            if (r.abu && !r.abu.isValid) {
              issues.push(`ABU (berechnet ${formatGrade(r.abu.calculatedAverage)} vs. gedruckt ${formatGrade(r.abu.printedAverage)})`);
            }
            if (r.egk && !r.egk.isValid) {
              const badSems = r.egk.semesterResults
                .map((s, i) => (s.isValid ? null : i + 1))
                .filter((n): n is number => n !== null);
              issues.push(badSems.length
                ? `EGK (Semester ${badSems.join(', ')})`
                : `EGK (berechnet ${formatGrade(r.egk.calculatedAverage)} vs. gedruckt ${formatGrade(r.egk.printedAverage)})`);
            }
            return { report: r, issues };
          })
          .filter(e => e.issues.length > 0);
        if (abuEgkErrors.length === 0) return null;
        return (
          <div className="mb-8 bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-900">
              <p className="font-semibold mb-1">
                {abuEgkErrors.length} Zeugnis{abuEgkErrors.length > 1 ? 'se' : ''} mit ABU/EGK-Notenfehler
              </p>
              <ul className="space-y-0.5">
                {abuEgkErrors.map(({ report, issues }) => (
                  <li key={report.id}>
                    <span className="font-medium">{report.name}</span>
                    <span className="text-red-700"> ({report.classId}) — {issues.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* Module Title ↔ Number Mismatch */}
      {titleMismatches.length > 0 && (
        <div className="mb-8 bg-purple-50 border border-purple-300 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-purple-900">
            <p className="font-semibold mb-1">
              {titleMismatches.length} Zeugnis{titleMismatches.length > 1 ? 'se' : ''} mit abweichendem Modultitel
            </p>
            <ul className="space-y-1">
              {titleMismatches.map(({ report, bad }) => (
                <li key={report.id}>
                  <span className="font-medium">{report.name}</span>
                  <span className="text-purple-700"> ({report.classId})</span>
                  <ul className="ml-4 list-disc text-purple-800">
                    {bad.map(b => (
                      <li key={b.moduleId}>
                        Modul {b.moduleId}: „{b.printed}" — erwartet „{b.expected}"
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
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
                <p className="text-2xl font-bold text-gray-900">{stats.moduleCount > 0 ? formatGrade(stats.globalAvg, 2) : '—'}</p>
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
