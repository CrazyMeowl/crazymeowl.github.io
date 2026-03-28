/* DeltaForce tool JS (moved from inline in deltaforce_tool.html) */
// Candidate JSON locations (try these in order)
const materialsPathCandidates = [
  'assets/deltaforce_tool/json/materials.json',
  'assets/materials.json',
  'assets/material/materials.json',
  'assets/materials/materials.json'
];
const ammoPathCandidates = [
  'assets/deltaforce_tool/json/ammo.json',
  'assets/ammo.json',
  'assets/ammo/ammo.json',
  'assets/ammos/ammo.json'
];
// Base asset folder for images (moved into a subfolder)
const assetBase = 'assets/deltaforce_tool';

// Optional external price map (separate from item JSON)
const pricesPathCandidates = [
  'assets/deltaforce_tool/json/price_map.json'
];
let priceMap = {}; // key -> numeric price (strings will be coerced)

// Localization
const availableLocales = ['en_us','vi_vn'];
let locale = null;
let translations = {};

function t(key) {
  return translations[key] || key;
}

async function loadLocale(l) {
  const chosen = l || localStorage.getItem(storagePrefix + 'locale') || (navigator.language||'en').toLowerCase();
  // map short codes to our files
  let code = chosen;
  if (code.startsWith('en')) code = 'en_us';
  if (code.startsWith('vi')) code = 'vi_vn';
  if (!availableLocales.includes(code)) code = 'en_us';
  try {
    const p = `assets/deltaforce_tool/json/i18n/${code}.json`;
    const res = await fetch(p);
    if (!res.ok) throw new Error('Locale fetch failed');
    translations = await res.json();
    locale = code;
    localStorage.setItem(storagePrefix + 'locale', locale);
  } catch (e) {
    // fallback to en_us
    try {
      const res = await fetch('assets/deltaforce_tool/json/i18n/en_us.json');
      translations = await res.json();
      locale = 'en_us';
      localStorage.setItem(storagePrefix + 'locale', locale);
    } catch (err) {
      translations = {};
      locale = 'en_us';
    }
  }
  applyTranslations();
  populateLocaleSelector();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const txt = t(key);
    // preserve inner HTML for elements that contain HTML tags like <strong>
    if (el.children.length) {
      // replace only text nodes: set a fallback via textContent when simple
      el.textContent = txt;
    } else {
      el.textContent = txt;
    }
  });
}

function populateLocaleSelector() {
  const sel = document.getElementById('localeSelect');
  if (!sel) return;
  // clear
  sel.innerHTML = '';
  availableLocales.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code.replace('_','-').toUpperCase();
    if (code === locale) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => { loadLocale(sel.value); };
}
const storagePrefix = 'deltaforce:'; // namespace localStorage keys

// Cached data and overrides
let materialsCache = {};
let ammoCache = {};
let combinedDataForRender = {};
const overrides = {}; // user-entered material prices
const ahOverrides = {}; // user-entered auction house price per 1 for ammo

// Generic per-unit price computation that consults overrides first
function computePerUnitFor(combinedData) {
  const memo = {};
  return function compute(name, stack = []) {
    if (memo[name] !== undefined) return memo[name];
    if (stack.includes(name)) { memo[name] = null; return null; }
    const key = findKey(combinedData, name);
    const item = combinedData[key];
    if (!item) { memo[name] = null; return null; }

    // If the item is craftable, always compute from its recipe (ignore any override for this item).
    if (item && item.recipe && typeof item.recipe === 'object') {
      const next = stack.concat(name);
      let sum = 0;
      if (Array.isArray(item.recipe)) {
        for (const comp of item.recipe) {
          let compName, qty;
          if (typeof comp === 'string') { compName = comp; qty = 1; }
          else { compName = comp.name; qty = comp.qty || 1; }
          const p = compute(compName, next);
          if (p === null) { memo[name] = null; return null; }
          sum += qty * p;
        }
      } else {
        for (const [compName, qtyRaw] of Object.entries(item.recipe)) {
          const qty = Number(qtyRaw) || 0;
          const p = compute(compName, next);
          if (p === null) { memo[name] = null; return null; }
          sum += qty * p;
        }
      }
      if (item.output && typeof item.output === 'number' && item.output > 0) {
        sum = sum / item.output;
      }
      memo[name] = sum; return sum;
    }

    // Not craftable: allow explicit overrides, then priceMap, then item.price
    if (overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== '') {
      const v = Number(overrides[name]);
      if (!Number.isNaN(v)) { memo[name] = v; return v; }
    }
    if (priceMap && priceMap[name] !== undefined) {
      const v = Number(priceMap[name]);
      if (!Number.isNaN(v)) { memo[name] = v; return v; }
    }
    if (typeof item.price === 'number') { memo[name] = item.price; return item.price; }
    memo[name] = null; return null;
  };
}

