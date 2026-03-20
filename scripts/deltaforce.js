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
    if (overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== '') {
      const v = Number(overrides[name]);
      if (!Number.isNaN(v)) { memo[name] = v; return v; }
    }
    if (memo[name] !== undefined) return memo[name];
    if (stack.includes(name)) { memo[name] = null; return null; }
    const key = findKey(combinedData, name);
    const item = combinedData[key];
    if (!item) { memo[name] = null; return null; }
    if (typeof item.price === 'number') { memo[name] = item.price; return item.price; }
    if (Array.isArray(item.recipe)) {
      const next = stack.concat(name);
      let sum = 0;
      for (const comp of item.recipe) {
        let compName, qty;
        if (typeof comp === 'string') { compName = comp; qty = 1; }
        else { compName = comp.name; qty = comp.qty || 1; }
        const p = compute(compName, next);
        if (p === null) { memo[name] = null; return null; }
        sum += qty * p;
      }
      // If the recipe produces multiple units, divide total cost by output quantity (per-unit price)
      if (item.output && typeof item.output === 'number' && item.output > 0) {
        sum = sum / item.output;
      }
      memo[name] = sum; return sum;
    }
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
    if (Array.isArray(item.recipe)) {
      const next = stack.concat(name);
      let sum = 0;
      for (const comp of item.recipe) {
        let compName, qty;
        if (typeof comp === 'string') { compName = comp; qty = 1; }
        else { compName = comp.name; qty = comp.qty || 1; }
        const p = perUnit(compName, next);
        if (p === null) { memo[name] = null; return null; }
        sum += qty * p;
      }
      memo[name] = sum; return sum;
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
function persistOverrides(silent = false) {
  try {
    localStorage.setItem(storagePrefix + 'materialOverrides', JSON.stringify(overrides));
    localStorage.setItem(storagePrefix + 'ammoAHOverrides', JSON.stringify(ahOverrides));
    if (!silent) alert('Overrides saved locally');
  } catch (e) { if (!silent) alert('Failed to save overrides: '+e); }
}

function loadOverridesFromLocalStorage() {
  try {
    const m = localStorage.getItem(storagePrefix + 'materialOverrides');
    const a = localStorage.getItem(storagePrefix + 'ammoAHOverrides');
    if (m) {
      const parsed = JSON.parse(m);
      Object.assign(overrides, parsed);
    }
    if (a) {
      const parsed = JSON.parse(a);
      Object.assign(ahOverrides, parsed);
    }
  } catch (e) { console.warn('Failed to load overrides from localStorage', e); }
}

function clearOverridesLocal() {
  if (!confirm('Clear stored overrides?')) return;
  localStorage.removeItem(storagePrefix + 'materialOverrides');
  localStorage.removeItem(storagePrefix + 'ammoAHOverrides');
  // also clear in-memory and inputs
  for (const k in overrides) delete overrides[k];
  for (const k in ahOverrides) delete ahOverrides[k];
  document.querySelectorAll('.price-input').forEach(i => i.value = '');
  document.querySelectorAll('.ah-input').forEach(i => i.value = '');
  updateComputedDisplays();
  alert('Overrides cleared');
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
      const recipeHtml = Array.isArray(item.recipe) ? renderRecipeHtml(item.recipe, compute) : '—';
      const recipeJsonAttr = Array.isArray(item.recipe) ? JSON.stringify(item.recipe).replace(/'/g,'&#39;') : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${img ? `<img class="thumb" src="${img}" alt="${name}"/>` : ''}</td>
        <td>${name}</td>
        <td><input type="number" step="0.01" min="0" data-name="${name}" class="price-input" placeholder="${placeholder}" value=""></td>
        <td class="recipe-cell" data-recipe='${recipeJsonAttr}'>${recipeHtml}</td>
      `;

    tbody.appendChild(tr);
  });

  // attach listeners after elements are created
  document.querySelectorAll('.price-input').forEach(inp => {
    const name = inp.getAttribute('data-name');
    // restore existing override value if present
    if (overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== '') inp.value = overrides[name];
    inp.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v === '') delete overrides[name]; else overrides[name] = Number(v);
      // update computed displays without rebuilding inputs (keeps focus)
      updateComputedDisplays();
    });
    inp.addEventListener('blur', (e) => {
      const v = e.target.value.trim();
      if (v === '') delete overrides[name];
      // persist silently on blur
      persistOverrides(true);
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

    const recipeHtml = Array.isArray(item.recipe) ? renderRecipeHtml(item.recipe, compute) : (item.price ? '—' : 'Unknown');
    const outputQty = item.output && typeof item.output === 'number' ? item.output : 1;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${img ? `<img class="thumb" src="${img}" alt="${name}"/>` : ''}</td>
        <td>${name}</td>
        <td class="recipe-cell">${recipeHtml}</td>
        <td class="qty-cell" data-name="${name}">${outputQty}</td>
        <td class="craft-price" data-name="${name}">${priceLabel}</td>
        <td><input type="number" step="0.01" min="0" class="ah-input" data-ammo-name="${name}" placeholder="${item.ah_price_1||''}" value=""></td>
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
    inp.addEventListener('blur', (e) => { const v = e.target.value.trim(); if (v === '') delete ahOverrides[name]; persistOverrides(true); updateComputedDisplays(); });
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
  if (!Array.isArray(recipe)) return '—';
  // use materialsCache images for recipe components and show per-component placeholder price when available
  return recipe.map(comp => {
    let compName, qty;
    if (typeof comp === 'string') { compName = comp; qty = 1; }
    else { compName = comp.name; qty = comp.qty || 1; }
    const k = findKey(materialsCache, compName);
    const mat = materialsCache[k];
    const imgSrc = mat && mat.image ? `${assetBase}/material/${mat.image}` : '';
    const price = (typeof compute === 'function') ? compute(compName) : null;
    const priceHtml = (price === null || price === undefined || price === '') ? '' : `<div style="font-size:0.8rem;color:#444;margin-left:6px">$${Number(price).toFixed(2)}</div>`;
    if (imgSrc) {
      return `<span class="recipe-part"><img src="${imgSrc}" alt="${compName}" onerror="this.style.opacity=.6"/><span class="qty-badge">×${qty}</span>${priceHtml}</span>`;
    }
    return `<span class="recipe-part">${compName}<span class="qty-badge">×${qty}</span>${priceHtml}</span>`;
  }).join('');
}

function updateComputedDisplays() {
  // update computed displays efficiently by computing per-unit and total craft values once
  const combined = getCombined();
  const computePerUnit = computePerUnitFor(combined);
  const computeTotal = computeTotalFor(combined);

  // update material input placeholders
  Object.keys(materialsCache).forEach(name => {
    const input = document.querySelector(`input[data-name="${name}"]`);
    if (!input) return;
    const price = computePerUnit(name);
    input.placeholder = (price === null) ? '' : price.toFixed(2);
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
document.getElementById('saveBtn').addEventListener('click', () => persistOverrides(false));
document.getElementById('loadBtn').addEventListener('click', () => { loadOverridesFromLocalStorage(); renderAll(); });
document.getElementById('clearBtn').addEventListener('click', clearOverridesLocal);
