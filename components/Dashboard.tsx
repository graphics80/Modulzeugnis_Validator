
// Import React to provide the namespace for React.FC
import React, { useMemo, useState } from 'react';
import { StudentReport } from '../types';
import StudentCard from './StudentCard';
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

// Module Name Map
const MODULE_NAMES: Record<string, string> = {
  // Informatik / Applikationsentwicklung
  '117': 'Informatik- und Netzinfrastruktur für ein kleines Unternehmen realisieren',
  '162': 'Daten analysieren und modellieren',
  '319': 'Applikationen entwerfen und implementieren',
  '114': 'Codierungs-, Kompressions- und Verschlüsselungsverfahren einsetzen',
  '164': 'Datenbanken erstellen und Daten einfügen',
  '231': 'Datenschutz und Datensicherheit anwenden',
  '293': 'Webauftritt erstellen und veröffentlichen',
  '122': 'Abläufe mit einer Scriptsprache automatisieren',
  '165': 'NoSQL-Datenbanken einsetzen',
  '320': 'Objektorientiert programmieren',
  '322': 'Benutzerschnittstellen entwerfen und implementieren',
  '254': 'Geschäftsprozesse im eigenen Berufsumfeld beschreiben',
  '346': 'Cloud Lösungen konzipieren und realisieren',
  '347': 'Dienst mit Container anwenden',
  '426': 'Software mit agilen Methoden entwickeln',
  '450': 'Applikationen testen',
  '323': 'Funktional programmieren',
  '183': 'Applikationssicherheit implementieren',
  '321': 'Verteilte Systeme programmieren',
  '324': 'DevOps-Prozesse mit Tools unterstützen',
  '241': 'Innovative ICT-Lösungen initialisieren',
  '245': 'Innovative ICT-Lösungen umsetzen',

  // Mediamatiker & Shared
  '264': 'Digitale Medienproduktionen vorbereiten',
  '271': 'Vektordaten erstellen und Bilder bearbeiten',
  '286': 'Eigene ICT-Arbeitsinstrumente einrichten und bedienen',
  '431': 'Aufträge im IT-Umfeld selbstständig durchführen',
  '213': 'Teamverhalten entwickeln',
  '265': 'Digitale Fotografien produzieren',
  '270': 'Farbe und Typografie bestimmen und einsetzen',
  '287': 'Websites mit CSS gestalten',
  '273': 'Layout anlegen',
  '278': 'Den Markt analysieren und strategische Ziele ableiten',
  '283': 'Offerten rechtskonform erstellen und überprüfen',
  '288': 'Programmiertechniken im Webfrontend einsetzen',
  '266': 'Digitale Animationen produzieren',
  '279': 'Marketingkonzept entwickeln and präsentieren',
  '284': 'Leistungserbringung kalkulieren and Zahlungsprozesse überwachen',
  '307': 'Interaktive Webseite mit Formular erstellen',
  '267': 'Digitale Audioaufnahmen produzieren',
  '280': 'Analoge und digitale Marketingprodukte konzipieren',
  '290': 'Datenbanken abfragen und verändern',
  '306': 'IT Kleinprojekt abwickeln',
  '268': 'Digitale Filme produzieren',
  '274': 'Druckdaten aufbereiten und ausgeben',
  '281': 'Social-Media Kanäle aufbauen und bewirtschaften',
  '285': 'Jahresabschluss analysieren und interpretieren',
  '291': 'Oberflächen (UI) mit Webtechnologien entwickeln',
  '275': 'Gestaltungsentwürfe entwickeln und präsentieren',
  '282': 'Marketingkennzahlen auswerten und Inhalte für die betriebliche Kommunikation aufbereiten'
};

const APP_PLAN = [
  { semester: 1, modules: ['117', '162', '431', '319'] },
  { semester: 2, modules: ['114', '293', '164', '231'] },
  { semester: 3, modules: ['320', '165', '322', '122'] },
  { semester: 4, modules: ['254', '426', '346', '347'] },
  { semester: 5, modules: ['450', '323'] },
  { semester: 6, modules: ['183', '306'] },
  { semester: 7, modules: ['321', '324'] },
  { semester: 8, modules: ['241', '245'] },
];

const MEDIA_PLAN = [
  { semester: 1, modules: ['271', '264', '286', '431'] },
  { semester: 2, modules: ['270', '265', '287', '213'] },
  { semester: 3, modules: ['273', '278', '288', '283'] },
  { semester: 4, modules: ['266', '279', '307', '284'] },
  { semester: 5, modules: ['267', '280', '290', '306'] },
  { semester: 6, modules: ['274', '281', '291', '268', '285'] },
  { semester: 7, modules: ['275', '282'] },
];