// Compute craft total (total cost of inputs for the recipe, NOT divided by output)
function computeTotalFor(combinedData) {
  const perUnit = computePerUnitFor(combinedData);
  const memo = {};
  return function total(name, stack = []) {
    if (memo[name] !== undefined) return memo[name];
    if (stack.includes(name)) { memo[name] = null; return null; }
    const key = findKey(combinedData, name);
    const item = combinedData[key];
    if (!item) { memo[name] = null; return null; }
    if (item && item.recipe && typeof item.recipe === 'object') {
      const next = stack.concat(name);
      let sum = 0;
      if (Array.isArray(item.recipe)) {
        for (const comp of item.recipe) {
          let compName, qty;
          if (typeof comp === 'string') { compName = comp; qty = 1; }
          else { compName = comp.name; qty = comp.qty || 1; }
          const p = perUnit(compName, next);
          if (p === null) { memo[name] = null; return null; }
          sum += qty * p;
        }
      } else {
        for (const [compName, qtyRaw] of Object.entries(item.recipe)) {
          const qty = Number(qtyRaw) || 0;
          const p = perUnit(compName, next);
          if (p === null) { memo[name] = null; return null; }
          sum += qty * p;
        }
      }
      memo[name] = sum; return sum;
    }
    // allow external price map to provide a direct price for this item
    const priceKey = findKey(priceMap, name);
    if (priceMap && priceMap[priceKey] !== undefined) {
      const out = item.output && typeof item.output === 'number' ? item.output : 1;
      const v = Number(priceMap[priceKey]);
      if (!Number.isNaN(v)) { memo[name] = v * out; return memo[name]; }
    }
    if (typeof item.price === 'number') {
      const out = item.output && typeof item.output === 'number' ? item.output : 1;
      memo[name] = item.price * out; return memo[name];
    }
    memo[name] = null; return null;
  };
}

async function loadAll() {
  try {
    // prefer embedded JSON script blocks for standalone use
    const mScript = document.getElementById('materialsData');
    const aScript = document.getElementById('ammoData');
    if (mScript) materialsCache = JSON.parse(mScript.textContent);
    else materialsCache = await fetchJsonWithFallback(materialsPathCandidates);
    if (aScript) ammoCache = JSON.parse(aScript.textContent);
    else ammoCache = await fetchJsonWithFallback(ammoPathCandidates);
    // load external price map (localStorage preferred, then files)
    try {
      const pm = await fetchJsonWithFallback(pricesPathCandidates).catch(() => null);
      if (pm) {
        // support both array-of-one-object and plain object formats
        if (Array.isArray(pm) && pm.length) priceMap = Object.assign({}, pm[0]);
        else if (typeof pm === 'object') priceMap = Object.assign({}, pm);
      }
    } catch (e) { /* ignore missing price map */ }
    // load any stored overrides then render
    loadOverridesFromLocalStorage();
    renderAll();
  } catch (err) {
    const tried = (err && err.tried) ? err.tried.join(', ') : '';
    const msgTemplate = (typeof t === 'function') ? t('failed_load_json') : 'Failed to load JSON data — checked: %s';
    const msg = msgTemplate.replace('%s', tried);
    document.body.insertAdjacentHTML('beforeend',`<p style="color:crimson">${msg}</p>`);
    console.error(err);
  }
}

async function fetchJsonWithFallback(candidates) {
  const tried = [];
  for (const p of candidates) {
    try {
      const res = await fetch(p);
      tried.push(p);
      if (!res.ok) continue;
      return await res.json();
    } catch (e) {
      tried.push(p);
      // continue to next candidate
    }
  }
  const err = new Error('All fetch attempts failed');
  err.tried = tried;
  throw err;
}

