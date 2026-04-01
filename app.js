/* ═══════════════════════════════════════════════
   LOCOSELLI — app.js
   Logica condivisa: auth, ricerca, preferiti, UI
   ═══════════════════════════════════════════════ */

const ACCESS_CODE = "Loco0106R";

/* ---------- Favourites (localStorage) ---------- */
const Favs = {
  _key: "locoselli_favs",
  _get() { try { return JSON.parse(localStorage.getItem(this._key) || "[]"); } catch { return []; } },
  list() { return this._get(); },
  has(file) { return this._get().includes(file); },
  toggle(file) {
    const favs = this._get();
    const i = favs.indexOf(file);
    if (i >= 0) favs.splice(i, 1); else favs.push(file);
    localStorage.setItem(this._key, JSON.stringify(favs));
    return i < 0; // returns true if now favourited
  }
};

/* ---------- State ---------- */
let files = [];
let activeCategory = "Tutte";
let showFavsOnly = false;

const categories = ["Tutte","Bassa temperatura","Dolci","Lievitati","Molecolare","Salato","Tecniche","Basi"];
const featuredNames = ["tiramisu","risotti","bassa-temperatura","inulina","isomalto","agar"];

const catIcons = {
  "Bassa temperatura": "🌡️",
  "Dolci": "🍰",
  "Lievitati": "🥐",
  "Molecolare": "🧪",
  "Salato": "🍽️",
  "Tecniche": "📖",
  "Basi": "📋"
};

/* ---------- DOM refs ---------- */
const $ = id => document.getElementById(id);
const gate        = $("gate");
const app         = $("app");
const codeInput   = $("codeInput");
const errorMsg    = $("errorMsg");
const enterBtn    = $("enterBtn");
const grid        = $("grid");
const empty       = $("empty");
const counter     = $("counter");
const chips       = $("chips");
const input       = $("searchInput");
const logoutBtn   = $("logoutBtn");
const featuredGrid= $("featuredGrid");
const catGrid     = $("catGrid");
const loadingMsg  = $("loadingMsg");
const scrollFab   = $("scrollFab");
const favFilterBtn= $("favFilterBtn");

/* ---------- Rendering ---------- */

function renderFeatured() {
  const featured = [];
  featuredNames.forEach(key => {
    const found = files.find(f => f.file.toLowerCase().includes(key));
    if (found && !featured.some(x => x.file === found.file)) featured.push(found);
  });
  featuredGrid.innerHTML = featured.slice(0, 3).map((item, i) => `
    <article class="featured-card fade-up" style="animation-delay:${i * .08}s">
      <div class="featured-kicker">${item.category}</div>
      <h4>${item.title}</h4>
      <p>${item.excerpt || "Apri subito questa ricetta premium dall'archivio Locoselli."}</p>
      <div class="actions">
        <a class="btn primary" href="${item.file}">Apri</a>
      </div>
    </article>
  `).join("");
}

function renderCategories() {
  catGrid.innerHTML = categories.filter(c => c !== "Tutte").map(cat => `
    <a class="cat-card" href="#" onclick="setCategory('${cat.replace(/'/g, "\\'")}'); return false;">
      <span class="cat-icon">${catIcons[cat] || "📄"}</span>
      <strong>${cat}</strong>
      <span>${files.filter(f => f.category === cat).length} ricette</span>
    </a>
  `).join("");
}

function setCategory(cat) {
  activeCategory = cat;
  showFavsOnly = false;
  if (favFilterBtn) favFilterBtn.classList.remove("active");
  renderChips();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
// expose globally for onclick
window.setCategory = setCategory;

function renderChips() {
  chips.innerHTML = categories.map(cat =>
    `<button class="chip ${cat === activeCategory && !showFavsOnly ? "active" : ""}" data-cat="${cat}">${cat}</button>`
  ).join("");
  Array.from(chips.querySelectorAll(".chip")).forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      showFavsOnly = false;
      if (favFilterBtn) favFilterBtn.classList.remove("active");
      renderChips();
      render();
    });
  });
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  if (!query || !text) return text || "";
  const regex = new RegExp("(" + escapeRegExp(query) + ")", "gi");
  return text.replace(regex, "<span class='search-hl'>$1</span>");
}

/* Smart excerpt: show context around the search term */
function smartExcerpt(item, query) {
  if (!query || !item.text) return item.excerpt || "";
  const lower = item.text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return item.excerpt || "";
  const start = Math.max(0, idx - 60);
  const end = Math.min(item.text.length, idx + query.length + 140);
  let snippet = (start > 0 ? "…" : "") + item.text.slice(start, end) + (end < item.text.length ? "…" : "");
  return highlightText(snippet, query);
}

