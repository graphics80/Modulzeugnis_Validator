export interface SemesterBlock {
  semester: number;
  modules: string[];
}

export interface Curriculum {
  label: string;
  plan: SemesterBlock[];
}

export const MODULE_NAMES: Record<string, string> = {
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
  '279': 'Marketingkonzept entwickeln und präsentieren',
  '284': 'Leistungserbringung kalkulieren und Zahlungsprozesse überwachen',
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

const APP_PLAN: SemesterBlock[] = [
  { semester: 1, modules: ['117', '162', '431', '319'] },
  { semester: 2, modules: ['114', '293', '164', '231'] },
  { semester: 3, modules: ['320', '165', '322', '122'] },
  { semester: 4, modules: ['254', '426', '346', '347'] },
  { semester: 5, modules: ['450', '323'] },
  { semester: 6, modules: ['183', '306'] },
  { semester: 7, modules: ['321', '324'] },
  { semester: 8, modules: ['241', '245'] },
];

const MEDIA_PLAN: SemesterBlock[] = [
  { semester: 1, modules: ['271', '264', '286', '431'] },
  { semester: 2, modules: ['270', '265', '287', '213'] },
  { semester: 3, modules: ['273', '278', '288', '283'] },
  { semester: 4, modules: ['266', '279', '307', '284'] },
  { semester: 5, modules: ['267', '280', '290', '306'] },
  { semester: 6, modules: ['274', '281', '291', '268', '285'] },
  { semester: 7, modules: ['275', '282'] },
];

const CURRICULA: { match: string; curriculum: Curriculum }[] = [
  { match: 'mediamatiker', curriculum: { label: 'MEDIAMATIKER', plan: MEDIA_PLAN } },
  { match: 'informatik', curriculum: { label: 'INFORMATIKER', plan: APP_PLAN } },
];

export const detectCurriculum = (profession: string): Curriculum | null => {
  const lower = profession.toLowerCase();
  return CURRICULA.find(c => lower.includes(c.match))?.curriculum ?? null;
};