// LocalStorage helpers
function loadOverridesFromLocalStorage() {
  try {
    const p = localStorage.getItem(storagePrefix + 'priceMap');
    if (p) {
      const parsed = JSON.parse(p);
      // Remove any craftable material keys from loaded overrides so computed values remain authoritative
      Object.keys(parsed).forEach(k => {
        if (materialsCache[k] && materialsCache[k].recipe) delete parsed[k];
      });
      Object.assign(priceMap, parsed);
      // Also populate overrides from the loaded price map (excluding craftables)
      Object.assign(overrides, parsed);
      Object.assign(ahOverrides, parsed);
    }
  } catch (e) { console.warn('Failed to load priceMap from localStorage', e); }
}

// Helper: find a key in an object, try exact then case-insensitive match
function findKey(obj, name) {
  if (!obj || !name) return name;
  if (Object.prototype.hasOwnProperty.call(obj, name)) return name;
  const lower = name.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower) return k;
  }
  return name;
}

function getCombined() { return Object.assign({}, materialsCache, ammoCache); }

function renderAll() {
  // compute combined dataset for rendering and dynamic computations
    combinedDataForRender = getCombined();
    document.querySelector('#materialsTable tbody').innerHTML = '';
    document.querySelector('#ammoTable tbody').innerHTML = '';
    renderMaterials(materialsCache);
    renderAmmo(materialsCache, ammoCache);
    // update computed displays immediately (use JSON placeholders if present)
    updateComputedDisplays();
}

function renderMaterials(materials) {
  const tbody = document.querySelector('#materialsTable tbody');
    const compute = computePerUnitFor(getCombined());
    Object.keys(materials).forEach(name => {
    const item = materials[name];
    const img = item.image ? `${assetBase}/material/${item.image}` : '';
    const price = compute(name);
    const placeholder = price === null ? '' : price.toFixed(2);
      const hasRecipe = item.recipe && typeof item.recipe === 'object';
      const recipeHtml = hasRecipe ? renderRecipeHtml(item.recipe, compute) : '—';
      const recipeJsonAttr = hasRecipe ? JSON.stringify(item.recipe).replace(/'/g,'&#39;') : '';
      const displayName = item.name || t(name) || name;
      // If this material has a recipe, always treat it as computed (ignore stored overrides)
      // and make the input read-only so the computed value is shown consistently.
      const disabledAttr = hasRecipe ? 'disabled' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${img ? `<img class="thumb" src="${img}" alt="${displayName}"/>` : ''}</td>
        <td>${displayName}</td>
        <td><input type="number" step="1" min="0" data-name="${name}" class="price-input" placeholder="${placeholder}" value="" ${disabledAttr}></td>
        <td class="recipe-cell" data-recipe='${recipeJsonAttr}'>${recipeHtml}</td>
      `;

    tbody.appendChild(tr);
  });

    // attach listeners after elements are created
  document.querySelectorAll('.price-input').forEach(inp => {
    const name = inp.getAttribute('data-name');
    const isDisabled = inp.disabled;
    // restore existing override value if present (only for editable inputs)
    if (!isDisabled && overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== '') inp.value = overrides[name];
    if (isDisabled) {
      // ensure computed marker present so updateComputedDisplays will populate it
      inp.classList.add('computed');
      inp.dataset.computed = '1';
      return; // don't attach listeners to disabled (auto-calculated) inputs
    }
    inp.addEventListener('input', (e) => {
      const raw = e.target.value;
      // user started typing -> this is an explicit override
      e.target.classList.remove('computed');
      delete e.target.dataset.computed;
      // keep only digits (integers only)
      const sanitized = raw.replace(/[^0-9]/g, '');
      if (sanitized !== raw) e.target.value = sanitized;
      if (sanitized === '') delete overrides[name]; else overrides[name] = parseInt(sanitized, 10);
      // update computed displays without rebuilding inputs (keeps focus)
      updateComputedDisplays();
    });
    inp.addEventListener('blur', (e) => {
      const v = e.target.value.trim();
      if (v === '') {
        delete overrides[name];
      } else {
        const n = parseInt(v, 10);
        if (Number.isNaN(n)) { delete overrides[name]; e.target.value = ''; }
        else { overrides[name] = n; e.target.value = String(n); }
      }
      // update displays after blur
      updateComputedDisplays();
    });
  });
}

function renderAmmo(materials, ammo) {
  const tbody = document.querySelector('#ammoTable tbody');
  const combined = getCombined();
  const compute = computePerUnitFor(combined);
  const computeTotal = computeTotalFor(combined);

  Object.keys(ammo).forEach(name => {
    const item = ammo[name];
    const img = item.image ? `${assetBase}/ammo/${item.image}` : '';
    const perUnitPrice = compute(name);
    const craftTotal = computeTotal(name);
    const priceLabel = craftTotal === null ? '—' : '$' + craftTotal.toFixed(2);
    const hasRecipe = item.recipe && typeof item.recipe === 'object';
    const recipeHtml = hasRecipe ? renderRecipeHtml(item.recipe, compute) : (item.price ? '—' : 'Unknown');
    const recipeJsonAttr = hasRecipe ? JSON.stringify(item.recipe).replace(/'/g,'&#39;') : '';
    const outputQty = item.output && typeof item.output === 'number' ? item.output : 1;

    const displayName = item.name || t(name) || name;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${img ? `<img class="thumb" src="${img}" alt="${displayName}"/>` : ''}</td>
        <td>${displayName}</td>
        <td class="recipe-cell" data-recipe='${recipeJsonAttr}'>${recipeHtml}</td>
        <td class="qty-cell" data-name="${name}">${outputQty}</td>
        <td class="craft-price" data-name="${name}">${priceLabel}</td>
        <td><input type="number" step="1" min="0" class="ah-input" data-ammo-name="${name}" placeholder="0" value="0"></td>
        <td class="ah-qty-price" data-name="${name}">${computeAHQty(perUnitPrice, outputQty, name, item)}</td>
        <td class="profit-8" data-name="${name}"></td>
        <td class="profit-24" data-name="${name}"></td>
        <td class="rank" data-name="${name}"></td>
      `;

    // store recipe JSON on the cell so we can refresh placeholder prices later
    tbody.appendChild(tr);
  });

  // attach AH input listeners after elements are created
  document.querySelectorAll('.ah-input').forEach(inp => {
    const name = inp.getAttribute('data-ammo-name');
    if (ahOverrides[name] !== undefined && ahOverrides[name] !== null && ahOverrides[name] !== '') inp.value = ahOverrides[name];
    inp.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v === '') delete ahOverrides[name]; else ahOverrides[name] = Number(v);
      updateComputedDisplays();
    });
    inp.addEventListener('blur', (e) => { const v = e.target.value.trim(); if (v === '') delete ahOverrides[name]; updateComputedDisplays(); });
  });
}

