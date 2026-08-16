const API = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000";
const FALLBACK = {
  events: [
    {id:"demo-1",title:"Demo Wildfire Signal",categories:[{id:"wildfires",title:"Wildfires"}],geometry:[{date:"2026-08-01T00:00:00Z",type:"Point",coordinates:[-118.2,34.1]}],sources:[]},
    {id:"demo-2",title:"Demo Severe Storm Signal",categories:[{id:"severeStorms",title:"Severe Storms"}],geometry:[{date:"2026-08-02T00:00:00Z",type:"Point",coordinates:[77.2,28.6]}],sources:[]},
    {id:"demo-3",title:"Demo Volcano Signal",categories:[{id:"volcanoes",title:"Volcanoes"}],geometry:[{date:"2026-08-03T00:00:00Z",type:"Point",coordinates:[139.7,35.7]}],sources:[]}
  ]
};

let allEvents = [];
let shownEvents = [];
let map;
let markers = [];
const saved = new Set(JSON.parse(localStorage.getItem("terrapulse-saved") || "[]"));

const $ = id => document.getElementById(id);
const categoryNames = new Map();

function escapeHTML(value=""){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function getCategory(event){
  return event.categories?.[0]?.title || "Other";
}
function getPriority(event){
  const id = (event.categories?.[0]?.id || "").toLowerCase();
  if (/(wildfire|severe|volcano|flood|earthquake|landslide|dust)/.test(id)) return "high";
  if (/(temperature|storm|ice|drought|water)/.test(id)) return "medium";
  return "low";
}
function getPoint(event){
  const geo = event.geometry?.[event.geometry.length - 1];
  if (!geo) return null;
  if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
    return [geo.coordinates[1], geo.coordinates[0]];
  }
  if (geo.type === "Polygon" && Array.isArray(geo.coordinates?.[0])) {
    const ring = geo.coordinates[0];
    if (!ring.length) return null;
    let lon = 0, lat = 0;
    ring.forEach(p => { lon += p[0]; lat += p[1]; });
    return [lat / ring.length, lon / ring.length];
  }
  return null;
}
function formatDate(value){
  if(!value) return "Date unavailable";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], {dateStyle:"medium",timeStyle:"short"});
}
function saveState(){
  localStorage.setItem("terrapulse-saved", JSON.stringify([...saved]));
  $("savedCount").textContent = saved.size;
}
function toast(message){
  const t=$("toast"); t.textContent=message; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.remove("show"),2200);
}
function markerIcon(priority){
  const color = priority==="high" ? "#ff7d8a" : priority==="medium" ? "#ffc96b" : "#70d6a1";
  return L.divIcon({
    className:"",
    html:`<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,.85);box-shadow:0 0 0 5px rgba(255,255,255,.08)"></span>`,
    iconSize:[14,14],iconAnchor:[7,7]
  });
}

