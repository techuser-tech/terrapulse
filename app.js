const API_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000";

let allEvents = [];
let filteredEvents = [];

const map = L.map("map", {
  worldCopyJump: true
}).setView([20, 0], 2);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

const markers = L.layerGroup().addTo(map);

const eventCount = document.getElementById("eventCount");
const categoryCount = document.getElementById("categoryCount");
const highCount = document.getElementById("highCount");
const lastRefresh = document.getElementById("lastRefresh");

const categorySelect =
  document.getElementById("categorySelect");

const scoreSelect =
  document.getElementById("scoreSelect");

const searchInput =
  document.getElementById("searchInput");

const eventList =
  document.getElementById("eventList");

const feedMeta =
  document.getElementById("feedMeta");

const mapMeta =
  document.getElementById("mapMeta");

const refreshBtn =
  document.getElementById("refreshBtn");

const clearBtn =
  document.getElementById("clearBtn");

const toast =
  document.getElementById("toast");


/* ================================
   TOAST
================================ */

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


/* ================================
   EVENT SCORING
================================ */

function scoreEvent(event) {
  const title =
    (event.title || "").toLowerCase();

  const categories =
    (event.categories || [])
      .map(c => c.title || "")
      .join(" ")
      .toLowerCase();

  let score = 20;

  const highWords = [
    "volcano",
    "earthquake",
    "tsunami",
    "wildfire",
    "hurricane",
    "cyclone",
    "typhoon",
    "tropical storm"
  ];

  const mediumWords = [
    "flood",
    "dust",
    "storm",
    "landslide",
    "severe storm",
    "iceberg"
  ];

  if (
    highWords.some(word =>
      title.includes(word) ||
      categories.includes(word)
    )
  ) {
    score += 55;
  } else if (
    mediumWords.some(word =>
      title.includes(word) ||
      categories.includes(word)
    )
  ) {
    score += 30;
  }

  if (
    event.geometry &&
    event.geometry.length > 0
  ) {
    score += 10;
  }

  if (
    event.sources &&
    event.sources.length > 0
  ) {
    score += 5;
  }

  return Math.min(score, 100);
}


/* ================================
   DANGER LEVEL
================================ */

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


/* ================================
   COORDINATES
================================ */

function getCoordinates(event) {
  if (
    !event.geometry ||
    event.geometry.length === 0
  ) {
    return null;
  }

  const geometry =
    event.geometry[event.geometry.length - 1];

  if (
    !geometry ||
    !geometry.coordinates
  ) {
    return null;
  }

  if (geometry.type === "Point") {
    return [
      geometry.coordinates[1],
      geometry.coordinates[0]
    ];
  }

  return null;
}


/* ================================
   DATE
================================ */

function formatDate(dateString) {
  if (!dateString) {
    return "Unknown date";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}


/* ================================
   HTML SECURITY
================================ */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ================================
   CATEGORIES
================================ */

function getCategories(events) {
  const categories = new Map();

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
  ].sort((a, b) =>
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
      .some(option =>
        option.value === current
      )
  ) {
    categorySelect.value = current;
  }
}


/* ================================
   DANGER ZONE
================================ */

function getDangerEvents(events) {

  return [...events]
    .map(event => ({
      event,
      score: scoreEvent(event)
    }))
    .filter(item =>
      item.score >= 70
    )
    .sort((a, b) =>
      b.score - a.score
    )
    .slice(0, 10);
}


