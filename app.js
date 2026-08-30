"use strict";

/* ---------- State ---------- */
const state = {
  quotes: [],
  mainQuery: "",
  lyricsQuery: "",
  activeTags: new Set(),
  matchMode: "AND", // "AND" = match ALL selected tags, "OR" = match ANY
};

let lastFocusedEl = null;

/* ---------- DOM refs ---------- */
const els = {
  grid: document.getElementById("quote-grid"),
  empty: document.getElementById("empty-state"),
  tagFilters: document.getElementById("tag-filters"),
  mainInput: document.getElementById("search-input"),
  lyricsInput: document.getElementById("lyrics-input"),
  surpriseBtn: document.getElementById("surprise-btn"),
  modeAnd: document.getElementById("mode-and"),
  modeOr: document.getElementById("mode-or"),
  modal: document.getElementById("quote-modal"),
  modalContent: document.getElementById("modal-content"),
  toast: document.getElementById("toast"),
};

/* ---------- Helpers ---------- */
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.classList.remove("is-hiding");
  toastTimer = setTimeout(() => {
    els.toast.classList.add("is-hiding");
    setTimeout(() => {
      els.toast.hidden = true;
    }, 300);
  }, 1800);
}

function copyText(text, successMessage) {
  const done = () => showToast(successMessage);
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      showToast("Copy failed");
    }
    document.body.removeChild(ta);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else {
    fallback();
  }
}

function quoteById(id) {
  return state.quotes.find((q) => q.id === id);
}

function attributionOf(q) {
  return `${q.band} · ${q.song} (${q.year}) · ${q.album}`;
}

/* ---------- Filtering ---------- */
function matchesFilters(q) {
  const main = state.mainQuery.trim().toLowerCase();
  if (main) {
    const haystack = [q.quote, q.band, q.song, q.album].join(" ").toLowerCase();
    if (!haystack.includes(main)) return false;
  }

  const lyr = state.lyricsQuery.trim().toLowerCase();
  if (lyr && !q.lyrics.toLowerCase().includes(lyr)) return false;

  if (state.activeTags.size > 0) {
    const tags = q.tags || [];
    if (state.matchMode === "AND") {
      for (const t of state.activeTags) {
        if (!tags.includes(t)) return false;
      }
    } else {
      let any = false;
      for (const t of state.activeTags) {
        if (tags.includes(t)) {
          any = true;
          break;
        }
      }
      if (!any) return false;
    }
  }

  return true;
}

function filteredQuotes() {
  return state.quotes.filter(matchesFilters);
}

/* ---------- Rendering ---------- */
function makeTagEl(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function renderCard(q) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = q.id;

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "card-icon-btn card-copy";
  copyBtn.textContent = "Copy lyrics";
  copyBtn.setAttribute("aria-label", `Copy lyrics of ${q.song}`);
  copyBtn.addEventListener("click", () => copyText(q.lyrics, "Lyrics copied"));

  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "card-icon-btn card-more";
  moreBtn.textContent = "More";
  moreBtn.setAttribute("aria-label", `More about ${q.song}`);
  moreBtn.addEventListener("click", () => openModal(q.id, moreBtn));

  const quoteEl = document.createElement("p");
  quoteEl.className = "card-quote";
  quoteEl.textContent = q.quote;

  const bandEl = document.createElement("div");
  bandEl.className = "card-band";
  bandEl.textContent = q.band;

  const songEl = document.createElement("div");
  songEl.className = "card-song";
  songEl.textContent = `${q.song} (${q.year}) · ${q.album}`;

  const tagsEl = document.createElement("div");
  tagsEl.className = "card-tags";
  (q.tags || []).forEach((t) => tagsEl.appendChild(makeTagEl("card-tag", t)));

  card.append(copyBtn, moreBtn, quoteEl, bandEl, songEl, tagsEl);
  return card;
}

function render() {
  const list = filteredQuotes();

  els.grid.innerHTML = "";
  list.forEach((q) => els.grid.appendChild(renderCard(q)));

  els.empty.hidden = list.length !== 0;
}