function card(item) {
  const query = input.value.trim();
  const excerpt = query ? smartExcerpt(item, query) : highlightText(item.excerpt || "", query);
  const isFav = Favs.has(item.file);
  return `
    <article class="card fade-up">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <h3 class="title">${highlightText(item.title, query)}</h3>
        <button class="fav-btn ${isFav ? "active" : ""}" onclick="toggleFav('${item.file}', this)" title="Preferiti">
          ${isFav ? "★" : "☆"}
        </button>
      </div>
      <div class="meta">
        <span class="badge">${item.category}</span>
        <span class="badge">HTML</span>
      </div>
      <div class="excerpt">${excerpt}</div>
      <div class="actions">
        <a class="btn primary" href="${item.file}">Apri</a>
        <a class="btn secondary" href="#" onclick="setCategory('${item.category.replace(/'/g, "\\'")}'); return false;">Categoria</a>
      </div>
    </article>
  `;
}

function render() {
  const q = input.value.trim().toLowerCase();
  const filtered = files.filter(item => {
    const catOk = activeCategory === "Tutte" || item.category === activeCategory;
    const favOk = !showFavsOnly || Favs.has(item.file);
    const searchOk = !q || item.keywords.includes(q) || (item.text && item.text.includes(q));
    return catOk && favOk && searchOk;
  });
  grid.innerHTML = filtered.map(card).join("");
  counter.textContent = filtered.length + " ricette";
  empty.style.display = filtered.length ? "none" : "block";
}

/* ---------- Favourites toggle ---------- */
function toggleFav(file, btn) {
  const now = Favs.toggle(file);
  btn.classList.toggle("active", now);
  btn.innerHTML = now ? "★" : "☆";
  // If viewing favs only and we just unfavourited, re-render
  if (showFavsOnly && !now) render();
}
window.toggleFav = toggleFav;

/* ---------- Fav filter button ---------- */
if (favFilterBtn) {
  favFilterBtn.addEventListener("click", () => {
    showFavsOnly = !showFavsOnly;
    favFilterBtn.classList.toggle("active", showFavsOnly);
    if (showFavsOnly) activeCategory = "Tutte";
    renderChips();
    render();
  });
}

/* ---------- Scroll FAB ---------- */
if (scrollFab) {
  window.addEventListener("scroll", () => {
    scrollFab.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });
  scrollFab.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- Logout ---------- */
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("locoselli_access");
    location.reload();
  });
}

/* ---------- Load files from search_index.json ---------- */
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

async function loadFiles() {
  try {
    const res = await fetch("search_index.json");
    const data = await res.json();
    files = data.map(item => ({
      file: item.file,
      title: item.title,
      category: item.category,
      excerpt: item.excerpt || "",
      text: item.text || "",
      keywords: (item.title + " " + item.category).toLowerCase()
    }));
  } catch (err) {
    console.warn("search_index.json non disponibile, fallback API GitHub:", err);
    try {
      const repoRes = await fetch("https://api.github.com/repos/chefantonioloco87/app-ricette-Loco/contents");
      const repoData = await repoRes.json();
      const pages = repoData
        .filter(f => f.name.endsWith(".html") && f.name !== "index.html" && f.name !== "test.html")
        .sort((a, b) => a.name.localeCompare(b, "it"));
      files = pages.map(f => {
        const cleanTitle = f.name.replace(/\.html$/i, "").replace(/-/g, " ").replace(/\bcoretto\b/i, "corretto").trim();
        const category = detectCategory(f.name);
        return { file: f.name, title: cleanTitle, category, excerpt: "", text: "", keywords: (cleanTitle + " " + category).toLowerCase() };
      });
    } catch (e2) {
      console.error("Impossibile caricare le ricette:", e2);
      files = [];
    }
  }

  if (loadingMsg) loadingMsg.style.display = "none";
  renderFeatured();
  renderCategories();
  renderChips();
  render();
}

/* ---------- Auth ---------- */
function enterApp() {
  gate.style.display = "none";
  app.style.display = "block";
  loadFiles();
}

function checkCode() {
  if (codeInput.value === ACCESS_CODE) {
    errorMsg.textContent = "";
    localStorage.setItem("locoselli_access", "ok");
    enterApp();
  } else {
    errorMsg.textContent = "Codice errato. Riprova.";
    codeInput.value = "";
    codeInput.focus();
  }
}

enterBtn.addEventListener("click", checkCode);
codeInput.addEventListener("keydown", e => { if (e.key === "Enter") checkCode(); });
input.addEventListener("input", render);

/* Auto-login */
if (localStorage.getItem("locoselli_access") === "ok") {
  window.addEventListener("load", () => enterApp());
}

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.log("SW registration failed:", err));
  });
}