const Dashboard: React.FC<Props> = ({ reports, pdfBuffer, isProcessing, onNewFile, onReset }) => {
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);

  const stats = useMemo(() => {
    const total = reports.length;
    const avgMismatch = reports.filter(r => !r.isValidAverage).length;
    const failingStudents = reports.filter(r => r.failingModules.length > 0).length;
    
    const totalSum = reports.reduce((acc, r) => acc + (r.calculatedAverage || 0), 0);
    const globalAvg = total > 0 ? (totalSum / total) : 0;

    return { total, avgMismatch, failingStudents, globalAvg };
  }, [reports]);

  // Determine Profession and Expected Plan
  const profession = reports.length > 0 ? reports[0].profession : '';
  const isInformatik = profession.toLowerCase().includes('informatik');
  const isMediamatiker = profession.toLowerCase().includes('mediamatiker');

  let activePlan = null;
  if (isMediamatiker) {
    activePlan = MEDIA_PLAN;
  } else if (isInformatik) {
    activePlan = APP_PLAN;
  }

  // Calculate detailed module statistics for the curriculum check
  const moduleInfo = useMemo(() => {
    const info: Record<string, { mentionCount: number; gradedCount: number; totalGrade: number }> = {};
    reports.forEach(r => {
      r.modules.forEach(m => {
        if (!info[m.moduleId]) {
          info[m.moduleId] = { mentionCount: 0, gradedCount: 0, totalGrade: 0 };
        }
        info[m.moduleId].mentionCount += 1;
        if (m.grade !== undefined && m.grade !== null && !isNaN(m.grade)) {
          info[m.moduleId].gradedCount += 1;
          info[m.moduleId].totalGrade += m.grade;
        }
      });
    });
    return info;
  }, [reports]);

  const handleHeaderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHeaderDragging(true);
  };

  const handleHeaderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHeaderDragging(false);
  };

  const handleHeaderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHeaderDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onNewFile(file);
  };

  const handleHeaderFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onNewFile(file);
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
            <div
                onDragOver={handleHeaderDragOver}
                onDragLeave={handleHeaderDragLeave}
                onDrop={handleHeaderDrop}
                className={`
                    relative group px-4 py-3 rounded-lg border-2 border-dashed transition-all duration-200
                    flex items-center justify-center cursor-pointer min-w-[200px]
                    ${isHeaderDragging 
                        ? 'border-indigo-500 bg-indigo-50 scale-105' 
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                    }
                    ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleHeaderFileSelect}
                    accept=".pdf,.txt"
                    disabled={isProcessing}
                />
                
                {isProcessing ? (
                    <div className="flex items-center gap-2">
                        <ArrowPathIcon className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span className="text-xs font-semibold text-indigo-700">Processing...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <CloudArrowUpIcon className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-indigo-700">
                            {isHeaderDragging ? 'Drop to Update' : 'Drag new PDF here'}
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Curriculum Grid */}
      {activePlan && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
              <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2 text-indigo-600" />
              CURRICULUM CHECK: {isMediamatiker ? 'MEDIAMATIKER' : 'INFORMATIKER'}
            </h3>
            <span className="text-xs text-gray-500 font-medium">
               Verifying document content against expected semester plan
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activePlan.map((semBlock) => (
              <div key={semBlock.semester} className="bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">SEMESTER {semBlock.semester}</h4>
                <div className="space-y-2">
                  {semBlock.modules.map(modId => {
                    const data = moduleInfo[modId];
                    const isMentioned = !!data && data.mentionCount > 0;
                    const isGraded = !!data && data.gradedCount > 0;
                    const avgGrade = isGraded ? (data.totalGrade / data.gradedCount).toFixed(1) : null;
                    const name = MODULE_NAMES[modId] || `Module ${modId}`;
                    
                    return (
                      <div 
                        key={modId} 
                        className={`text-xs p-2 rounded-lg border transition-all duration-200 flex items-start gap-3 shadow-sm ${
                          isGraded 
                            ? 'bg-green-50 border-green-200 text-green-900' 
                            : isMentioned 
                              ? 'bg-blue-50/30 border-blue-100 text-gray-500' 
                              : 'bg-white border-gray-100 text-gray-300'
                        }`}
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
                             <span className={`font-bold ${isGraded ? 'text-green-900' : isMentioned ? 'text-blue-900/60' : 'text-gray-300'}`}>{modId}</span>
                             {isGraded && (
                               <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums">
                                 {avgGrade}
                               </span>
                             )}
                           </div>
                           <span className={`block truncate leading-tight mt-0.5 ${isGraded ? 'text-green-700/80' : isMentioned ? 'text-gray-400' : 'text-gray-300/50'}`} title={name}>
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