function renderTagChips() {
  const allTags = new Set();
  state.quotes.forEach((q) => (q.tags || []).forEach((t) => allTags.add(t)));
  const sorted = [...allTags].sort();

  els.tagFilters.innerHTML = "";
  sorted.forEach((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = tag;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      if (state.activeTags.has(tag)) {
        state.activeTags.delete(tag);
        chip.classList.remove("is-active");
        chip.setAttribute("aria-pressed", "false");
      } else {
        state.activeTags.add(tag);
        chip.classList.add("is-active");
        chip.setAttribute("aria-pressed", "true");
      }
      render();
    });
    els.tagFilters.appendChild(chip);
  });
}

/* ---------- Modal ---------- */
function openModal(id, triggerEl) {
  const q = quoteById(id);
  if (!q) return;

  lastFocusedEl = triggerEl || document.activeElement;

  els.modalContent.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.id = "modal-quote";
  h2.textContent = q.quote;

  const attr = document.createElement("p");
  attr.className = "modal-attribution";
  attr.textContent = attributionOf(q);

  const ctxHead = document.createElement("h3");
  ctxHead.textContent = "Context";
  const ctx = document.createElement("p");
  ctx.textContent = q.context;

  const albumHead = document.createElement("h3");
  albumHead.textContent = "On the album";
  const album = document.createElement("p");
  album.textContent = q.albumNote;

  const lyrHead = document.createElement("h3");
  lyrHead.textContent = "Lyrics";
  const lyr = document.createElement("p");
  lyr.className = "modal-lyrics";
  lyr.textContent = q.lyrics;

  const tagsHead = document.createElement("h3");
  tagsHead.textContent = "Themes";
  const tags = document.createElement("div");
  tags.className = "modal-tags";
  (q.tags || []).forEach((t) => tags.appendChild(makeTagEl("card-tag", t)));

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "modal-share";
  shareBtn.textContent = "Copy share link";
  shareBtn.addEventListener("click", () => {
    const url = location.origin + location.pathname + "?q=" + encodeURIComponent(q.id);
    copyText(url, "Link copied");
  });

  els.modalContent.append(
    h2, attr,
    lyrHead, lyr,
    ctxHead, ctx,
    tagsHead, tags,
    albumHead, album,
    shareBtn
  );

  els.modal.hidden = false;
  document.body.style.overflow = "hidden";
  els.modal.querySelector(".modal-close").focus();
}

function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }
  lastFocusedEl = null;
}

/* ---------- Surprise me ---------- */
function surprise() {
  const list = filteredQuotes();
  if (list.length === 0) return;
  const pick = list[Math.floor(Math.random() * list.length)];
  const card = els.grid.querySelector(`.card[data-id="${CSS.escape(pick.id)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.style.borderColor = "var(--accent)";
  setTimeout(() => {
    card.style.borderColor = "";
  }, 1200);
}

/* ---------- Wiring ---------- */
function setMatchMode(mode) {
  state.matchMode = mode;
  const isAnd = mode === "AND";
  els.modeAnd.classList.toggle("is-active", isAnd);
  els.modeOr.classList.toggle("is-active", !isAnd);
  els.modeAnd.setAttribute("aria-pressed", String(isAnd));
  els.modeOr.setAttribute("aria-pressed", String(!isAnd));
  render();
}

function wireEvents() {
  els.mainInput.addEventListener(
    "input",
    debounce((e) => {
      state.mainQuery = e.target.value;
      render();
    }, 120)
  );

  els.lyricsInput.addEventListener(
    "input",
    debounce((e) => {
      state.lyricsQuery = e.target.value;
      render();
    }, 120)
  );

  els.surpriseBtn.addEventListener("click", surprise);
  els.modeAnd.addEventListener("click", () => setMatchMode("AND"));
  els.modeOr.addEventListener("click", () => setMatchMode("OR"));

  els.modal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeModal();
  });
}

/* ---------- Init ---------- */
function init() {
  wireEvents();

  fetch("quotes.json")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      state.quotes = Array.isArray(data) ? data : [];
      renderTagChips();
      render();

      const params = new URLSearchParams(location.search);
      const q = params.get("q");
      if (q && quoteById(q)) openModal(q, null);
    })
    .catch((err) => {
      els.grid.innerHTML = "";
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent =
        "Could not load quotes. If you opened this file directly, serve it over HTTP (e.g. python -m http.server).";
      els.grid.appendChild(p);
      console.error("Failed to load quotes.json:", err);
    });
}

document.addEventListener("DOMContentLoaded", init);
