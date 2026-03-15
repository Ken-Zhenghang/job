import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TARGET_CITIES = [
  "los angeles",
  "san jose",
  "san francisco",
];

const TITLE_PATTERNS = [
  /data analyst/i,
  /senior data analyst/i,
  /staff data analyst/i,
  /lead data analyst/i,
  /product analyst/i,
  /business analyst/i,
  /marketing analyst/i,
  /marketing inference/i,
  /people analytics analyst/i,
  /analytics engineer/i,
];

const EXCLUDED_TITLE_PATTERNS = [
  /software engineer/i,
  /data engineer/i,
  /machine learning/i,
  /research/i,
  /sourcing/i,
  /manager/i,
  /scientist/i,
];

const GREENHOUSE_SOURCES = [
  { boardToken: "springhealth66", company: "Spring Health" },
  { boardToken: "doximity", company: "Doximity" },
  { boardToken: "fastly", company: "Fastly" },
  { boardToken: "betterhelpcom", company: "BetterHelp" },
  { boardToken: "calendly", company: "Calendly" },
  { boardToken: "redcircle", company: "RedCircle" },
  { boardToken: "crunchyroll", company: "Crunchyroll" },
];

const LEVER_SOURCES = [];

const ASHBY_SOURCES = [
  { board: "openai", company: "OpenAI" },
  { board: "linear", company: "Linear" },
  { board: "harvey", company: "Harvey" },
];

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const outputFile = path.join(dataDir, "jobs.json");

await mkdir(dataDir, { recursive: true });

const collected = await Promise.all([
  ...GREENHOUSE_SOURCES.map((source) => collectGreenhouse(source)),
  ...LEVER_SOURCES.map((source) => collectLever(source)),
  ...ASHBY_SOURCES.map((source) => collectAshby(source)),
]);

const jobs = dedupeJobs(collected.flat())
  .filter(isRelevantJob)
  .sort((left, right) => new Date(right.postedAt) - new Date(left.postedAt));

const payload = {
  lastUpdated: new Date().toISOString(),
  jobs,
};

await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${jobs.length} jobs to ${outputFile}`);

async function collectGreenhouse(source) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${source.boardToken}/jobs?content=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Greenhouse fetch failed for ${source.boardToken}: ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    return jobs.map((job) => normalizeGreenhouseJob(job, source));
  } catch (error) {
    console.warn(`Greenhouse fetch errored for ${source.boardToken}:`, error.message);
    return [];
  }
}

async function collectLever(source) {
  const url = `https://api.lever.co/v0/postings/${source.site}?mode=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Lever fetch failed for ${source.site}: ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const jobs = Array.isArray(payload) ? payload : [];

    return jobs.map((job) => normalizeLeverJob(job, source));
  } catch (error) {
    console.warn(`Lever fetch errored for ${source.site}:`, error.message);
    return [];
  }
}

async function collectAshby(source) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${source.board}?includeCompensation=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Ashby fetch failed for ${source.board}: ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    return jobs.map((job) => normalizeAshbyJob(job, source));
  } catch (error) {
    console.warn(`Ashby fetch errored for ${source.board}:`, error.message);
    return [];
  }
}

function normalizeGreenhouseJob(job, source) {
  const location = job.location?.name ?? "";

  return {
    id: `gh-${source.boardToken}-${job.id}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(location, job.content),
    state: "CA",
    workMode: inferWorkMode(location, job.content),
    salary: extractCompensation(job.metadata) ?? "薪资未公开",
    postedAt: job.updated_at ?? new Date().toISOString(),
    source: `Greenhouse:${source.boardToken}`,
    url: job.absolute_url ?? `https://job-boards.greenhouse.io/${source.boardToken}/jobs/${job.id}`,
    snippet: excerpt(stripHtml(job.content ?? "")),
  };
}