function computeAHQty(craftPrice, outputQty, name, item) {
  // AH qty price uses AH override per 1 if present, else fallback to item's ah_price_1
  const ah1 = ahOverrides[name];
  const fallback = item && item.ah_price_1 ? item.ah_price_1 : undefined;
  const use = (ah1 === undefined || ah1 === null || ah1 === '') ? fallback : ah1;
  if (use === undefined || use === null || use === '') return '';
  const v = Number(use);
  if (Number.isNaN(v)) return '';
  return '$' + (v * outputQty).toFixed(2);
}

function renderRecipeHtml(recipe, compute) {
  if (!recipe || typeof recipe !== 'object') return '—';
  const parts = [];
  // support both array-of-components and object mapping { key: qty }
  if (Array.isArray(recipe)) {
    for (const comp of recipe) {
      let compName, qty;
      if (typeof comp === 'string') { compName = comp; qty = 1; }
      else { compName = comp.name; qty = comp.qty || 1; }
      const k = findKey(materialsCache, compName);
      const mat = materialsCache[k];
      const imgSrc = mat && mat.image ? `${assetBase}/material/${mat.image}` : '';
      const price = (typeof compute === 'function') ? compute(compName) : null;
      const priceHtml = (price === null || price === undefined || price === '') ? '' : `<div style="font-size:0.8rem;color:#444;margin-left:6px">$${Number(price).toFixed(2)}</div>`;
      const display = t(compName) || ((mat && mat.name) ? mat.name : compName);
      if (imgSrc) parts.push(`<span class="recipe-part"><img src="${imgSrc}" alt="${display}" onerror="this.style.opacity=.6"/><span class="qty-badge">×${qty}</span>${priceHtml}</span>`);
      else parts.push(`<span class="recipe-part">${display}<span class="qty-badge">×${qty}</span>${priceHtml}</span>`);
    }
  } else {
    for (const [compName, qtyRaw] of Object.entries(recipe)) {
      const qty = Number(qtyRaw) || 0;
      const k = findKey(materialsCache, compName);
      const mat = materialsCache[k];
      const imgSrc = mat && mat.image ? `${assetBase}/material/${mat.image}` : '';
      const price = (typeof compute === 'function') ? compute(compName) : null;
      const priceHtml = (price === null || price === undefined || price === '') ? '' : `<div style="font-size:0.8rem;color:#444;margin-left:6px">$${Number(price).toFixed(2)}</div>`;
      const display = t(compName) || ((mat && mat.name) ? mat.name : compName);
      if (imgSrc) parts.push(`<span class="recipe-part"><img src="${imgSrc}" alt="${display}" onerror="this.style.opacity=.6"/><span class="qty-badge">×${qty}</span>${priceHtml}</span>`);
      else parts.push(`<span class="recipe-part">${display}<span class="qty-badge">×${qty}</span>${priceHtml}</span>`);
    }
  }
  return parts.join('');
}

