/* =========================================================
   TERRAPULSE V3
   NASA EONET Earth Event Intelligence Dashboard
   ========================================================= */

const API_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000";

const CACHE_KEY = "terrapulse-last-events-v3";
const WATCHLIST_KEY = "terrapulse-watchlist-v3";

let allEvents = [];
let filteredEvents = [];
let watchlist = new Set(
  JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]")
);

let map;
let markersLayer;
let currentMarkerById = new Map();

const $ = id => document.getElementById(id);

/* =========================================================
   REQUIRED EXISTING ELEMENTS
   ========================================================= */

const eventCount = $("eventCount");
const categoryCount = $("categoryCount");
const highCount = $("highCount");
const lastRefresh = $("lastRefresh");

const categorySelect = $("categorySelect");
const scoreSelect = $("scoreSelect");
const searchInput = $("searchInput");

const eventList = $("eventList");
const feedMeta = $("feedMeta");
const mapMeta = $("mapMeta");

const refreshBtn = $("refreshBtn");
const clearBtn = $("clearBtn");

const toast = $("toast");

/* =========================================================
   MAP
   ========================================================= */

map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2,
  maxZoom: 18,
  scrollWheelZoom: true
}).setView([20, 0], 2);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

markersLayer = L.layerGroup().addTo(map);

/* =========================================================
   DYNAMIC STYLES
   We inject the extra UI styles from JavaScript so that
   you do NOT need to edit styles.css again.
   ========================================================= */

const dynamicStyle = document.createElement("style");

dynamicStyle.textContent = `
  .tp-extra {
    margin: 16px 0;
    padding: 16px;
    border: 1px solid #244866;
    border-radius: 18px;
    background: rgba(10, 30, 49, .82);
  }

  .tp-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .tp-mini {
    padding: 12px;
    border: 1px solid #244866;
    border-radius: 14px;
    background: rgba(255,255,255,.025);
  }

  .tp-mini span {
    display: block;
    color: #8fa6bf;
    font-size: 11px;
  }

  .tp-mini strong {
    display: block;
    font-size: 22px;
    margin-top: 4px;
  }

  .tp-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .tp-toolbar select,
  .tp-toolbar button {
    border: 1px solid #294863;
    background: #091a2c;
    color: #eef7ff;
    border-radius: 10px;
    padding: 9px 11px;
  }

  .tp-toolbar button {
    cursor: pointer;
  }

  .tp-toolbar button:hover {
    background: #15324b;
  }

  .tp-alert {
    margin-bottom: 16px;
    padding: 15px;
    border-radius: 16px;
    border: 1px solid rgba(255, 115, 130, .35);
    background: rgba(110, 30, 45, .22);
  }

  .tp-alert-title {
    font-size: 17px;
    font-weight: 800;
  }

  .tp-alert-text {
    margin-top: 5px;
    color: #b8c8d9;
    font-size: 13px;
  }

  .tp-danger {
    border-color: rgba(255, 115, 130, .35);
    background: rgba(110, 30, 45, .16);
  }

  .tp-event-reasons {
    margin-top: 10px;
    padding: 11px 12px;
    border-radius: 12px;
    background: rgba(255,255,255,.035);
    font-size: 12px;
  }

  .tp-event-reasons strong {
    display: block;
    margin-bottom: 5px;
    color: #dcecff;
  }

  .tp-event-reasons ul {
    margin: 0;
    padding-left: 18px;
    color: #9fb3c8;
  }

  .tp-event-reasons li {
    margin: 3px 0;
  }

  .tp-scorebar {
    height: 7px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,.08);
    margin-top: 9px;
  }

  .tp-scorefill {
    height: 100%;
    border-radius: 999px;
  }

  .tp-watch {
    border: 0;
    background: transparent;
    color: #7f96ae;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
  }

  .tp-watch.saved {
    color: #5de0ff;
  }

  .tp-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .tp-action {
    border: 1px solid #294863;
    background: #0a1d31;
    color: #e9f5ff;
    border-radius: 9px;
    padding: 7px 9px;
    cursor: pointer;
    font-size: 12px;
  }

  .tp-action:hover {
    background: #15324b;
  }

  .tp-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 5000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(2, 10, 18, .72);
    backdrop-filter: blur(6px);
  }

  .tp-modal-backdrop.open {
    display: flex;
  }

  .tp-modal {
    width: min(680px, 100%);
    max-height: 88vh;
    overflow: auto;
    background: #0b1d31;
    border: 1px solid #294863;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 25px 90px rgba(0,0,0,.45);
  }

  .tp-modal-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .tp-modal h3 {
    margin: 0;
    font-size: 24px;
  }

  .tp-modal-close {
    border: 1px solid #294863;
    background: #0a1a2b;
    color: #fff;
    border-radius: 10px;
    padding: 7px 10px;
    cursor: pointer;
  }

  .tp-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .tp-detail {
    border: 1px solid #23425f;
    border-radius: 12px;
    padding: 12px;
    background: rgba(255,255,255,.025);
  }

  .tp-detail span {
    display: block;
    color: #8fa6bf;
    font-size: 11px;
  }

  .tp-detail strong {
    display: block;
    margin-top: 4px;
  }

  .tp-modal-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #203d5b;
  }

  .tp-muted {
    color: #8fa6bf;
    font-size: 13px;
  }

  .tp-link {
    color: #5de0ff;
    text-decoration: none;
  }

  .tp-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 800px) {
    .tp-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tp-detail-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .tp-summary-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
`;