function normalizeLeverJob(job, source) {
  const location = job.categories?.location ?? "";
  const description = stripHtml(job.descriptionPlain ?? job.description ?? "");

  return {
    id: `lever-${source.site}-${job.id}`,
    title: job.text ?? "",
    company: source.company,
    city: pickCity(location, description),
    state: "CA",
    workMode: inferWorkMode(location, description),
    salary: extractLeverSalary(job) ?? "薪资未公开",
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
    source: `Lever:${source.site}`,
    url: job.hostedUrl ?? `https://jobs.lever.co/${source.site}/${job.id}`,
    snippet: excerpt(description),
  };
}

function normalizeAshbyJob(job, source) {
  const location = [
    job.location,
    ...(Array.isArray(job.secondaryLocations)
      ? job.secondaryLocations.map((item) => item.location)
      : []),
  ].filter(Boolean).join(" / ");

  return {
    id: `ashby-${source.board}-${job.id ?? job.jobUrl ?? crypto.randomUUID()}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(location, job.descriptionHtml ?? ""),
    state: "CA",
    workMode: inferWorkMode(location, job.descriptionHtml ?? "", job.isRemote),
    salary: extractAshbyCompensation(job) ?? "薪资未公开",
    postedAt: job.publishedDate ?? job.updatedAt ?? new Date().toISOString(),
    source: `Ashby:${source.board}`,
    url: job.jobUrl ?? `https://jobs.ashbyhq.com/${source.board}`,
    snippet: excerpt(stripHtml(job.descriptionHtml ?? "")),
  };
}

function isRelevantJob(job) {
  if (!job.title || !job.company || !job.url) {
    return false;
  }

  const title = job.title.toLowerCase();
  const haystack = `${job.title} ${job.snippet}`.toLowerCase();
  const matchesTitle = TITLE_PATTERNS.some((pattern) => pattern.test(title));
  const excludedTitle = EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
  const location = `${job.city} ${job.snippet}`.toLowerCase();
  const matchesLocation = TARGET_CITIES.some((city) => location.includes(city));

  return matchesTitle && !excludedTitle && matchesLocation && haystack.includes("anal");
}

function pickCity(locationText, fallbackText = "") {
  const text = `${locationText} ${fallbackText}`.toLowerCase();
  if (text.includes("san francisco")) {
    return "San Francisco";
  }
  if (text.includes("san jose")) {
    return "San Jose";
  }
  if (text.includes("los angeles")) {
    return "Los Angeles";
  }
  if (text.includes("remote")) {
    return "Remote";
  }
  return locationText || "Unknown";
}

function inferWorkMode(locationText, contentText = "", isRemote = false) {
  const text = `${locationText} ${contentText}`.toLowerCase();
  if (isRemote || text.includes("remote")) {
    return "Remote";
  }
  if (text.includes("hybrid")) {
    return "Hybrid";
  }
  return "On-site";
}

function extractCompensation(metadata) {
  if (!Array.isArray(metadata)) {
    return null;
  }

  const compensationField = metadata.find((item) =>
    typeof item?.name === "string" && /compensation|salary|pay/i.test(item.name));

  return compensationField?.value ? String(compensationField.value) : null;
}

function extractLeverSalary(job) {
  if (job.salaryRange?.min && job.salaryRange?.max) {
    return `$${job.salaryRange.min} - $${job.salaryRange.max}`;
  }

  return null;
}

function extractAshbyCompensation(job) {
  const compensation = job.compensation;
  if (!compensation) {
    return null;
  }

  if (compensation.summary) {
    return compensation.summary;
  }

  if (compensation.minValue && compensation.maxValue && compensation.currencyCode) {
    return `${compensation.currencyCode} ${compensation.minValue} - ${compensation.maxValue}`;
  }

  return null;
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value) {
  if (!value) {
    return "职位描述未公开。";
  }

  return value.slice(0, 180);
}

function dedupeJobs(items) {
  const seen = new Map();

  for (const item of items) {
    if (!item?.url) {
      continue;
    }

    const key = `${item.company}::${item.title}::${item.city}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}
