/* LOCOSELLI — app.js */
const ACCESS_CODE = "Loco0106R";

const Favs = {
  _key: "locoselli_favs",
  _get() {
    try { return JSON.parse(localStorage.getItem(this._key) || "[]"); }
    catch { return []; }
  },
  list() { return this._get(); },
  has(file) { return this._get().includes(file); },
  toggle(file) {
    const favs = this._get();
    const i = favs.indexOf(file);
    if (i >= 0) favs.splice(i, 1);
    else favs.push(file);
    localStorage.setItem(this._key, JSON.stringify(favs));
    return i < 0;
  }
};

let files = [];
let activeCategory = "Tutte";
let showFavsOnly = false;

const categories = ["Tutte","Bassa temperatura","Dolci","Lievitati","Molecolare","Salato","Corsi","Tecniche","Basi"];
const featuredNames = ["tiramisu","risotti","bassa-temperatura","inulina","isomalto","agar"];
const catIcons = {
  "Bassa temperatura": "🔥",
  "Dolci": "🍰",
  "Lievitati": "🥐",
  "Molecolare": "🧪",
  "Salato": "🍽️",
  "Corsi": "🎓",
  "Tecniche": "🛠️",
  "Basi": "📚"
};

const $ = id => document.getElementById(id);
const gate = $("gate");
const app = $("app");
const codeInput = $("codeInput");
const errorMsg = $("errorMsg");
const enterBtn = $("enterBtn");
const grid = $("grid");
const empty = $("empty");
const counter = $("counter");
const chips = $("chips");
const input = $("searchInput");
const logoutBtn = $("logoutBtn");
const featuredGrid= $("featuredGrid");
const catGrid = $("catGrid");
const loadingMsg = $("loadingMsg");
const scrollFab = $("scrollFab");
const favFilterBtn= $("favFilterBtn");

function isCourseFile(item) {
  const s = `${item.file || ""} ${item.title || ""}`.toLowerCase();
  return /(corso|lezione|damiano)/.test(s);
}

function buildOpenLink(item, query) {
  const q = (query || "").trim();
  if (!q) return item.file;

  if (isCourseFile(item) && item.text && item.text.toLowerCase().includes(q.toLowerCase())) {
    const params = new URLSearchParams({
      file: item.file,
      q: q,
      title: item.title || item.file
    });
    return `open-course-match.html?${params.toString()}`;
  }

  return item.file;
}

function renderFeatured() {
  const featured = [];
  featuredNames.forEach(key => {
    const found = files.find(f => f.file.toLowerCase().includes(key));
    if (found && !featured.some(x => x.file === found.file)) featured.push(found);
  });

  if (!featuredGrid) return;
  featuredGrid.innerHTML = featured.slice(0, 3).map(item => `
    <article class="feature-card">
      <span class="pill">${item.category}</span>
      <h4>${item.title}</h4>
      <p>${item.excerpt || "Apri subito questa ricetta premium dall'archivio Locoselli."}</p>
      <a class="btn small" href="${item.file}">Apri</a>
    </article>
  `).join("");
}

