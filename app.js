const ACCESS_CODE = "Loco0106R";

const categories = ["Tutte","Bassa temperatura","Dolci","Lievitati","Molecolare","Salato","Corsi","Tecniche","Basi"];
const catIcons = {
  "Bassa temperatura":"🔥",
  "Dolci":"🍰",
  "Lievitati":"🥐",
  "Molecolare":"🧪",
  "Salato":"🍽️",
  "Corsi":"🎓",
  "Tecniche":"🛠️",
  "Basi":"📚"
};

let files = [];
let activeCategory = "Tutte";
let showFavsOnly = false;

const Favs = {
  key:"locoselli_favs",
  get(){
    try { return JSON.parse(localStorage.getItem(this.key) || "[]"); }
    catch(e){ return []; }
  },
  has(file){ return this.get().includes(file); },
  toggle(file){
    const favs = this.get();
    const i = favs.indexOf(file);
    if (i >= 0) favs.splice(i,1); else favs.push(file);
    localStorage.setItem(this.key, JSON.stringify(favs));
    return i < 0;
  }
};

const $ = (id) => document.getElementById(id);
const gate = $("gate");
const app = $("app");
const codeInput = $("codeInput");
const errorMsg = $("errorMsg");
const enterBtn = $("enterBtn");
const searchInput = $("searchInput");
const grid = $("grid");
const empty = $("empty");
const counter = $("counter");
const chips = $("chips");
const catGrid = $("catGrid");
const featuredGrid = $("featuredGrid");
const favFilterBtn = $("favFilterBtn");
const logoutBtn = $("logoutBtn");
const loadingMsg = $("loadingMsg");
const statTotal = $("statTotal");
const statCourses = $("statCourses");
const statRecipes = $("statRecipes");
const scrollFab = $("scrollFab");

function detectCategory(name){
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

function normalizeItem(item, forcedCategory){
  const file = item.file || "";
  const title = item.title || file.replace(/\.html$/i, "").replace(/-/g, " ");
  const excerpt = item.excerpt || "";
  const text = item.text || "";
  const category = forcedCategory || item.category || detectCategory(file || title);
  return {
    file,
    title,
    excerpt,
    text,
    category,
    keywords: `${title} ${category} ${file} ${excerpt}`.toLowerCase()
  };
}

function uniqByFile(arr){
  const map = new Map();
  arr.forEach(item => {
    if (!item.file) return;
    if (!map.has(item.file)) map.set(item.file, item);
  });
  return Array.from(map.values());
}

async function loadJson(path){
  const res = await fetch(path);
  if (!res.ok) throw new Error(path + " " + res.status);
  return await res.json();
}

async function loadFiles(){
  try{
    const [mainData, corsiData] = await Promise.all([
      loadJson("search_index.json"),
      loadJson("corsi_index.json").catch(() => [])
    ]);

    const mainItems = (mainData || []).map(item => normalizeItem(item));
    const courseItems = (corsiData || []).map(item => normalizeItem(item, "Corsi"));

    files = uniqByFile([...mainItems, ...courseItems]).sort((a,b) => a.title.localeCompare(b.title, "it"));
  }catch(err){
    console.warn("Errore caricamento indici, fallback API GitHub:", err);
    try{
      const repoRes = await fetch("https://api.github.com/repos/chefantonioloco87/Locoselli-Rezept-/contents");
      const repoData = await repoRes.json();
      files = repoData
        .filter(f => f.name && f.name.endsWith(".html") && f.name !== "index.html")
        .map(f => normalizeItem({ file:f.name, title:f.name.replace(/\.html$/i,"").replace(/-/g," ") }))
        .sort((a,b) => a.title.localeCompare(b.title, "it"));
    }catch(e2){
      console.error("Impossibile caricare archivio:", e2);
      files = [];
    }
  }

  loadingMsg.style.display = "none";
  renderStats();
  renderFeatured();
  renderCategories();
  renderChips();
  render();
}

function renderStats(){
  const total = files.length;
  const courses = files.filter(f => f.category === "Corsi").length;
  const recipes = total - courses;
  statTotal.textContent = total;
  statCourses.textContent = courses;
  statRecipes.textContent = recipes;
}

function renderFeatured(){
  const picks = [
    files.find(f => /tiramisu/i.test(f.file)),
    files.find(f => /risotti/i.test(f.file)),
    files.find(f => /corso-avanzato-lezione1/i.test(f.file))
  ].filter(Boolean);

  featuredGrid.innerHTML = picks.map(item => `
    <article class="feature">
      <span class="pill">${item.category}</span>
      <h3>${item.title}</h3>
      <p>${item.excerpt || "Apri subito questa pagina dall’archivio Locoselli."}</p>
      <div class="card-actions">
        <a class="btn" href="${item.file}">Apri</a>
      </div>
    </article>
  `).join("");
}

function renderCategories(){
  catGrid.innerHTML = categories
    .filter(c => c !== "Tutte")
    .map(cat => `
      <div class="cat" onclick="setCategory('${cat.replace(/'/g, "\\'")}')">
        <div class="pill">${catIcons[cat] || "•"} ${cat}</div>
        <strong>${cat}</strong>
        <small>${files.filter(f => f.category === cat).length} elementi</small>
      </div>
    `).join("");
}

function renderChips(){
  chips.innerHTML = categories.map(cat => `
    <button class="chip ${activeCategory === cat ? "active" : ""}" data-cat="${cat}">
      ${cat}
    </button>
  `).join("");

  Array.from(chips.querySelectorAll(".chip")).forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderChips();
      render();
    });
  });
}

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, query){
  if (!query || !text) return text || "";
  const regex = new RegExp("(" + escapeRegExp(query) + ")", "ig");
  return text.replace(regex, "<mark>$1</mark>");
}