function createDangerZone() {

  let danger =
    document.getElementById(
      "terraPulseDangerZone"
    );

  if (danger) return danger;

  danger =
    document.createElement("section");

  danger.id =
    "terraPulseDangerZone";

  danger.style.margin =
    "24px 0";

  danger.style.padding =
    "20px";

  danger.style.border =
    "1px solid rgba(255,90,90,.35)";

  danger.style.borderRadius =
    "20px";

  danger.style.background =
    "rgba(100,20,30,.18)";

  danger.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      margin-bottom:16px;
    ">
      <div>
        <h2 style="
          margin:0;
          font-size:24px;
        ">
          ⚠️ Danger Zone
        </h2>

        <p style="
          margin:6px 0 0;
          opacity:.7;
        ">
          Highest-priority NASA EONET signals
        </p>
      </div>

      <strong
        id="dangerZoneCount"
        style="
          font-size:22px;
        "
      >
        0
      </strong>
    </div>

    <div id="dangerZoneList"></div>

    <p style="
      margin:16px 0 0;
      font-size:12px;
      opacity:.55;
    ">
      TerraPulse priority score is an experimental
      classification based on event metadata.
      It is not an official NASA warning level.
    </p>
  `;

  const container =
    eventList.parentElement;

  if (container) {
    container.parentElement
      .insertBefore(
        danger,
        container
      );
  }

  return danger;
}


function renderDangerZone(events) {

  const danger =
    createDangerZone();

  const list =
    document.getElementById(
      "dangerZoneList"
    );

  const count =
    document.getElementById(
      "dangerZoneCount"
    );

  if (!list || !count) return;

  const dangerous =
    getDangerEvents(events);

  count.textContent =
    dangerous.length;

  list.innerHTML = "";

  if (dangerous.length === 0) {

    list.innerHTML = `
      <div style="
        padding:16px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
      ">
        ✓ No high-priority signals
        detected in the current selection.
      </div>
    `;

    return;
  }

  dangerous.forEach(item => {

    const event =
      item.event;

    const score =
      item.score;

    const category =
      event.categories?.[0]?.title ||
      "Earth event";

    const date =
      event.geometry?.at(-1)?.date;

    const coordinates =
      getCoordinates(event);

    const card =
      document.createElement("div");

    card.style.padding =
      "14px";

    card.style.marginBottom =
      "10px";

    card.style.borderRadius =
      "14px";

    card.style.background =
      "rgba(255,255,255,.05)";

    card.style.cursor =
      coordinates
        ? "pointer"
        : "default";

    card.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      ">

        <div>
          <strong>
            ${escapeHTML(
              event.title ||
              "Unnamed event"
            )}
          </strong>

          <div style="
            margin-top:5px;
            opacity:.7;
            font-size:13px;
          ">
            ${escapeHTML(category)}
            •
            ${formatDate(date)}
          </div>
        </div>

        <span style="
          white-space:nowrap;
          font-weight:700;
        ">
          ${score}/100
        </span>

      </div>
    `;

    if (coordinates) {

      card.addEventListener(
        "click",
        () => {

          map.setView(
            coordinates,
            6,
            {
              animate: true
            }
          );

          showToast(
            "Showing event on map"
          );
        }
      );

    }

    list.appendChild(card);
  });
}


/* ================================
   MAP MARKERS
================================ */

function renderMarkers(events) {

  markers.clearLayers();

  events.forEach(event => {

    const coordinates =
      getCoordinates(event);

    if (!coordinates) return;

    const score =
      scoreEvent(event);

    const category =
      event.categories?.[0]?.title ||
      "Earth event";

    const marker =
      L.circleMarker(
        coordinates,
        {
          radius:
            score >= 70
              ? 9
              : score >= 40
                ? 7
                : 5,

          weight: 2,

          opacity: .9,

          fillOpacity: .75
        }
      );

    marker.bindPopup(`
      <div class="popup-title">
        ${escapeHTML(
          event.title ||
          "Unnamed event"
        )}
      </div>

      <div>
        ${escapeHTML(category)}
      </div>

      <div class="popup-score">
        Priority score:
        <strong>
          ${score}/100
        </strong>
      </div>

      <div>
        ${formatDate(
          event.geometry?.at(-1)?.date
        )}
      </div>

      ${
        event.sources?.[0]?.url
          ? `
            <a
              class="popup-link"
              href="${escapeHTML(
                event.sources[0].url
              )}"
              target="_blank"
              rel="noopener noreferrer">
              View NASA source ↗
            </a>
          `
          : ""
      }
    `);

    marker.addTo(markers);

  });
}


/* ================================
   EVENT FEED
================================ */

