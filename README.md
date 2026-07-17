# Zeugnis-Validator Mediamatiker / Informatiker

Validiert Modulzeugnisse (PDF) des Bildungszentrums Zürichsee direkt im Browser —
es werden keine Daten an einen Server geschickt.

**Live:** https://zeugnisvalidator.it.bzz.ch

## Was es prüft

- **Modulnoten:** berechneter Durchschnitt vs. gedruckter Durchschnitt pro Lernenden
- **Ungenügende Module** (Note < 4.0)
- **ABU** (Sprache & Kommunikation, Gesellschaft) und **EGK** (Englisch, Mathematik) inkl. Semesterdurchschnitten
- **Curriculum-Check:** gefundene Module gegen den Semesterplan des Berufs
  (Informatiker Applikationsentwicklung / Mediamatiker)

PDF per Drag & Drop hochladen; pro Lernendem lässt sich die Original-Zeugnisseite
als Einzel-PDF öffnen.

## Lokal starten

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Produktions-Build nach dist/
```

## Deployment

Läuft als Docker-Container (nginx) hinter Apache-Reverse-Proxy — Details und
Reproduktionsanleitung in [DEPLOYMENT.md](DEPLOYMENT.md), Redeploy per `./deploy.sh`.

## Stack

React 19 · TypeScript · Vite · Tailwind (CDN) · pdfjs-dist (Textextraktion) · pdf-lib (Seiten-Slicing)
