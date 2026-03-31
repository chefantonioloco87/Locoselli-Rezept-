/* ── Locoselli Ricette App ── */

// R is loaded from app_data.js: array of [id, title, category, body]
// Custom recipes stored in localStorage

const CATEGORIES = [
  'Tutte','Agar & Gel','Biscotti & Frolle','Cannoli & Peperoni',
  'Cioccolato','Cottura Controllata','Destrosio','Gelburger & Gelcrem',
  'Glice','Glice & Sucro','Inulina','Isomalto','Maltodestrina',
  'Neutral Glaze','Panettoni & Pandori','Panne Cotte','Sferificazione',
  'Spume & Sifone','Sucroesteri','Texture','Tortini Salati',
  'Trealosio','Vegano','Altre Ricette'
];

let allRecipes = [];
let customRecipes = [];
let filteredRecipes = [];
let currentCategory = 'Tutte';
let currentQuery = '';
let visibleCount = 30;

// ── Init ──
function init() {
  // Parse base recipes from R (loaded via app_data.js)
  if (typeof R !== 'undefined') {
    allRecipes = R.map(r => ({
      id: r[0],
      title: r[1],
      category: r[2],
      body: r[3],
      custom: false
    }));
  }

  // Load custom recipes from localStorage
  loadCustomRecipes();

  // Build UI
  renderCategories();
  bindEvents();
  filterAndRender();
}

function loadCustomRecipes() {
  try {
    const stored = localStorage.getItem('locoselli_custom');
    if (stored) {
      customRecipes = JSON.parse(stored);
    }
  } catch (e) { /* ignore */ }
}

function saveCustomRecipes() {
  try {
    localStorage.setItem('locoselli_custom', JSON.stringify(customRecipes));
  } catch (e) { /* ignore */ }
}

function getAllRecipes() {
  return [...allRecipes, ...customRecipes];
}

