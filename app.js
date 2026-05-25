/* ------------------------------------------------------------------ */
/*  DAILY PUSH — APP                                                   */
/* ------------------------------------------------------------------ */

const JOBS_URL = "data/jobs.json";
const FAV_KEY = "daily-push-favs";
const STATUS_KEY = "daily-push-status";
const APP_KEY = "daily-push-notes";

let allJobs = [];
let activeTab = "all";

/* ---- init ---- */
(async function init() {
  try {
    const resp = await fetch(JOBS_URL);
    const data = await resp.json();
    allJobs = data.jobs || [];
    document.getElementById("last-updated").textContent = fmtDate(data.lastUpdated);
    document.getElementById("sources-count").textContent = data.sourcesScanned || 0;
    document.getElementById("fetch-duration").textContent = data.fetchDuration || "0s";
    document.getElementById("job-count").textContent = allJobs.length;
    populateFilters();
    setupTabs();
    setupFilters();
    render();
  } catch (err) {
    document.getElementById("jobs-container").innerHTML = `<div class="loading">Failed to load jobs.json. ${err.message}</div>`;
  }
})();

/* ---- persistence ---- */
function getFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch { return new Set(); }
}
function saveFavorites(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}
function getStatuses() {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; } catch { return {}; }
}
function saveStatus(jobId, status) {
  const s = getStatuses();
  if (status) s[jobId] = status; else delete s[jobId];
  localStorage.setItem(STATUS_KEY, JSON.stringify(s));
}
function getAppNotes() {
  try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; } catch { return {}; }
}
function saveAppNote(jobId, note) {
  const n = getAppNotes();
  if (note) n[jobId] = note; else delete n[jobId];
  localStorage.setItem(APP_KEY, JSON.stringify(n));
}

/* ---- tabs ---- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;
      render();
    });
  });
}

/* ---- filters populate ---- */
function populateFilters() {
  const companies = [...new Set(allJobs.map((j) => j.company))].sort();
  const cities = [...new Set(allJobs.map((j) => j.city))].sort();
  const companySelect = document.getElementById("company");
  const citySelect = document.getElementById("city");
  companies.forEach((c) => { const o = document.createElement("option"); o.value = c; o.textContent = c; companySelect.appendChild(o); });
  cities.forEach((c) => { const o = document.createElement("option"); o.value = c; o.textContent = c; citySelect.appendChild(o); });
}

function setupFilters() {
  const els = ["keyword", "company", "city", "work-mode", "salary", "status-filter", "sort"];
  els.forEach((id) => document.getElementById(id).addEventListener("input", render));
  els.forEach((id) => document.getElementById(id).addEventListener("change", render));
  document.getElementById("clear-filters").addEventListener("click", () => {
    els.forEach((id) => { const e = document.getElementById(id); e.value = ""; });
    render();
  });
}

/* ---- filter & sort ---- */
function getFilteredJobs() {
  const statuses = getStatuses();
  let jobs = [...allJobs];

  // tab filter
  if (activeTab === "applied") {
    jobs = jobs.filter((j) => statuses[j.id] && statuses[j.id] !== "");
  }

  // keyword
  const kw = document.getElementById("keyword").value.toLowerCase().trim();
  if (kw) {
    jobs = jobs.filter((j) =>
      j.title.toLowerCase().includes(kw) ||
      j.company.toLowerCase().includes(kw) ||
      (j.skills || []).some((s) => s.toLowerCase().includes(kw)) ||
      (j.snippet || "").toLowerCase().includes(kw)
    );
  }

  // company
  const company = document.getElementById("company").value;
  if (company) jobs = jobs.filter((j) => j.company === company);

  // city
  const city = document.getElementById("city").value;
  if (city) jobs = jobs.filter((j) => j.city === city);

  // work mode
  const mode = document.getElementById("work-mode").value;
  if (mode) jobs = jobs.filter((j) => j.workMode === mode);

  // salary floor
  const salaryFloor = parseInt(document.getElementById("salary").value, 10) || 0;
  if (salaryFloor > 0) jobs = jobs.filter((j) => (j.salaryRaw || 0) >= salaryFloor);

  // status filter (only in all tab)
  const statusFilter = document.getElementById("status-filter").value;
  if (statusFilter) {
    jobs = jobs.filter((j) => statuses[j.id] === statusFilter);
  }

  // sort
  const sort = document.getElementById("sort").value;
  if (sort === "salary-desc") {
    jobs.sort((a, b) => (b.salaryRaw || 0) - (a.salaryRaw || 0));
  } else if (sort === "company-asc") {
    jobs.sort((a, b) => a.company.localeCompare(b.company));
  } else {
    jobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }

  return jobs;
}

