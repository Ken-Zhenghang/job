const DEFAULT_CITIES = ["Los Angeles", "San Jose", "San Francisco"];
const JOBS_URL = "./data/jobs.json";
const FALLBACK_JOBS_URL = "./data/jobs.sample.json";
const STORAGE_KEY = "job-radar-seen-ids";

const elements = {
  keywordInput: document.querySelector("#keywordInput"),
  cityFilter: document.querySelector("#cityFilter"),
  workModeFilter: document.querySelector("#workModeFilter"),
  ageFilter: document.querySelector("#ageFilter"),
  refreshButton: document.querySelector("#refreshJobs"),
  enableNotificationsButton: document.querySelector("#enableNotifications"),
  jobsGrid: document.querySelector("#jobsGrid"),
  jobCount: document.querySelector("#jobCount"),
  newCount: document.querySelector("#newCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  statusText: document.querySelector("#statusText"),
  jobCardTemplate: document.querySelector("#jobCardTemplate"),
};

let jobs = [];

bootstrap().catch((error) => {
  console.error(error);
  elements.statusText.textContent = "加载失败，请检查 data/jobs.json 是否存在。";
});

async function bootstrap() {
  await loadJobs();
  wireEvents();
  render();
}

async function loadJobs() {
  elements.statusText.textContent = "正在同步岗位...";

  const data = await fetchJsonWithFallback(JOBS_URL, FALLBACK_JOBS_URL);
  jobs = (data.jobs || [])
    .filter((job) => DEFAULT_CITIES.includes(job.city))
    .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

  hydrateCityOptions(jobs);
  elements.lastUpdated.textContent = formatTimestamp(data.lastUpdated);
  elements.statusText.textContent = `已同步 ${jobs.length} 个岗位`;
  syncSeenJobs(jobs);
}

function wireEvents() {
  elements.keywordInput.addEventListener("input", render);
  elements.cityFilter.addEventListener("change", render);
  elements.workModeFilter.addEventListener("change", render);
  elements.ageFilter.addEventListener("change", render);
  elements.refreshButton.addEventListener("click", async () => {
    await loadJobs();
    render();
  });
  elements.enableNotificationsButton.addEventListener("click", enableNotifications);
}

function hydrateCityOptions(items) {
  const currentValue = elements.cityFilter.value;
  const cities = [...new Set(items.map((job) => job.city))];
  elements.cityFilter.innerHTML = '<option value="all">全部城市</option>';

  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    elements.cityFilter.append(option);
  });

  if (cities.includes(currentValue)) {
    elements.cityFilter.value = currentValue;
  }
}

function render() {
  const filteredJobs = jobs.filter(matchesFilters);
  const newJobs = filteredJobs.filter((job) => !getSeenIds().includes(job.id));

  elements.jobCount.textContent = String(filteredJobs.length);
  elements.newCount.textContent = String(newJobs.length);
  elements.jobsGrid.innerHTML = "";

  if (filteredJobs.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "当前筛选条件下没有匹配岗位。";
    elements.jobsGrid.append(emptyState);
    return;
  }

  filteredJobs.forEach((job) => {
    const fragment = elements.jobCardTemplate.content.cloneNode(true);
    fragment.querySelector(".job-company").textContent = job.company;
    fragment.querySelector(".job-title").textContent = job.title;
    fragment.querySelector(".job-age").textContent = timeAgo(job.postedAt);
    fragment.querySelector(".job-snippet").textContent = job.snippet;
    fragment.querySelector(".job-source").textContent = `来源：${job.source}`;

    const link = fragment.querySelector(".job-link");
    link.href = job.url;

    const meta = fragment.querySelector(".job-meta");
    [
      job.city,
      job.state,
      job.workMode,
      job.salary || "薪资未公开",
    ].forEach((value) => {
      const chip = document.createElement("span");
      chip.textContent = value;
      meta.append(chip);
    });

    elements.jobsGrid.append(fragment);
  });
}

function matchesFilters(job) {
  const keyword = elements.keywordInput.value.trim().toLowerCase();
  const city = elements.cityFilter.value;
  const workMode = elements.workModeFilter.value;
  const age = elements.ageFilter.value;

  const matchesKeyword = keyword === "" || [
    job.title,
    job.company,
    job.snippet,
  ].some((field) => field.toLowerCase().includes(keyword));
  const matchesCity = city === "all" || job.city === city;
  const matchesWorkMode = workMode === "all" || job.workMode === workMode;
  const matchesAge = age === "all" || daysSince(job.postedAt) <= Number(age);

  return matchesKeyword && matchesCity && matchesWorkMode && matchesAge;
}

async function fetchJsonWithFallback(primaryUrl, fallbackUrl) {
  try {
    const primaryResponse = await fetch(primaryUrl, { cache: "no-store" });
    if (primaryResponse.ok) {
      return await primaryResponse.json();
    }
  } catch (error) {
    console.warn("Primary job feed unavailable, using fallback.", error);
  }

  const fallbackResponse = await fetch(fallbackUrl, { cache: "no-store" });
  return fallbackResponse.json();
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function timeAgo(value) {
  const days = daysSince(value);
  if (days <= 0) {
    return "今天发布";
  }
  if (days === 1) {
    return "1 天前";
  }
  return `${days} 天前`;
}

function daysSince(value) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  const then = new Date(value);
  return Math.floor((now - then) / millisecondsPerDay);
}

function getSeenIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function syncSeenJobs(items) {
  const seenIds = getSeenIds();
  if (seenIds.length === 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((job) => job.id)));
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    elements.statusText.textContent = "当前浏览器不支持通知。";
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    elements.statusText.textContent = "通知权限未开启。";
    return;
  }

  const unseenJobs = jobs.filter((job) => !getSeenIds().includes(job.id));
  if (unseenJobs.length === 0) {
    elements.statusText.textContent = "目前没有新增岗位。";
    return;
  }

  const latestJob = unseenJobs[0];
  new Notification("美国数据分析岗位更新", {
    body: `${unseenJobs.length} 个新岗位，最新：${latestJob.title} @ ${latestJob.company}`,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.map((job) => job.id)));
  render();
}
