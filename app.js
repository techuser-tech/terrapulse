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

const categorySelect = document.getElementById("categorySelect");
const scoreSelect = document.getElementById("scoreSelect");
const searchInput = document.getElementById("searchInput");

const eventList = document.getElementById("eventList");
const feedMeta = document.getElementById("feedMeta");
const mapMeta = document.getElementById("mapMeta");

const refreshBtn = document.getElementById("refreshBtn");
const clearBtn = document.getElementById("clearBtn");

const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function scoreEvent(event) {
  const title = (event.title || "").toLowerCase();
  const categories = (event.categories || [])
    .map(c => c.title)
    .join(" ")
    .toLowerCase();

  let score = 25;

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

  if (highWords.some(word =>
    title.includes(word) || categories.includes(word)
  )) {
    score += 55;
  } else if (mediumWords.some(word =>
    title.includes(word) || categories.includes(word)
  )) {
    score += 30;
  }

  if (event.geometry && event.geometry.length > 0) {
    score += 10;
  }

  return Math.min(score, 100);
}

function getCoordinates(event) {
  if (!event.geometry || event.geometry.length === 0) {
    return null;
  }

  const geometry =
    event.geometry[event.geometry.length - 1];

  if (!geometry || !geometry.coordinates) {
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

function formatDate(dateString) {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getCategories(events) {
  const categories = new Map();

  events.forEach(event => {
    (event.categories || []).forEach(category => {
      if (category && category.title) {
        categories.set(
          category.id || category.title,
          category.title
        );
      }
    });
  });

  return [...categories.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
}

function updateCategoryOptions() {
  const current = categorySelect.value;

  categorySelect.innerHTML =
    '<option value="all">All categories</option>';

  getCategories(allEvents).forEach(([id, title]) => {
    const option = document.createElement("option");

    option.value = id;
    option.textContent = title;

    categorySelect.appendChild(option);
  });

  if (
    [...categorySelect.options]
      .some(option => option.value === current)
  ) {
    categorySelect.value = current;
  }
}

function renderMarkers(events) {
  markers.clearLayers();

  events.forEach(event => {
    const coordinates = getCoordinates(event);

    if (!coordinates) return;

    const score = scoreEvent(event);
    const category =
      event.categories?.[0]?.title || "Earth event";

    const marker = L.circleMarker(coordinates, {
      radius: score >= 70 ? 8 : 6,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.75
    });

    marker.bindPopup(`
      <div class="popup-title">
        ${escapeHTML(event.title || "Unnamed event")}
      </div>

      <div>
        ${escapeHTML(category)}
      </div>

      <div class="popup-score">
        Signal score: ${score}/100
      </div>

      <div>
        ${formatDate(event.geometry?.at(-1)?.date)}
      </div>

      ${
        event.sources?.[0]?.url
          ? `<a
              class="popup-link"
              href="${event.sources[0].url}"
              target="_blank"
              rel="noopener">
              View source ↗
            </a>`
          : ""
      }
    `);

    marker.addTo(markers);
  });
}

function renderFeed(events) {
  eventList.innerHTML = "";

  const visibleEvents = events.slice(0, 60);

  if (visibleEvents.length === 0) {
    eventList.innerHTML =
      '<div class="empty">No events match your filters.</div>';

    return;
  }

  visibleEvents.forEach(event => {
    const score = scoreEvent(event);
    const category =
      event.categories?.[0]?.title || "Earth event";

    const date =
      event.geometry?.at(-1)?.date;

    const source =
      event.sources?.[0]?.url;

    const item = document.createElement("article");

    item.className = "event";

    item.innerHTML = `
      <div class="event-top">

        <div>
          <h4>${escapeHTML(event.title || "Unnamed event")}</h4>

          <small>
            ${escapeHTML(category)} • ${formatDate(date)}
          </small>
        </div>

        <span class="badge ${getScoreClass(score)}">
          ${getScoreLabel(score)} ${score}
        </span>

      </div>

      <p>
        TerraPulse signal score is based on event type,
        available location data and event metadata.
      </p>

      <div class="event-actions">

        <small>
          ID: ${escapeHTML(event.id || "unknown")}
        </small>

        ${
          source
            ? `<a
                href="${source}"
                target="_blank"
                rel="noopener">
                Source ↗
              </a>`
            : ""
        }

      </div>
    `;

    eventList.appendChild(item);
  });
}

function updateDashboard(events) {
  filteredEvents = events;

  const categorySet = new Set();

  events.forEach(event => {
    (event.categories || []).forEach(category => {
      if (category.title) {
        categorySet.add(category.title);
      }
    });
  });

  const high = events.filter(
    event => scoreEvent(event) >= 70
  ).length;

  eventCount.textContent =
    allEvents.length.toLocaleString();

  categoryCount.textContent =
    categorySet.size;

  highCount.textContent =
    high.toLocaleString();

  feedMeta.textContent =
    `${events.length.toLocaleString()} matching events`;

  mapMeta.textContent =
    `${events.length.toLocaleString()} shown`;

  renderMarkers(events);
  renderFeed(events);
}

function applyFilters() {
  const search =
    searchInput.value.trim().toLowerCase();

  const selectedCategory =
    categorySelect.value;

  const selectedScore =
    scoreSelect.value;

  const result = allEvents.filter(event => {

    const title =
      (event.title || "").toLowerCase();

    const categoryNames =
      (event.categories || [])
        .map(category => category.title)
        .join(" ")
        .toLowerCase();

    const matchesSearch =
      !search ||
      title.includes(search) ||
      categoryNames.includes(search);

    const matchesCategory =
      selectedCategory === "all" ||
      (event.categories || [])
        .some(category =>
          category.id === selectedCategory
        );

    const score =
      scoreEvent(event);

    const matchesScore =
      selectedScore === "all" ||
      (selectedScore === "high" && score >= 70) ||
      (selectedScore === "medium" &&
        score >= 40 &&
        score < 70) ||
      (selectedScore === "low" && score < 40);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesScore
    );
  });

  updateDashboard(result);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadEvents() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Loading…";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(
        `NASA EONET returned ${response.status}`
      );
    }

    const data = await response.json();

    allEvents = Array.isArray(data.events)
      ? data.events
      : [];

    updateCategoryOptions();

    lastRefresh.textContent =
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

    applyFilters();

    showToast(
      `${allEvents.length} NASA events loaded`
    );

  } catch (error) {

    console.error(error);

    eventList.innerHTML = `
      <div class="empty">
        Could not load NASA EONET data.
        Please check your internet connection
        and try Refresh.
      </div>
    `;

    showToast("Data loading failed");

  } finally {

    refreshBtn.disabled = false;
    refreshBtn.textContent = "↻ Refresh";
  }
}

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

clearBtn.addEventListener("click", () => {

  searchInput.value = "";
  categorySelect.value = "all";
  scoreSelect.value = "all";

  applyFilters();
});

refreshBtn.addEventListener(
  "click",
  loadEvents
);

loadEvents();
