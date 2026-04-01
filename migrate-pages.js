#!/usr/bin/env node
/**
 * migrate-pages.js — Converte TUTTE le pagine ricetta al nuovo template
 *
 * Cosa fa:
 *   1. Legge ogni file HTML nella root (esclusi index.html, test.html)
 *   2. Estrae il contenuto del <body> (il testo vero della ricetta)
 *   3. Riscrive il file con: CSS esterno (style.css), font DM Sans,
 *      breadcrumb, wrapper .recipe-wrap, .page-card, footer
 *   4. Crea un backup della versione originale in /backup/
 *
 * USO:
 *   1. Metti questo file nella root del repo (accanto a index.html)
 *   2. Esegui:  node migrate-pages.js
 *   3. Controlla che tutto sia ok
 *   4. Fai commit e push
 *
 * SICUREZZA: i file originali vengono salvati in /backup/
 */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const BACKUP = path.join(DIR, "backup");

// Crea cartella backup
if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP);

// Categorie (stessa logica di app.js)
function detectCategory(name) {
  const n = name.toLowerCase();
  if (/(bassa-temperatura|bassa temperatura|cottura|sous)/.test(n)) return "Bassa temperatura";
  if (/(panettone|pandoro|brioches|baba|lievito|lievit)/.test(n)) return "Lievitati";
  if (/(tiramisu|tortini|dessert|panna|macaron|bigne|frolla|plumcake|cartellate|zabaglione|mignon|biscuit)/.test(n)) return "Dolci";
  if (/(agar|sferificazione|molecolare|glice|isomalto|inulina|konjac|carragen|sucro|maltodestrina|pectina|texture|spume|mousse|gelburger|destrosio|trealosio|neutral|flexifiber|mono-diglicer|mono diglicer)/.test(n)) return "Molecolare";
  if (/(risotti|ravioli|salse|salata|sfoglia|bistecche|vegetali|peperone)/.test(n)) return "Salato";
  if (/(corso|lezione|prodotti|damiano|tecniche)/.test(n)) return "Tecniche";
  return "Basi";
}

function cleanTitle(filename) {
  return filename
    .replace(/\.html$/i, "")
    .replace(/-/g, " ")
    .replace(/\bcoretto\b/i, "corretto")
    .replace(/\bver\s*\d+/gi, "")
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function extractBodyContent(html) {
  // Prova a estrarre il contenuto dentro <body>...</body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;

  let content = bodyMatch[1];

  // Rimuovi eventuali <script> interni
  content = content.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Rimuovi wrapper generici se presenti (div.wrap, div.container, etc.)
  // Ma mantieni il contenuto significativo
  content = content.trim();

  return content;
}

function hasExternalCSS(html) {
  // Controlla se il file usa già style.css esterno
  return html.includes('href="style.css"') || html.includes("href='style.css'");
}

function buildNewPage(filename, bodyContent) {
  const title = cleanTitle(filename);
  const category = detectCategory(filename);
  const shortTitle = title.length > 30 ? title.slice(0, 30) + "…" : title;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <base href="/app-ricette-Loco/">
  <title>${title} – Locoselli</title>
  <meta name="theme-color" content="#0b0b0d">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="recipe-wrap">

    <!-- Breadcrumb -->
    <nav class="breadcrumb fade-up">
      <a href="index.html">Archivio</a>
      <span class="sep">›</span>
      <a href="#" onclick="history.back(); return false;">${category}</a>
      <span class="sep">›</span>
      <span>${shortTitle}</span>
    </nav>

    <div class="page-card fade-up">
      <span class="badge">${category}</span>
${indentContent(bodyContent)}
    </div>

    <div class="footer-note">Premium by Locoselli • uso riservato</div>
  </div>
</body>
</html>`;
}

function indentContent(content) {
  // Pulisci e indenta leggermente il contenuto
  return content
    .split("\n")
    .map(line => "      " + line)
    .join("\n")
    .trim();
}

// ─── MAIN ───

const htmlFiles = fs
  .readdirSync(DIR)
  .filter(f =>
    f.endsWith(".html") &&
    f !== "index.html" &&
    f !== "test.html"
  )
  .sort((a, b) => a.localeCompare(b, "it"));

console.log(`\n🔄 Migrazione di ${htmlFiles.length} pagine ricetta...\n`);

let converted = 0;
let skipped = 0;
let errors = 0;

htmlFiles.forEach(filename => {
  try {
    const filepath = path.join(DIR, filename);
    const html = fs.readFileSync(filepath, "utf-8");

    // Skip se usa già il nuovo template
    if (hasExternalCSS(html)) {
      console.log(`  ⏭️  ${filename} — già aggiornato, salto`);
      skipped++;
      return;
    }

    // Backup dell'originale
    fs.copyFileSync(filepath, path.join(BACKUP, filename));

    // Estrai contenuto
    const bodyContent = extractBodyContent(html);
    if (!bodyContent || bodyContent.trim().length < 10) {
      console.log(`  ⚠️  ${filename} — contenuto vuoto o non leggibile, salto`);
      skipped++;
      return;
    }

    // Costruisci nuovo file
    const newHtml = buildNewPage(filename, bodyContent);
    fs.writeFileSync(filepath, newHtml, "utf-8");

    const category = detectCategory(filename);
    console.log(`  ✅ ${filename} → ${category}`);
    converted++;

  } catch (err) {
    console.log(`  ❌ ${filename} — errore: ${err.message}`);
    errors++;
  }
});

console.log(`
════════════════════════════════════════
  ✅ Convertiti: ${converted}
  ⏭️  Saltati:    ${skipped}
  ❌ Errori:     ${errors}
  📁 Backup in:  ./backup/
════════════════════════════════════════

Prossimi passi:
  1. Controlla alcune pagine nel browser
  2. Se tutto ok: git add . && git commit -m "Migrazione al nuovo template" && git push
  3. Se qualcosa non va: copia i file da ./backup/ per ripristinare
`);