// ── Categories ──
function renderCategories() {
  const wrap = document.getElementById('categories');
  wrap.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-chip${c === currentCategory ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
}

// ── Search & Filter ──
function filterAndRender() {
  const all = getAllRecipes();
  const q = currentQuery.toLowerCase().trim();
  const cat = currentCategory;

  filteredRecipes = all.filter(r => {
    // Category filter
    if (cat !== 'Tutte' && r.category !== cat) return false;
    // Search filter - searches title + full body (ingredients included)
    if (q) {
      const searchable = (r.title + ' ' + r.body).toLowerCase();
      // Split query into words - ALL must match
      const words = q.split(/\s+/).filter(w => w.length > 1);
      return words.every(w => searchable.includes(w));
    }
    return true;
  });

  visibleCount = 30;
  renderRecipes();
  updateStats();
}

function updateStats() {
  const el = document.getElementById('searchStats');
  const q = currentQuery.trim();
  if (q) {
    el.textContent = `${filteredRecipes.length} risultat${filteredRecipes.length === 1 ? 'o' : 'i'} per "${q}"`;
  } else if (currentCategory !== 'Tutte') {
    el.textContent = `${filteredRecipes.length} ricett${filteredRecipes.length === 1 ? 'a' : 'e'} in ${currentCategory}`;
  } else {
    el.textContent = `${filteredRecipes.length} ricette totali`;
  }
}

// ── Render Recipes ──
function renderRecipes() {
  const container = document.getElementById('recipeList');

  if (filteredRecipes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🔍</div>
        <p>Nessuna ricetta trovata.<br>Prova a cercare con un altro termine.</p>
      </div>`;
    return;
  }

  const toShow = filteredRecipes.slice(0, visibleCount);
  const q = currentQuery.toLowerCase().trim();

  container.innerHTML = toShow.map(r => {
    let title = escapeHtml(r.title);
    let preview = escapeHtml(r.body.substring(0, 120));

    // Highlight search terms
    if (q) {
      const words = q.split(/\s+/).filter(w => w.length > 1);
      words.forEach(w => {
        const re = new RegExp(`(${escapeRegex(w)})`, 'gi');
        title = title.replace(re, '<mark>$1</mark>');
        preview = preview.replace(re, '<mark>$1</mark>');
      });
    }

    return `
      <div class="recipe-card" data-id="${r.id}" data-custom="${r.custom || false}">
        <div class="recipe-card-header">
          <div class="recipe-title">${title}</div>
          <span class="recipe-cat-badge">${escapeHtml(r.category)}</span>
        </div>
        <div class="recipe-preview">${preview}</div>
      </div>`;
  }).join('');

  // Infinite scroll sentinel
  if (visibleCount < filteredRecipes.length) {
    container.innerHTML += '<div id="loadMore" style="height:1px"></div>';
    observeLoadMore();
  }
}

function observeLoadMore() {
  const el = document.getElementById('loadMore');
  if (!el) return;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      visibleCount += 30;
      renderRecipes();
    }
  });
  obs.observe(el);
}

// ── Recipe Detail ──
function openRecipe(id, isCustom) {
  let recipe;
  if (isCustom) {
    recipe = customRecipes.find(r => r.id == id);
  } else {
    recipe = allRecipes.find(r => r.id == id);
  }
  if (!recipe) return;

  document.getElementById('modalCategory').textContent = recipe.category;
  document.getElementById('modalRecipeTitle').textContent = recipe.title;

  // Format body - convert markdown-like formatting
  let body = escapeHtml(recipe.body);
  // Bold
  body = body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Headers
  body = body.replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>');

  document.getElementById('modalContent').innerHTML = body;

  // Show delete button only for custom recipes
  const delBtn = document.getElementById('modalDelete');
  if (recipe.custom) {
    delBtn.classList.remove('hidden');
    delBtn.onclick = () => deleteRecipe(recipe.id);
  } else {
    delBtn.classList.add('hidden');
  }

  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('recipeModal').classList.add('open');
  document.getElementById('modalTitle').textContent = recipe.title;
  document.body.style.overflow = 'hidden';
}

function closeRecipe() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('recipeModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Add Recipe ──
function openAddForm() {
  const modal = document.getElementById('addModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Populate category select
  const sel = document.getElementById('addCategory');
  sel.innerHTML = CATEGORIES.filter(c => c !== 'Tutte').map(c =>
    `<option value="${c}">${c}</option>`
  ).join('');
}

function closeAddForm() {
  document.getElementById('addModal').classList.remove('open');
  document.body.style.overflow = '';
}

function saveNewRecipe() {
  const title = document.getElementById('addTitle').value.trim();
  const category = document.getElementById('addCategory').value;
  const body = document.getElementById('addBody').value.trim();

  if (!title || !body) {
    showToast('Inserisci titolo e ricetta');
    return;
  }

  const maxId = Math.max(
    ...getAllRecipes().map(r => r.id),
    10000
  );

  const recipe = {
    id: maxId + 1,
    title,
    category,
    body,
    custom: true
  };

  customRecipes.push(recipe);
  saveCustomRecipes();

  // Clear form
  document.getElementById('addTitle').value = '';
  document.getElementById('addBody').value = '';

  closeAddForm();
  filterAndRender();
  showToast('Ricetta aggiunta!');
}

function deleteRecipe(id) {
  if (!confirm('Eliminare questa ricetta?')) return;
  customRecipes = customRecipes.filter(r => r.id !== id);
  saveCustomRecipes();
  closeRecipe();
  filterAndRender();
  showToast('Ricetta eliminata');
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Utilities ──
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Event Binding ──
function bindEvents() {
  // Search input
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    clearBtn.classList.toggle('show', input.value.length > 0);
    debounce = setTimeout(() => {
      currentQuery = input.value;
      filterAndRender();
    }, 200);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    currentQuery = '';
    clearBtn.classList.remove('show');
    filterAndRender();
    input.focus();
  });

  // Category chips
  document.getElementById('categories').addEventListener('click', e => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    currentCategory = chip.dataset.cat;
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filterAndRender();
  });

  // Recipe card click
  document.getElementById('recipeList').addEventListener('click', e => {
    const card = e.target.closest('.recipe-card');
    if (!card) return;
    openRecipe(card.dataset.id, card.dataset.custom === 'true');
  });

  // Modal close
  document.getElementById('modalBack').addEventListener('click', closeRecipe);
  document.getElementById('modalOverlay').addEventListener('click', closeRecipe);

  // Add recipe
  document.getElementById('btnAdd').addEventListener('click', openAddForm);
  document.getElementById('addBack').addEventListener('click', closeAddForm);
  document.getElementById('btnSave').addEventListener('click', saveNewRecipe);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeRecipe();
      closeAddForm();
    }
  });
}

// ── Start ──
document.addEventListener('DOMContentLoaded', init);
