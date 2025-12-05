import React, { useMemo } from 'react';
import { StudentReport } from '../types';
import StudentCard from './StudentCard';
import { 
  ChartBarIcon, 
  UserGroupIcon, 
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

interface Props {
  reports: StudentReport[];
  onReset: () => void;
}

// Module Name Map
const MODULE_NAMES: Record<string, string> = {
  // Informatik / Applikationsentwicklung
  '117': 'Informatik und Netzinfrastruktur für ein kleines Unternehmen realisieren',
  '162': 'Daten analysieren und modelieren',
  '319': 'Applikationen entwerfen und implementieren',
  '114': 'Codierungs-, Kompressions-, Verschlüsselungsverfahren',
  '164': 'Datenbanken erstellen und Daten einfügen',
  '231': 'Datenschutz und Datensicherheit anwenden',
  '293': 'Webauftritt erstellen und veröffentlichen',
  '122': 'Abläufe mit einer Scriptsprache automatisieren',
  '165': 'NoSQLDatenbanken einsetzen',
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
  '431': 'Aufträge im IT-Umfeld selbstständig durchführen', // Also used in Informatik (similar name)
  '213': 'Teamverhalten entwickeln',
  '265': 'Digitale Fotografien produzieren',
  '270': 'Farbe und Typografie bestimmen und einsetzen',
  '287': 'Websites mit CSS gestalten',
  '273': 'Layout anlegen',
  '278': 'Den Markt analysieren und strategische Ziele ableiten',
  '283': 'Offerten rechtskonform erstellen und überprüfen',
  '288': 'Programmiertechniken im Webfrontend einsetzen',
  '266': 'Digitale Animationen produzieren',
  '279': 'Marketingkonzept entwickeln und präsentieren',
  '284': 'Leistungserbringung kalkulieren und Zahlungsprozesse überwachen',
  '307': 'Interaktive Webseite mit Formular erstellen',
  '267': 'Digitale Audioaufnahmen produzieren',
  '280': 'Analoge und digitale Marketingprodukte konzipieren',
  '290': 'Datenbanken abfragen und verändern',
  '306': 'IT Kleinprojekt abwickeln', // Also used in Informatik
  '268': 'Digitale Filme produzieren',
  '274': 'Druckdaten aufbereiten und ausgeben',
  '281': 'Social-Media Kanäle aufbauen und bewirtschaften',
  '285': 'Jahresabschluss analysieren und interpretieren',
  '291': 'Oberflächen (UI) mit Webtechnologien entwickeln',
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

const Dashboard: React.FC<Props> = ({ reports, onReset }) => {
  const stats = useMemo(() => {
    const total = reports.length;
    const avgMismatch = reports.filter(r => !r.isValidAverage).length;
    const failingStudents = reports.filter(r => r.failingModules.length > 0).length;
    
    // Calculate global average based on parsed data
    const totalSum = reports.reduce((acc, r) => acc + r.calculatedAverage, 0);
    const globalAvg = total > 0 ? (totalSum / total) : 0;

    return { total, avgMismatch, failingStudents, globalAvg };
  }, [reports]);

  // Determine Profession and Expected Plan
  const profession = reports.length > 0 ? reports[0].profession : '';
  const isApplikationsentwicklung = profession.includes('Applikationsentwicklung') || profession.includes('Informatiker');
  const isMediamatiker = profession.includes('Mediamatiker');

  let activePlan = null;
  if (isApplikationsentwicklung) {
    activePlan = APP_PLAN;
  } else if (isMediamatiker) {
    activePlan = MEDIA_PLAN;
  }

  // Calculate Module Presence (set of IDs found across ALL currently loaded reports)
  const presentModuleIds = useMemo(() => {
    const ids = new Set<string>();
    reports.forEach(r => {
      r.modules.forEach(m => ids.add(m.moduleId));
    });
    return ids;
  }, [reports]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Software Validation Results</h1>
          <p className="text-gray-500 text-sm mt-1">Bildungszentrum Zürichsee • Informatik/Technik</p>
        </div>
        <button 
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
        >
          Upload New Data
        </button>
      </div>

      {/* Curriculum Grid */}
      {activePlan && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
              <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2 text-indigo-600" />
              Curriculum Check: {isMediamatiker ? 'Mediamatiker' : 'Applikationsentwicklung'}
            </h3>
            <span className="text-xs text-gray-500">
               Verifying software output against expected semester plan
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activePlan.map((semBlock) => (
              <div key={semBlock.semester} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Semester {semBlock.semester}</h4>
                <div className="space-y-2">
                  {semBlock.modules.map(modId => {
                    const isPresent = presentModuleIds.has(modId);
                    const name = MODULE_NAMES[modId] || `Module ${modId}`;
                    return (
                      <div 
                        key={modId} 
                        className={`text-xs p-2 rounded border flex items-start gap-2 ${
                          isPresent 
                            ? 'bg-green-100 border-green-200 text-green-900' 
                            : 'bg-white border-gray-200 text-gray-400'
                        }`}
                      >
                         <div className={`mt-0.5 flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center ${
                             isPresent ? 'bg-green-500' : 'bg-gray-200'
                         }`}>
                             {isPresent && <CheckIcon className="w-2 h-2 text-white" />}
                         </div>
                         <div className="min-w-0 flex-1">
                           <span className="font-bold block">{modId}</span>
                           <span className={`block truncate leading-tight ${isPresent ? 'text-green-800' : 'text-gray-400'}`} title={name}>
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
          <StudentCard key={report.id} student={report} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;