function updateComputedDisplays() {
  // update computed displays efficiently by computing per-unit and total craft values once
  const combined = getCombined();
  const computePerUnit = computePerUnitFor(combined);
  const computeTotal = computeTotalFor(combined);

  // update material input placeholders/values
  Object.keys(materialsCache).forEach(name => {
    const input = document.querySelector(`input[data-name="${name}"]`);
    if (!input) return;
    const price = computePerUnit(name);
    // If the user has entered an explicit override, don't overwrite it
    const hasOverride = overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== '';
    if (hasOverride) {
      // keep user's value, ensure computed marker removed
      input.classList.remove('computed');
      delete input.dataset.computed;
    } else {
      if (price === null) {
        input.placeholder = '';
        // clear any computed marker
        input.classList.remove('computed');
        delete input.dataset.computed;
        // only clear value if it was previously a computed value
        if (input.dataset.computed !== undefined) input.value = '';
      } else {
        // show computed value. If the input is focused (user typing), don't clobber
        if (document.activeElement !== input) {
          input.value = Number(price).toFixed(2);
        }
        input.placeholder = Number(price).toFixed(2);
        input.classList.add('computed');
        input.dataset.computed = '1';
      }
    }
  });

  // refresh recipe placeholders (recipe HTML stored as data-recipe on the cell)
  document.querySelectorAll('.recipe-cell').forEach(cell => {
    const raw = cell.getAttribute('data-recipe');
    if (!raw) return;
    try {
      const recipe = JSON.parse(raw);
      cell.innerHTML = renderRecipeHtml(recipe, computePerUnit);
    } catch (e) {
      // ignore parse error
    }
  });

  // Precompute values for ammo entries to avoid repeated recursion
  const ammoKeys = Object.keys(ammoCache).filter(k => k !== 'materials');
  const perUnitMap = {};
  const totalMap = {};
  ammoKeys.forEach(name => {
    perUnitMap[name] = computePerUnit(name);
    totalMap[name] = computeTotal(name);
  });

  // Update DOM cells using precomputed maps
  ammoKeys.forEach(name => {
    const total = totalMap[name];
    const craftTd = document.querySelector(`.craft-price[data-name="${name}"]`);
    if (craftTd) craftTd.textContent = total === null ? '—' : '$' + total.toFixed(2);

    const qtyTd = document.querySelector(`.qty-cell[data-name="${name}"]`);
    const item = ammoCache[name];
    const outputQty = item && item.output ? item.output : 1;
    if (qtyTd) qtyTd.textContent = outputQty;

    const ahQtyTd = document.querySelector(`.ah-qty-price[data-name="${name}"]`);
    const ah1 = ahOverrides[name];
    const fallback = item && item.ah_price_1 ? item.ah_price_1 : undefined;
    const use = (ah1 === undefined || ah1 === null || ah1 === '') ? fallback : ah1;
    if (ahQtyTd) {
      if (use === undefined || use === null || use === '') ahQtyTd.textContent = '';
      else {
        const v = Number(use);
        ahQtyTd.textContent = Number.isNaN(v) ? '' : '$' + (v * outputQty).toFixed(2);
      }
    }
  });

  // Compute profits in a single pass
  const profits = {};
  ammoKeys.forEach(name => {
    const craftTotal = totalMap[name];
    const item = ammoCache[name];
    const outputQty = item && item.output ? item.output : 1;
    const ah1 = ahOverrides[name];
    const fallback = item && item.ah_price_1 ? item.ah_price_1 : undefined;
    const use = (ah1 === undefined || ah1 === null || ah1 === '') ? fallback : ah1;
    if (craftTotal === null || use === undefined || use === null || use === '') { profits[name] = -Infinity; return; }
    const v = Number(use);
    if (Number.isNaN(v)) { profits[name] = -Infinity; return; }
    const ahQty = v * outputQty;
    const profit8 = ahQty * 0.8689 - craftTotal;
    profits[name] = profit8;
  });

  // Update profit and AH cells
  ammoKeys.forEach(name => {
    const p8 = profits[name];
    const p8Td = document.querySelector(`.profit-8[data-name="${name}"]`);
    const p24Td = document.querySelector(`.profit-24[data-name="${name}"]`);
    if (!isFinite(p8)) {
      if (p8Td) p8Td.textContent = '';
      if (p24Td) p24Td.textContent = '';
      return;
    }
    if (p8Td) p8Td.textContent = '$' + p8.toFixed(2);
    if (p24Td) p24Td.textContent = '$' + (p8 * 3).toFixed(2);
  });

  // Ranking (higher profit8 => rank 1)
  const sorted = Object.keys(profits).filter(n => isFinite(profits[n])).sort((a,b) => profits[b] - profits[a]);
  sorted.forEach((n,i) => {
    const td = document.querySelector(`.rank[data-name="${n}"]`);
    if (td) td.textContent = (i+1);
  });
}