function renderFeed(events) {

  eventList.innerHTML = "";

  const visibleEvents =
    events.slice(0, 60);

  if (
    visibleEvents.length === 0
  ) {

    eventList.innerHTML =
      `
      <div class="empty">
        No events match your filters.
      </div>
      `;

    return;
  }

  visibleEvents.forEach(event => {

    const score =
      scoreEvent(event);

    const category =
      event.categories?.[0]?.title ||
      "Earth event";

    const date =
      event.geometry?.at(-1)?.date;

    const source =
      event.sources?.[0]?.url;

    const item =
      document.createElement("article");

    item.className =
      "event";

    item.innerHTML = `

      <div class="event-top">

        <div>

          <h4>
            ${escapeHTML(
              event.title ||
              "Unnamed event"
            )}
          </h4>

          <small>
            ${escapeHTML(category)}
            •
            ${formatDate(date)}
          </small>

        </div>

        <span
          class="badge ${getScoreClass(score)}"
        >
          ${getScoreLabel(score)}
          ${score}
        </span>

      </div>

      <p>
        TerraPulse priority score:
        ${score}/100.
        Score is based on event type,
        location availability and metadata.
      </p>

      <div class="event-actions">

        <small>
          ID:
          ${escapeHTML(
            event.id ||
            "unknown"
          )}
        </small>

        ${
          source
            ? `
              <a
                href="${escapeHTML(source)}"
                target="_blank"
                rel="noopener noreferrer">
                Source ↗
              </a>
            `
            : ""
        }

      </div>
    `;

    eventList.appendChild(item);

  });
}


/* ================================
   DASHBOARD
================================ */

function updateDashboard(events) {

  filteredEvents =
    events;

  const categorySet =
    new Set();

  events.forEach(event => {

    (event.categories || [])
      .forEach(category => {

        if (category.title) {
          categorySet.add(
            category.title
          );
        }

      });

  });

  const high =
    events.filter(
      event =>
        scoreEvent(event) >= 70
    ).length;

  eventCount.textContent =
    allEvents.length
      .toLocaleString();

  categoryCount.textContent =
    categorySet.size;

  highCount.textContent =
    high.toLocaleString();

  feedMeta.textContent =
    `${events.length.toLocaleString()}
     matching events`;

  mapMeta.textContent =
    `${events.length.toLocaleString()}
     shown`;

  renderMarkers(events);

  renderFeed(events);

  renderDangerZone(events);
}


/* ================================
   FILTERS
================================ */

function applyFilters() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedCategory =
    categorySelect.value;

  const selectedScore =
    scoreSelect.value;

  const result =
    allEvents.filter(event => {

      const title =
        (event.title || "")
          .toLowerCase();

      const categoryNames =
        (event.categories || [])
          .map(
            category =>
              category.title || ""
          )
          .join(" ")
          .toLowerCase();

      const matchesSearch =
        !search ||
        title.includes(search) ||
        categoryNames.includes(search);

      const matchesCategory =
        selectedCategory === "all" ||
        (event.categories || [])
          .some(
            category =>
              category.id ===
              selectedCategory
          );

      const score =
        scoreEvent(event);

      const matchesScore =
        selectedScore === "all" ||

        (
          selectedScore === "high" &&
          score >= 70
        ) ||

        (
          selectedScore === "medium" &&
          score >= 40 &&
          score < 70
        ) ||

        (
          selectedScore === "low" &&
          score < 40
        );

      return (
        matchesSearch &&
        matchesCategory &&
        matchesScore
      );

    });

  updateDashboard(result);
}


/* ================================
   LOAD NASA DATA
================================ */

async function loadEvents() {

  refreshBtn.disabled =
    true;

  refreshBtn.textContent =
    "Loading…";

  try {

    const response =
      await fetch(API_URL);

    if (!response.ok) {

      throw new Error(
        `NASA EONET returned ${response.status}`
      );

    }

    const data =
      await response.json();

    allEvents =
      Array.isArray(data.events)
        ? data.events
        : [];

    updateCategoryOptions();

    lastRefresh.textContent =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    applyFilters();

    showToast(
      `${allEvents.length}
       NASA events loaded`
    );

  } catch (error) {

    console.error(error);

    eventList.innerHTML = `
      <div class="empty">

        Could not load NASA EONET data.

        <br><br>

        Please check your internet
        connection and try Refresh.

      </div>
    `;

    showToast(
      "Data loading failed"
    );

  } finally {

    refreshBtn.disabled =
      false;

    refreshBtn.textContent =
      "↻ Refresh";
  }
}


/* ================================
   EVENT LISTENERS
================================ */

searchInput.addEventListener(
  "input",
  applyFilters
);

categorySelect.addEventListener(
  "change",
  applyFilters
);

scoreSelect.addEventListener(
  "change",
  applyFilters
);


clearBtn.addEventListener(
  "click",
  () => {

    searchInput.value =
      "";

    categorySelect.value =
      "all";

    scoreSelect.value =
      "all";

    applyFilters();

  }
);


refreshBtn.addEventListener(
  "click",
  loadEvents
);


/* ================================
   START TERRAPULSE
================================ */

createDangerZone();

loadEvents();