function smartExcerpt(item, query){
  if (!query) return item.excerpt || "";
  const hay = `${item.excerpt || ""} ${item.text || ""}`.trim();
  if (!hay) return item.excerpt || "";
  const lower = hay.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return item.excerpt || "";
  const start = Math.max(0, idx - 60);
  const end = Math.min(hay.length, idx + query.length + 140);
  return (start > 0 ? "…" : "") + highlight(hay.slice(start, end), query) + (end < hay.length ? "…" : "");
}

function filterFiles(){
  const q = (searchInput.value || "").trim().toLowerCase();

  return files.filter(item => {
    const catOk = activeCategory === "Tutte" || item.category === activeCategory;
    const favOk = !showFavsOnly || Favs.has(item.file);
    const searchOk = !q || item.keywords.includes(q) || (item.text || "").toLowerCase().includes(q);
    return catOk && favOk && searchOk;
  });
}

function render(){
  const q = (searchInput.value || "").trim();
  const filtered = filterFiles();

  counter.textContent = filtered.length + " risultati";
  empty.style.display = filtered.length ? "none" : "block";

  grid.innerHTML = filtered.map(item => {
    const isFav = Favs.has(item.file);
    return `
      <article class="card">
        <div class="card-top">
          <span class="pill">${item.category}</span>
          <button class="fav ${isFav ? "active" : ""}" onclick="toggleFav('${item.file}', this)">${isFav ? "★" : "☆"}</button>
        </div>
        <h3>${highlight(item.title, q)}</h3>
        <p>${smartExcerpt(item, q) || "Apri questa pagina dall’archivio Locoselli."}</p>
        <div class="card-actions">
          <a class="btn" href="${item.file}">Apri</a>
        </div>
      </article>
    `;
  }).join("");
}

function toggleFav(file, btn){
  const now = Favs.toggle(file);
  btn.classList.toggle("active", now);
  btn.innerHTML = now ? "★" : "☆";
  if (showFavsOnly && !now) render();
}
window.toggleFav = toggleFav;

function setCategory(cat){
  activeCategory = cat;
  renderChips();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.setCategory = setCategory;

function enterApp(){
  gate.style.display = "none";
  app.style.display = "block";
  loadFiles();
}

function checkCode(){
  if ((codeInput.value || "") === ACCESS_CODE){
    localStorage.setItem("locoselli_access", "ok");
    errorMsg.textContent = "";
    enterApp();
  }else{
    errorMsg.textContent = "Codice errato. Riprova.";
    codeInput.value = "";
    codeInput.focus();
  }
}

enterBtn.addEventListener("click", checkCode);
codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") checkCode(); });
searchInput.addEventListener("input", render);

favFilterBtn.addEventListener("click", () => {
  showFavsOnly = !showFavsOnly;
  favFilterBtn.classList.toggle("active", showFavsOnly);
  render();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("locoselli_access");
  location.reload();
});

window.addEventListener("scroll", () => {
  scrollFab.classList.toggle("visible", window.scrollY > 500);
}, { passive:true });

scrollFab.addEventListener("click", () => window.scrollTo({ top:0, behavior:"smooth" }));

if (localStorage.getItem("locoselli_access") === "ok"){
  window.addEventListener("load", enterApp);
}