// load locale first so UI strings are translated, then load data
loadLocale().then(() => loadAll());
// attach save/load/clear button listeners
// legacy saveBtn removed from UI; no-op kept for safety

const loadBtn = document.getElementById('loadBtn');
if (loadBtn) loadBtn.addEventListener('click', () => {
  // auto-load the latest dated snapshot (if any)
  const dates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(k)) dates.push(k);
  }
  if (dates.length === 0) { alert('No dated snapshots found in localStorage'); return; }
  dates.sort((a,b) => new Date(b) - new Date(a));
  const choice = dates[0];
  const raw = localStorage.getItem(choice);
  if (!raw) { alert('No data found for ' + choice); return; }
    try {
    const map = JSON.parse(raw);
    Object.keys(map).forEach(k => {
      if (/^MAT_\d+$/.test(k)) {
        // skip craftable materials when loading dated snapshots so computed values stay authoritative
        if (!(materialsCache[k] && materialsCache[k].recipe)) overrides[k] = map[k];
      } else if (/^AMMO_\d+$/.test(k)) ahOverrides[k] = map[k];
      else priceMap[k] = map[k];
    });
    try { localStorage.setItem(storagePrefix + 'materialOverrides', JSON.stringify(overrides)); } catch (e) {}
    try { localStorage.setItem(storagePrefix + 'ammoAHOverrides', JSON.stringify(ahOverrides)); } catch (e) {}
    try { localStorage.setItem(storagePrefix + 'priceMap', JSON.stringify(priceMap)); } catch (e) {}
    renderAll();
    console.log('Loaded latest snapshot', choice);
  } catch (e) { alert('Failed to parse snapshot: ' + e); }
});

const clearBtn = document.getElementById('clearBtn');
if (clearBtn) clearBtn.addEventListener('click', () => {
  if (!confirm('Clear stored overrides and dated snapshots?')) return;
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(k)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  clearOverridesLocal();
});
// The import handler is attached inside DOMContentLoaded to avoid duplicate bindings.