function renderCategories() {
  if (!catGrid) return;
  catGrid.innerHTML = categories.filter(c => c !== "Tutte").map(cat => `
    <button class="cat-card" onclick="setCategory('${cat.replace(/'/g, "\\'")}')">
      <span>${catIcons[cat] || "•"}</span>
      <strong>${cat}</strong>
      <small>${files.filter(f => f.category === cat).length} elementi</small>
    </button>
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
window.setCategory = setCategory;

function renderChips() {
  if (!chips) return;
  chips.innerHTML = categories.map(cat => `${cat}` ).join("");
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
  return text.replace(regex, "<mark>$1</mark>");
}

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
  const query = input ? input.value.trim() : "";
  const excerpt = query ? smartExcerpt(item, query) : highlightText(item.excerpt || "", query);
  const isFav = Favs.has(item.file);
  const openLink = buildOpenLink(item, query);

  return `
    <article class="card">
      <div class="card-top">
        <span class="pill">${item.category}</span>
        <button class="fav-btn ${isFav ? "active" : ""}" onclick="toggleFav('${item.file}', this)">${isFav ? "★" : "☆"}</button>
      </div>
      <h3>${highlightText(item.title, query)}</h3>
      <p>${excerpt}</p>
      <div class="card-actions">
        <a class="btn small" href="${openLink}">Apri</a>
      </div>
    </article>
  `;
}

function render() {
  const q = input ? input.value.trim().toLowerCase() : "";
  const filtered = files.filter(item => {
    const catOk = activeCategory === "Tutte" || item.category === activeCategory;
    const favOk = !showFavsOnly || Favs.has(item.file);
    const searchOk = !q || item.keywords.includes(q) || (item.text && item.text.toLowerCase().includes(q));
    return catOk && favOk && searchOk;
  });

  if (grid) grid.innerHTML = filtered.map(card).join("");
  if (counter) counter.textContent = filtered.length + " ricette";
  if (empty) empty.style.display = filtered.length ? "none" : "block";
}

function toggleFav(file, btn) {
  const now = Favs.toggle(file);
  btn.classList.toggle("active", now);
  btn.innerHTML = now ? "★" : "☆";
  if (showFavsOnly && !now) render();
}
window.toggleFav = toggleFav;

if (favFilterBtn) {
  favFilterBtn.addEventListener("click", () => {
    showFavsOnly = !showFavsOnly;
    favFilterBtn.classList.toggle("active", showFavsOnly);
    if (showFavsOnly) activeCategory = "Tutte";
    renderChips();
    render();
  });
}

if (scrollFab) {
  window.addEventListener("scroll", () => {
    scrollFab.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });

  scrollFab.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("locoselli_access");
    location.reload();
  });
}

function detectCategory(name) {
  const n = (name || "").toLowerCase();
  if (/(corso|lezione|damiano)/.test(n)) return "Corsi";
  if (/(bassa-temperatura|bassa temperatura|cottura|sous)/.test(n)) return "Bassa temperatura";
  if (/(panettone|pandoro|brioches|baba|lievito|lievit)/.test(n)) return "Lievitati";
  if (/(tiramisu|tortini|dessert|panna|macaron|bigne|frolla|plumcake|cartellate|zabaglione|mignon|biscuit)/.test(n)) return "Dolci";
  if (/(agar|sferificazione|molecolare|glice|isomalto|inulina|konjac|carragen|sucro|maltodestrina|pectina|texture|spume|mousse|gelburger|destrosio|trealosio|neutral|flexifiber|mono-diglicer|mono diglicer)/.test(n)) return "Molecolare";
  if (/(risotti|ravioli|salse|salata|sfoglia|bistecche|vegetali|peperone)/.test(n)) return "Salato";
  if (/(prodotti|tecniche)/.test(n)) return "Tecniche";
  return "Basi";
}

async function loadFiles() {
  try {
    const res = await fetch("search_index.json");
    const data = await res.json();
    files = data.map(item => ({
      file: item.file,
      title: item.title,
      category: item.category || detectCategory(item.file || item.title || ""),
      excerpt: item.excerpt || "",
      text: item.text || "",
      keywords: `${item.title || ""} ${item.category || ""} ${item.file || ""}`.toLowerCase()
    }));
  } catch (err) {
    console.warn("search_index.json non disponibile, fallback API GitHub:", err);
    files = [];
  }

  if (loadingMsg) loadingMsg.style.display = "none";
  renderFeatured();
  renderCategories();
  renderChips();
  render();
}

function enterApp() {
  if (gate) gate.style.display = "none";
  if (app) app.style.display = "block";
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

if (enterBtn) enterBtn.addEventListener("click", checkCode);
if (codeInput) codeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") checkCode();
});
if (input) input.addEventListener("input", render);

if (localStorage.getItem("locoselli_access") === "ok") {
  window.addEventListener("load", () => enterApp());
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.log("SW registration failed:", err));
  });
}
