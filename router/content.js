
// Router Device Labels v1.12 — fixed-position layer + robust hash matching
(function () {
  const STORAGE_KEY = "rdlMap";
  const LABEL_WIDTH = 120;
  const GUTTER_GAP  = 8;
  const REFRESH_MS  = 500;

  let mapCache = {};
  let paintTimer = null;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function normalizeMac(text) {
    if (!text) return "";
    const hex = text.toUpperCase().replace(/[^0-9A-F]/g, "");
    if (hex.length !== 12) return "";
    return hex.match(/.{1,2}/g).join(":");
  }

  function isAllowedHash(h) {
    return /^#(?:home|black_list)\b/i.test(h || "");
  }

  function ensureLayer() {
    let layer = $("#rdl-right-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "rdl-right-layer";
      layer.style.position = "fixed";  // fixed to viewport so rect math is simple
      layer.style.left = "0";
      layer.style.top = "0";
      layer.style.width = "100vw";
      layer.style.height = "100vh";
      layer.style.pointerEvents = "none";
      layer.style.zIndex = "9999";
      document.body.appendChild(layer);
    }
    return layer;
  }
  function removeLayer() {
    const layer = $("#rdl-right-layer");
    if (layer) layer.remove();
  }

  function getContext() {
    const hash = location.hash || "";
    if (!isAllowedHash(hash)) return null;

    if (/^#home\b/i.test(hash)) {
      const table = $("#tabStation");
      if (!table) return null;
      const rows = $$("tbody tr", table);
      const keyFromRow = (tr) => {
        const tds = tr.querySelectorAll("td");
        const name = tds[1]?.textContent.trim() || "";
        let mac = tds[2]?.textContent.trim() || "";
        if (!mac) {
          const btn = tr.querySelector('input[type="button"][id^="block"]');
          if (btn && btn.getAttribute("mac")) mac = btn.getAttribute("mac");
        }
        const nmac = normalizeMac(mac);
        if (nmac) return "MAC:" + nmac;
        if (name) return "NAME:" + name.toLowerCase();
        const ip = tr.querySelector('input[id^="block"]')?.getAttribute("ip") || "";
        if (ip) return "IP:" + ip;
        return "";
      };
      return { idPrefix: "home", table, rows, keyFromRow };
    }

    if (/^#black_list\b/i.test(hash)) {
      const tbody = $("#blacklist");
      if (!tbody) return null;
      const table = tbody.closest("table");
      const rows = $$("tr", tbody);
      const keyFromRow = (tr) => {
        const tds = tr.querySelectorAll("td");
        const name = tds[1]?.textContent.trim() || "";
        const mac  = tds[2]?.textContent.trim() || "";
        const nmac = normalizeMac(mac);
        if (nmac) return "MAC:" + nmac;
        if (name) return "NAME:" + name.toLowerCase();
        return "";
      };
      return { idPrefix: "blk", table, rows, keyFromRow };
    }
    return null;
  }

  function ensureItem(layer, id) {
    let item = layer.querySelector(`[data-id="${id}"]`);
    if (!item) {
      item = document.createElement("div");
      item.className = "rdl-gutter-item";
      item.dataset.id = id;
      const span = document.createElement("span");
      span.className = "rdl-gutter-text";
      const edit = document.createElement("button");
      edit.className = "rdl-gutter-edit";
      edit.textContent = "✎";
      edit.title = "Изменить метку";
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = item.dataset.key || "";
        const start = item.dataset.empty === "1" ? "" : span.textContent;
        const next = prompt("Введите метку:", start);
        if (next === null) return;
        const trimmed = (next || "").trim();
        if (trimmed) {
          item.dataset.empty = "0";
          span.textContent = trimmed;
          if (key) mapCache[key] = trimmed;
        } else {
          item.dataset.empty = "1";
          span.textContent = "—";
          if (key) delete mapCache[key];
        }
        chrome.storage.local.set({[STORAGE_KEY]: mapCache});
      });
      item.append(span, edit);
      layer.appendChild(item);
    }
    return item;
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function paint() {
    const ctx = getContext();
    if (!ctx) { removeLayer(); return; }

    const { idPrefix, table, rows, keyFromRow } = ctx;
    const layer = ensureLayer();
    const tRect = table.getBoundingClientRect();
    const baseLeft = tRect.right + GUTTER_GAP;
    const viewportRight = (window.innerWidth || document.documentElement.clientWidth);
    const left = clamp(baseLeft, 8, viewportRight - LABEL_WIDTH - 8);

    rows.forEach((tr, i) => {
      const key = keyFromRow(tr);
      if (!key) return;
      const rRect = tr.getBoundingClientRect();
      const id = `${idPrefix}-row-${i}`;
      const item = ensureItem(layer, id);
      item.dataset.key = key;

      const top = rRect.top + rRect.height / 2;
      item.style.left = left + "px";
      item.style.top = top + "px";
      item.style.width = LABEL_WIDTH + "px";
      item.style.transform = "translateY(-50%)";

      const saved = mapCache[key] || "";
      const span = item.querySelector(".rdl-gutter-text");
      if (saved) {
        item.dataset.empty = "0";
        if (span.textContent !== saved) span.textContent = saved;
      } else {
        item.dataset.empty = "1";
        if (span.textContent !== "—") span.textContent = "—";
      }
    });

    const validIds = new Set(rows.map((_, i) => `${idPrefix}-row-${i}`));
    Array.from(layer.querySelectorAll(".rdl-gutter-item")).forEach(el => {
      if (!validIds.has(el.dataset.id)) el.remove();
    });
  }

  function evaluate() {
    if (isAllowedHash(location.hash)) {
      if (!paintTimer) {
        paintTimer = setInterval(paint, REFRESH_MS);
        window.addEventListener("scroll", paint, { passive: true });
        window.addEventListener("resize", paint);
      }
      paint();
    } else {
      if (paintTimer) {
        clearInterval(paintTimer);
        paintTimer = null;
        window.removeEventListener("scroll", paint);
        window.removeEventListener("resize", paint);
      }
      removeLayer();
    }
  }

  function start() {
    chrome.storage.local.get(STORAGE_KEY, res => {
      mapCache = res[STORAGE_KEY] || {};
      evaluate();
      window.addEventListener("hashchange", evaluate);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
