/**
 * Test harness: runs the real extraction pipeline (pdf.js → parser) against
 * reference PDFs of all three class types and checks the results.
 *
 * The reference PDFs contain real student data and are NOT committed.
 * Place them in tests/fixtures/ (gitignored) or ~/Downloads.
 *
 * Run with: npm test
 */
import * as pdfjsLib from 'pdfjs-dist';
import { extractTextFromPDF } from '../services/pdfService';
import { parseOCRText } from '../services/parserService';
import { detectCurriculum } from '../services/curriculumService';
import { readFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import * as path from 'path';
import * as os from 'os';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

interface Fixture {
  label: string;
  file: string;
  curriculum: 'INFORMATIKER' | 'MEDIAMATIKER';
  expected: {
    reports: number;
    pnabModules: number; // total modules marked Pnab across all reports
    abuReports: number;  // reports carrying an ABU (Allgemeinbildung) section
    egkReports: number;  // reports carrying an EGK (Erweiterte Grundkompetenzen) section
  };
}

const FIXTURES: Fixture[] = [
  { label: 'Informatiker (IA23)', file: 'IA23 alle Klassen.pdf', curriculum: 'INFORMATIKER', expected: { reports: 42, pnabModules: 3, abuReports: 15, egkReports: 15 } },
  { label: 'IMS (IM23)',          file: 'IM23 alle Klassen.pdf', curriculum: 'INFORMATIKER', expected: { reports: 28, pnabModules: 0, abuReports: 0, egkReports: 0 } },
  { label: 'Mediamatiker (ME23)', file: 'ME23 alle Klassen.pdf', curriculum: 'MEDIAMATIKER', expected: { reports: 115, pnabModules: 4, abuReports: 0, egkReports: 0 } },
];

const SEARCH_DIRS = [
  path.resolve('tests/fixtures'),
  path.join(os.homedir(), 'Downloads'),
];

const findFixture = (file: string): string | null => {
  for (const dir of SEARCH_DIRS) {
    const p = path.join(dir, file);
    if (existsSync(p)) return p;
  }
  return null;
};

let failures = 0;
const check = (ok: boolean, message: string) => {
  if (!ok) {
    failures++;
    console.log(`  ✗ ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
};

for (const fixture of FIXTURES) {
  console.log(`\n=== ${fixture.label} — ${fixture.file} ===`);
  const filePath = findFixture(fixture.file);
  if (!filePath) {
    failures++;
    console.log(`  ✗ PDF nicht gefunden (gesucht in: ${SEARCH_DIRS.join(', ')})`);
    continue;
  }

  const buf = readFileSync(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const text = await extractTextFromPDF(ab);
  const reports = parseOCRText(text);

  check(reports.length === fixture.expected.reports,
    `${reports.length} Zeugnisse geparst (erwartet ${fixture.expected.reports})`);

  const unknownNames = reports.filter(r => r.name === 'Unknown Student');
  check(unknownNames.length === 0, `alle Namen erkannt (${unknownNames.length} unbekannt)`);

  const badProfession = reports.filter(r => !/\bEFZ\b/.test(r.profession));
  check(badProfession.length === 0,
    `Beruf überall erkannt${badProfession.length ? ` — fehlend bei: ${badProfession.slice(0, 3).map(r => r.name).join(', ')}` : ''}`);

  const wrongCurriculum = reports.filter(r => detectCurriculum(r.profession)?.label !== fixture.curriculum);
  check(wrongCurriculum.length === 0, `Curriculum ${fixture.curriculum} für alle erkannt (${wrongCurriculum.length} abweichend)`);

  const tooFewModules = reports.filter(r => r.modules.length < 20);
  check(tooFewModules.length === 0,
    `alle Zeugnisse ≥ 20 Module${tooFewModules.length ? ` — zu wenig bei: ${tooFewModules.slice(0, 3).map(r => `${r.name} (${r.modules.length})`).join(', ')}` : ''}`);

  const avgMismatch = reports.filter(r => !r.isValidAverage);
  check(avgMismatch.length === 0,
    `berechneter Durchschnitt == gedruckter Durchschnitt${avgMismatch.length ? ` — Abweichung bei: ${avgMismatch.slice(0, 5).map(r => `${r.name} (calc ${r.calculatedAverage} vs. ${r.printedAverage})`).join(', ')}` : ''}`);

  const pnabEntries = reports.flatMap(r => r.modules.filter(m => m.pnab).map(m => ({ name: r.name, classId: r.classId, moduleId: m.moduleId })));
  check(pnabEntries.length === fixture.expected.pnabModules,
    `${pnabEntries.length} Pnab-Module erkannt (erwartet ${fixture.expected.pnabModules})`);
  for (const p of pnabEntries) {
    console.log(`    · Pnab: ${p.name} (${p.classId}) — Modul ${p.moduleId}`);
  }

  const abuReports = reports.filter(r => r.abu);
  const egkReports = reports.filter(r => r.egk);
  check(abuReports.length === fixture.expected.abuReports,
    `${abuReports.length} Zeugnisse mit ABU-Abschnitt (erwartet ${fixture.expected.abuReports})`);
  check(egkReports.length === fixture.expected.egkReports,
    `${egkReports.length} Zeugnisse mit EGK-Abschnitt (erwartet ${fixture.expected.egkReports})`);

  const abuInvalid = abuReports.filter(r => !r.abu!.isValid);
  check(abuInvalid.length === 0,
    `ABU-Durchschnitt validiert überall${abuInvalid.length ? ` — Abweichung bei: ${abuInvalid.slice(0, 5).map(r => `${r.name} (calc ${r.abu!.calculatedAverage} vs. ${r.abu!.printedAverage})`).join(', ')}` : ''}`);
  const egkInvalid = egkReports.filter(r => !r.egk!.isValid);
  check(egkInvalid.length === 0,
    `EGK-Durchschnitt validiert überall${egkInvalid.length ? ` — Abweichung bei: ${egkInvalid.slice(0, 5).map(r => `${r.name} (calc ${r.egk!.calculatedAverage} vs. ${r.egk!.printedAverage})`).join(', ')}` : ''}`);
}

console.log(failures === 0 ? '\nAlle Tests bestanden ✓' : `\n${failures} Test(s) fehlgeschlagen ✗`);
process.exit(failures === 0 ? 0 : 1);
