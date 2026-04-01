#!/usr/bin/env node
/**
 * build-index.js — Genera search_index.json dal contenuto delle pagine HTML
 *
 * USO:
 *   1. Metti questo file nella root del repo (accanto a index.html)
 *   2. Esegui:  node build-index.js
 *   3. Verrà creato/aggiornato search_index.json
 *   4. Fai commit e push del nuovo search_index.json
 *
 * Riesegui ogni volta che aggiungi o modifichi ricette.
 */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;

// Stessa logica di categorizzazione dell'index.html
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

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(filename) {
  return filename
    .replace(/\.html$/i, "")
    .replace(/-/g, " ")
    .replace(/\bcoretto\b/i, "corretto")
    .trim();
}

// Trova tutti i file HTML (esclusi index.html e test.html)
const htmlFiles = fs
  .readdirSync(DIR)
  .filter(f => f.endsWith(".html") && f !== "index.html" && f !== "test.html")
  .sort((a, b) => a.localeCompare(b, "it"));

console.log(`Trovati ${htmlFiles.length} file HTML da indicizzare...\n`);

const index = htmlFiles.map(filename => {
  const html = fs.readFileSync(path.join(DIR, filename), "utf-8");
  const text = stripHtml(html).toLowerCase();
  const excerpt = text.slice(0, 260);
  const title = cleanTitle(filename);
  const category = detectCategory(filename);

  console.log(`  ✓ ${filename} → ${category}`);

  return { file: filename, title, category, text, excerpt };
});

const outPath = path.join(DIR, "search_index.json");
fs.writeFileSync(outPath, JSON.stringify(index), "utf-8");

const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`\nFatto! search_index.json aggiornato (${sizeMB} MB, ${index.length} ricette)`);