document.head.appendChild(dynamicStyle);

/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* =========================================================
   STORAGE
   ========================================================= */

function saveWatchlist() {
  localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify([...watchlist])
  );
}

function cacheEvents(events) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        events
      })
    );
  } catch (error) {
    console.warn("Could not cache events:", error);
  }
}

function readCachedEvents() {
  try {
    const raw =
      localStorage.getItem(CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      !Array.isArray(parsed.events)
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

/* =========================================================
   TEXT HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getLatestGeometry(event) {
  if (
    !event.geometry ||
    !event.geometry.length
  ) {
    return null;
  }

  return event.geometry[
    event.geometry.length - 1
  ];
}

function getEventDate(event) {
  const geometry =
    getLatestGeometry(event);

  return (
    geometry?.date ||
    event.closed ||
    event.date ||
    null
  );
}

function daysSince(value) {
  if (!value) return Infinity;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return Infinity;
  }

  return (
    Date.now() - date.getTime()
  ) / 86400000;
}

/* =========================================================
   CATEGORY HELPERS
   ========================================================= */

function getPrimaryCategory(event) {
  return (
    event.categories?.[0]?.title ||
    "Earth event"
  );
}

function getCategoryIds(event) {
  return (
    event.categories || []
  ).map(category => category.id);
}

function getCategoryNames(event) {
  return (
    event.categories || []
  )
    .map(category => category.title || "")
    .join(" ");
}

/* =========================================================
   SMART SCORE
   ========================================================= */

function scoreEvent(event) {
  const title =
    (event.title || "").toLowerCase();

  const categories =
    getCategoryNames(event).toLowerCase();

  let score = 15;

  /*
    EVENT TYPE
    -------------------------------------------------------
    These are NOT official NASA risk levels.
    They are only TerraPulse's own prioritization heuristic.
  */

  const veryHighKeywords = [
    "earthquake",
    "tsunami",
    "volcano",
    "wildfire",
    "hurricane",
    "typhoon",
    "cyclone",
    "tropical storm"
  ];

  const mediumKeywords = [
    "flood",
    "storm",
    "landslide",
    "dust",
    "severe storm",
    "iceberg",
    "drought",
    "temperature"
  ];

  if (
    veryHighKeywords.some(
      word =>
        title.includes(word) ||
        categories.includes(word)
    )
  ) {
    score += 48;
  } else if (
    mediumKeywords.some(
      word =>
        title.includes(word) ||
        categories.includes(word)
    )
  ) {
    score += 28;
  } else {
    score += 8;
  }

  /*
    RECENCY
  */

  const age =
    daysSince(getEventDate(event));

  if (age <= 1) {
    score += 20;
  } else if (age <= 3) {
    score += 15;
  } else if (age <= 7) {
    score += 10;
  } else if (age <= 30) {
    score += 5;
  }

  /*
    LOCATION QUALITY
  */

  const geometry =
    getLatestGeometry(event);

  if (
    geometry &&
    Array.isArray(geometry.coordinates)
  ) {
    score += 7;
  }

  /*
    SOURCE AVAILABILITY
  */

  if (
    Array.isArray(event.sources) &&
    event.sources.length > 0
  ) {
    score += 5;
  }

  return Math.min(
    Math.round(score),
    100
  );
}

/* =========================================================
   SCORE EXPLANATION
   ========================================================= */

function explainScore(event) {
  const reasons = [];

  const title =
    (event.title || "").toLowerCase();

  const categories =
    getCategoryNames(event).toLowerCase();

  const age =
    daysSince(getEventDate(event));

  const veryHighKeywords = [
    "earthquake",
    "tsunami",
    "volcano",
    "wildfire",
    "hurricane",
    "typhoon",
    "cyclone",
    "tropical storm"
  ];

  const mediumKeywords = [
    "flood",
    "storm",
    "landslide",
    "dust",
    "severe storm",
    "iceberg",
    "drought",
    "temperature"
  ];

  if (
    veryHighKeywords.some(
      word =>
        title.includes(word) ||
        categories.includes(word)
    )
  ) {
    reasons.push(
      "Event type is one TerraPulse treats as a high-attention category."
    );
  } else if (
    mediumKeywords.some(
      word =>
        title.includes(word) ||
        categories.includes(word)
    )
  ) {
    reasons.push(
      "Event type is treated as a medium-attention category."
    );
  } else {
    reasons.push(
      "The event is an active natural-event record from NASA EONET."
    );
  }

  if (age <= 1) {
    reasons.push(
      "The latest event metadata is very recent."
    );
  } else if (age <= 7) {
    reasons.push(
      "The latest event metadata was updated recently."
    );
  } else if (Number.isFinite(age)) {
    reasons.push(
      "The event has older available metadata."
    );
  }

  const geometry =
    getLatestGeometry(event);

  if (
    geometry &&
    Array.isArray(geometry.coordinates)
  ) {
    reasons.push(
      "Geographic coordinates are available."
    );
  }

  if (
    Array.isArray(event.sources) &&
    event.sources.length
  ) {
    reasons.push(
      "A source reference is available."
    );
  }

  let recommendation =
    "Continue monitoring the available data.";

  const score =
    scoreEvent(event);

  if (score >= 80) {
    recommendation =
      "High attention signal — inspect the source and event details.";
  } else if (score >= 60) {
    recommendation =
      "Worth monitoring for changes.";
  }

  return {
    score,
    reasons,
    recommendation
  };
}

/* =========================================================
   SCORE LABELS
   ========================================================= */

function getScoreClass(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function getScoreLabel(score) {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function getScoreColor(score) {
  if (score >= 70) return "#ff657a";
  if (score >= 40) return "#ffc85c";
  return "#62e6bd";
}

/* =========================================================
   COORDINATES
   ========================================================= */

function getCoordinates(event) {
  const geometry =
    getLatestGeometry(event);

  if (
    !geometry ||
    !geometry.coordinates
  ) {
    return null;
  }

  if (geometry.type === "Point") {
    const coords =
      geometry.coordinates;

    if (
      coords.length >= 2 &&
      Number.isFinite(coords[0]) &&
      Number.isFinite(coords[1])
    ) {
      return [
        coords[1],
        coords[0]
      ];
    }

    return null;
  }

  /*
    Basic anchor for non-point geometry.
    This is for visualization only.
  */

  let pair = null;

  const stack = [
    geometry.coordinates
  ];

  while (
    !pair &&
    stack.length
  ) {
    const current =
      stack.pop();

    if (!Array.isArray(current)) {
      continue;
    }

    if (
      current.length >= 2 &&
      typeof current[0] === "number" &&
      typeof current[1] === "number"
    ) {
      pair = current;
      break;
    }

    current.forEach(item => {
      if (Array.isArray(item)) {
        stack.push(item);
      }
    });
  }

  if (!pair) return null;

  return [
    pair[1],
    pair[0]
  ];
}

/* =========================================================
   CATEGORIES
   ========================================================= */

function getCategories(events) {
  const categories =
    new Map();

  events.forEach(event => {
    (event.categories || [])
      .forEach(category => {

        if (
          category &&
          category.title
        ) {
          categories.set(
            category.id ||
            category.title,
            category.title
          );
        }

      });
  });

  return [
    ...categories.entries()
  ].sort(
    (a, b) =>
      a[1].localeCompare(b[1])
  );
}

function updateCategoryOptions() {
  const current =
    categorySelect.value;

  categorySelect.innerHTML =
    '<option value="all">All categories</option>';

  getCategories(allEvents)
    .forEach(([id, title]) => {

      const option =
        document.createElement("option");

      option.value = id;
      option.textContent = title;

      categorySelect
        .appendChild(option);
    });

  if (
    [...categorySelect.options]
      .some(
        option =>
          option.value === current
      )
  ) {
    categorySelect.value = current;
  }
}

/* =========================================================
   DYNAMIC SUMMARY PANEL
   ========================================================= */

function ensureExtraPanels() {

  if (
    document.getElementById(
      "tpSummaryPanel"
    )
  ) {
    return;
  }

  const controls =
    document.querySelector(
      ".controls"
    );

  if (!controls) return;

  const summary =
    document.createElement("section");

  summary.id =
    "tpSummaryPanel";

  summary.className =
    "tp-extra";

  summary.innerHTML = `
    <div class="tp-summary-grid">

      <div class="tp-mini">
        <span>Visible events</span>
        <strong id="tpVisible">0</strong>
      </div>

      <div class="tp-mini">
        <span>Recent events</span>
        <strong id="tpRecent">0</strong>
      </div>

      <div class="tp-mini">
        <span>Saved events</span>
        <strong id="tpSaved">0</strong>
      </div>

      <div class="tp-mini">
        <span>Sources available</span>
        <strong id="tpSources">0</strong>
      </div>

    </div>

    <div class="tp-toolbar">

      <label>
        <span class="tp-muted">Sort:</span>

        <select id="tpSort">
          <option value="priority">
            Highest priority
          </option>

          <option value="recent">
            Most recent
          </option>

          <option value="oldest">
            Oldest
          </option>

          <option value="name">
            Name A–Z
          </option>
        </select>
      </label>

      <button id="tpWatchOnly">
        ★ Saved only
      </button>

      <button id="tpExport">
        Export watchlist
      </button>

      <button id="tpFit">
        Fit map to results
      </button>

    </div>
  `;

  controls.insertAdjacentElement(
    "afterend",
    summary
  );

  $("tpSort").addEventListener(
    "change",
    applyFilters
  );

  $("tpWatchOnly").addEventListener(
    "click",
    toggleSavedOnly
  );

  $("tpExport").addEventListener(
    "click",
    exportWatchlist
  );

  $("tpFit").addEventListener(
    "click",
    fitMapToResults
  );
}

/* =========================================================
   ALERT BANNER
   ========================================================= */

function renderAlertBanner(events) {

  let existing =
    document.getElementById(
      "tpAlertBanner"
    );

  if (!existing) {

    existing =
      document.createElement("div");

    existing.id =
      "tpAlertBanner";

    existing.className =
      "tp-alert";

    const main =
      document.querySelector("main");

    if (main) {
      main.insertBefore(
        existing,
        main.children[1]
      );
    }
  }

  if (!events.length) {
    existing.innerHTML = `
      <div class="tp-alert-title">
        No matching events
      </div>

      <div class="tp-alert-text">
        Try changing your filters.
      </div>
    `;

    return;
  }

  const top =
    [...events]
      .sort(
        (a, b) =>
          scoreEvent(b) -
          scoreEvent(a)
      )[0];

  const score =
    scoreEvent(top);

  if (score < 60) {

    existing.style.borderColor =
      "rgba(98,230,189,.28)";

    existing.style.background =
      "rgba(30,90,75,.12)";

    existing.innerHTML = `
      <div class="tp-alert-title">
        🟢 No major TerraPulse priority signal
      </div>

      <div class="tp-alert-text">
        The highest current score is
        ${score}/100 for
        <strong>
          ${escapeHTML(
            top.title ||
            "Unnamed event"
          )}
        </strong>.
      </div>
    `;

  } else {

    existing.style.borderColor 