// Export current priceMap as a dated JSON file (array with one object)
const exportBtn = document.getElementById('exportPricesBtn');
if (exportBtn) exportBtn.addEventListener('click', () => {
  const d = new Date();
  const dateStr = String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + '/' + d.getFullYear();
  const out = {};
  const inner = {};
    try {
    // Collect material overrides from the table inputs (skip craftable materials)
    document.querySelectorAll('.price-input').forEach(inp => {
      const name = inp.getAttribute('data-name');
      if (materialsCache[name] && materialsCache[name].recipe) return; // skip craftables
      const v = inp.value.trim();
      if (v !== '') inner[name] = Number(v);
      else if (priceMap && priceMap[name] !== undefined) inner[name] = Number(priceMap[name]);
      else inner[name] = 0;
    });
    // Collect ammo AH prices from table inputs
    document.querySelectorAll('.ah-input').forEach(inp => {
      const name = inp.getAttribute('data-ammo-name');
      const v = inp.value.trim();
      if (v !== '') inner[name] = Number(v);
      else if (priceMap && priceMap[name] !== undefined) inner[name] = Number(priceMap[name]);
      else inner[name] = 0;
    });
    // Ensure any MAT_/AMMO_ keys in priceMap are included even if no inputs exist (skip craftables)
    Object.keys(priceMap || {}).forEach(k => {
      if ((/^MAT_\d+$/.test(k) || /^AMMO_\d+$/.test(k)) && inner[k] === undefined) {
        if (materialsCache[k] && materialsCache[k].recipe) return; // skip craftables
        inner[k] = Number(priceMap[k]) || 0;
      }
    });
  } catch (e) {
    console.warn('Failed to collect prices for export', e);
  }
  // export the inner mapping directly (no date key), compact JSON
  const payload = JSON.stringify(inner);
  const filename = `prices-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  // Try to copy to clipboard first; fallback to download if unavailable or rejected
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(() => {
      alert('Prices copied to clipboard');
    }).catch(() => {
      // fallback download
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } else {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

document.addEventListener('DOMContentLoaded', () => {
    const savePricesBtn = document.getElementById('savePricesBtn');
    const importPricesBtn = document.getElementById('importPricesBtn');
    const exportPricesBtn = document.getElementById('exportPricesBtn');

    loadLocale().then(loadAll);

    savePricesBtn.addEventListener('click', () => {
        const pricesToSave = {};
        document.querySelectorAll('.price-input').forEach(input => {
          const name = input.getAttribute('data-name');
          // don't save craftable materials; they are computed
          if (materialsCache[name] && materialsCache[name].recipe) return;
          const value = input.value || input.placeholder;
          if (name && value) {
            pricesToSave[name] = Number(value);
          }
        });
        document.querySelectorAll('.ah-input').forEach(input => {
            const name = input.getAttribute('data-ammo-name');
            const value = input.value || input.placeholder;
             if (name && value) {
                pricesToSave[name] = Number(value);
            }
        });
        
        try {
            localStorage.setItem(storagePrefix + 'priceMap', JSON.stringify(pricesToSave));
            alert('Current prices have been saved to your browser storage.');
        } catch (e) {
            alert('Failed to save prices.');
            console.error('LocalStorage error:', e);
        }
    });

    importPricesBtn.addEventListener('click', () => {
        const json = prompt('Paste your price map JSON here:');
        if (!json) return;
        try {
            const data = JSON.parse(json);
            // clear existing overrides before applying new ones
            Object.keys(overrides).forEach(k => delete overrides[k]);
            Object.keys(ahOverrides).forEach(k => delete ahOverrides[k]);
        // remove craftable materials from imported map so computed values remain authoritative
        const filtered = Object.assign({}, data);
        Object.keys(filtered).forEach(k => { if (materialsCache[k] && materialsCache[k].recipe) delete filtered[k]; });
        // apply filtered values to overrides and AH overrides
        Object.assign(overrides, filtered);
        Object.assign(ahOverrides, filtered);
        // also update active priceMap and persist it to localStorage
        priceMap = Object.assign({}, filtered);
        try { localStorage.setItem(storagePrefix + 'priceMap', JSON.stringify(priceMap)); } catch (e) { console.warn('Failed to save priceMap', e); }
        renderAll();
        alert('Prices imported and saved to local storage.');
        } catch (e) {
            alert('Invalid JSON. Please check the format.');
            console.error('JSON parse error:', e);
        }
    });

    exportPricesBtn.addEventListener('click', () => {
        const pricesToExport = {};
      document.querySelectorAll('.price-input').forEach(input => {
        const name = input.getAttribute('data-name');
        // skip craftable materials
        if (materialsCache[name] && materialsCache[name].recipe) return;
        const value = input.value || input.placeholder;
        if (name && value) {
          pricesToExport[name] = Number(value);
        }
      });
        document.querySelectorAll('.ah-input').forEach(input => {
            const name = input.getAttribute('data-ammo-name');
            const value = input.value || input.placeholder;
             if (name && value) {
                pricesToExport[name] = Number(value);
            }
        });

        const jsonString = JSON.stringify(pricesToExport);
        navigator.clipboard.writeText(jsonString).catch(err => {
            alert('Failed to copy prices.');
            console.error('Clipboard error:', err);
        });
    });
});