async function loadEvents(){
  $("connection").textContent="Updating…";
  try{
    const res=await fetch(API,{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    allEvents = data.events || [];
    $("connection").textContent="● NASA data live";
    $("connection").style.color="var(--low)";
    $("lastUpdated").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  }catch(err){
    allEvents = FALLBACK.events;
    $("connection").textContent="Offline demo data";
    $("connection").style.color="var(--medium)";
    toast("NASA data could not be reached; showing demo events.");
  }
  categoryNames.clear();
  allEvents.forEach(e => {
    e.categories?.forEach(c => categoryNames.set(c.id,c.title));
  });
  populateCategories();
  update();
}

function populateCategories(){
  const select=$("category");
  const current=select.value;
  select.innerHTML='<option value="all">All categories</option>';
  [...categoryNames.entries()].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([id,title])=>{
    const option=document.createElement("option");
    option.value=id; option.textContent=title; select.appendChild(option);
  });
  if([...select.options].some(o=>o.value===current)) select.value=current;
}

function update(){
  const q=$("search").value.trim().toLowerCase();
  const cat=$("category").value;
  const pri=$("priority").value;
  const savedOnly=$("savedOnly").checked;

  shownEvents=allEvents.filter(e=>{
    const text=(e.title+" "+getCategory(e)).toLowerCase();
    const categoryOk=cat==="all" || e.categories?.some(c=>c.id===cat);
    const priorityOk=pri==="all" || getPriority(e)===pri;
    const savedOk=!savedOnly || saved.has(e.id);
    return text.includes(q) && categoryOk && priorityOk && savedOk;
  }).sort((a,b)=>{
    const rank={high:0,medium:1,low:2};
    return rank[getPriority(a)]-rank[getPriority(b)] || getCategory(a).localeCompare(getCategory(b));
  });

  renderStats();
  renderFeed();
  renderMap();
}
function renderStats(){
  $("totalEvents").textContent=allEvents.length.toLocaleString();
  $("categoryCount").textContent=categoryNames.size;
  $("highPriority").textContent=allEvents.filter(e=>getPriority(e)==="high").length.toLocaleString();
  $("savedCount").textContent=saved.size;
  $("mapCount").textContent=`${shownEvents.length} shown`;
  $("feedSummary").textContent=`${shownEvents.length} matching event${shownEvents.length===1?"":"s"}`;
}
function renderFeed(){
  const feed=$("feed");
  if(!shownEvents.length){feed.innerHTML='<div class="empty">No events match these filters.</div>';return;}
  feed.innerHTML=shownEvents.slice(0,120).map(e=>{
    const p=getPriority(e), cat=getCategory(e), isSaved=saved.has(e.id);
    return `<article class="event-card" data-id="${escapeHTML(e.id)}">
      <div class="event-top">
        <div>
          <div class="event-title">${escapeHTML(e.title)}</div>
          <div class="event-meta">${escapeHTML(cat)} · ${formatDate(e.geometry?.at(-1)?.date)}</div>
        </div>
        <button class="save-btn ${isSaved?"saved":""}" data-save="${escapeHTML(e.id)}" aria-label="${isSaved?"Remove from":"Save to"} watchlist">${isSaved?"★":"☆"}</button>
      </div>
      <div class="badges"><span class="badge ${p}">${p.toUpperCase()} SIGNAL</span><span class="badge">${e.sources?.length || 0} source${(e.sources?.length||0)===1?"":"s"}</span></div>
    </article>`;
  }).join("");

  feed.querySelectorAll("[data-save]").forEach(btn=>btn.addEventListener("click",ev=>{
    ev.stopPropagation();
    const id=btn.dataset.save;
    if(saved.has(id)) saved.delete(id); else saved.add(id);
    saveState(); update();
  }));
  feed.querySelectorAll(".event-card").forEach(card=>card.addEventListener("click",()=>{
    const event=allEvents.find(e=>e.id===card.dataset.id);
    const point=getPoint(event);
    if(point && map){map.setView(point,Math.max(map.getZoom(),4));}
    showPopup(event);
  }));
}
function showPopup(event){
  const point=getPoint(event);
  if(!point || !map) return;
  const p=getPriority(event);
  const source=event.sources?.[0]?.url;
  const html=`<strong>${escapeHTML(event.title)}</strong>
    <br><span style="opacity:.7">${escapeHTML(getCategory(event))} · ${p} signal</span>
    <br><span style="opacity:.7">${formatDate(event.geometry?.at(-1)?.date)}</span>
    ${source?`<br><br><a href="${escapeHTML(source)}" target="_blank" rel="noreferrer">Open source ↗</a>`:""}`;
  L.popup().setLatLng(point).setContent(html).openOn(map);
}
function renderMap(){
  markers.forEach(m=>m.remove()); markers=[];
  shownEvents.forEach(e=>{
    const point=getPoint(e); if(!point) return;
    const marker=L.marker(point,{icon:markerIcon(getPriority(e))}).addTo(map);
    marker.on("click",()=>showPopup(e));
    markers.push(marker);
  });
}

function initMap(){
  map=L.map("map",{worldCopyJump:true}).setView([20,0],2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
}

["search","category","priority","savedOnly"].forEach(id=>{
  $(id).addEventListener(id==="search"?"input":"change",update);
});
$("resetBtn").addEventListener("click",()=>{
  $("search").value="";$("category").value="all";$("priority").value="all";$("savedOnly").checked=false;update();
});
$("refreshBtn").addEventListener("click",loadEvents);

initMap();
saveState();
loadEvents();