/* ---- render ---- */
function render() {
  const jobs = getFilteredJobs();
  const favorites = getFavorites();
  const statuses = getStatuses();
  const notes = getAppNotes();

  // update badges
  document.getElementById("applied-count").textContent = Object.values(statuses).filter(Boolean).length;
  document.getElementById("favorite-count").textContent = favorites.size;

  const container = document.getElementById("jobs-container");
  const noResults = document.getElementById("no-results");

  if (jobs.length === 0) {
    container.innerHTML = "";
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  const today = new Date();
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString();

  const rows = jobs.map((j) => {
    const isNew = j.postedAt > threeDaysAgo;
    const isFav = favorites.has(j.id);
    const status = statuses[j.id] || "";
    const note = notes[j.id] || "";
    const salaryText = j.salary || (j.salaryRaw ? `$${(j.salaryRaw / 1000).toFixed(0)}K+` : "");
    const statusClass = status ? `status-${status}` : "";

    return `<tr class="${isNew ? "new-job" : ""}" data-id="${j.id}">
      <td class="col-company">${esc(j.company)}</td>
      <td class="col-title">${esc(j.title)}</td>
      <td class="col-city">${esc(j.city)}</td>
      <td class="col-mode"><span class="tag">${esc(j.workMode)}</span></td>
      <td class="col-salary">${esc(salaryText)}</td>
      <td class="col-posted">${timeAgo(j.postedAt)}</td>
      <td class="col-status">
        <select class="status-select ${statusClass}" data-job-id="${j.id}">
          <option value="">—</option>
          <option value="applied" ${status === "applied" ? "selected" : ""}>Applied</option>
          <option value="phone" ${status === "phone" ? "selected" : ""}>Phone</option>
          <option value="interview" ${status === "interview" ? "selected" : ""}>Interview</option>
          <option value="offer" ${status === "offer" ? "selected" : ""}>Offer</option>
          <option value="rejected" ${status === "rejected" ? "selected" : ""}>Rejected</option>
          <option value="accepted" ${status === "accepted" ? "selected" : ""}>Accepted</option>
        </select>
      </td>
      <td class="col-actions">
        <a class="apply-btn" href="${esc(j.url)}" target="_blank" rel="noopener">Apply</a>
        <span class="star-btn ${isFav ? "fav" : ""}" data-id="${j.id}">★</span>
      </td>
    </tr>`;
  }).join("");

  container.innerHTML = `<table id="jobs-table">
    <thead><tr>
      <th class="col-company">Company</th>
      <th class="col-title">Title</th>
      <th class="col-city">Location</th>
      <th class="col-mode">Mode</th>
      <th class="col-salary">Salary</th>
      <th class="col-posted">Posted</th>
      <th class="col-status">Status</th>
      <th class="col-actions">Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  // bind events
  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const f = getFavorites();
      f.has(id) ? f.delete(id) : f.add(id);
      saveFavorites(f);
      render();
    });
  });

  document.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const jobId = sel.dataset.jobId;
      saveStatus(jobId, sel.value);
      // lightweight re-render the select class
      sel.className = `status-select ${sel.value ? `status-${sel.value}` : ""}`;
    });
  });
}

/* ---- helpers ---- */
function esc(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}