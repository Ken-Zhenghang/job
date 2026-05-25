import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TARGET_CITIES = [
  "los angeles",
  "san jose",
  "san francisco",
  "san diego",
  "irvine",
  "santa monica",
  "pasadena",
  "oakland",
  "sacramento",
  "palo alto",
  "mountain view",
  "sunnyvale",
  "santa clara",
  "cupertino",
  "menlo park",
  "redwood city",
  "fremont",
  "burlingame",
  "south san francisco",
  "burbank",
  "glendale",
  "long beach",
  "torrance",
  "newport beach",
  "costa mesa",
  "anaheim",
  "el segundo",
  "culver city",
  "west hollywood",
  "venice",
  "santa barbara",
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
  /operations analyst/i,
  /supply chain analyst/i,
  /logistics analyst/i,
  /business intelligence/i,
  /bi analyst/i,
  /revenue analyst/i,
  /growth analyst/i,
  /strategy analyst/i,
  /financial analyst/i,
  /reporting analyst/i,
  /insights analyst/i,
  /intelligence analyst/i,
];

const EXCLUDED_TITLE_PATTERNS = [
  /software engineer/i,
  /data engineer/i,
  /machine learning/i,
  /research scientist/i,
  /sourcing/i,
  /manager/i,
  /director/i,
  /vp /i,
  /chief /i,
  /head of/i,
  /senior manager/i,
  /staff engineer/i,
  /principal /i,
  /architecture/i,
  /security/i,
  /compliance analyst/i,
  /legal/i,
  /counsel/i,
  /attorney/i,
  /recruiter/i,
  /talent/i,
  /accounting/i,
  /accountant/i,
  /auditor/i,
  /tax /i,
  /payroll/i,
  /sales/i,
  /account executive/i,
  /customer success/i,
  /support/i,
  /devops/i,
  /platform engineer/i,
  /infrastructure/i,
  /site reliability/i,
  /sre/i,
  /network engineer/i,
  /systems engineer/i,
  /qa /i,
  /quality assurance/i,
  /ux /i,
  /designer/i,
  /graphic/i,
  /video/i,
  /content /i,
  /social media/i,
  /copywriter/i,
  /editor/i,
];

const GREENHOUSE_SOURCES = [
  { boardToken: "springhealth66", company: "Spring Health" },
  { boardToken: "doximity", company: "Doximity" },
  { boardToken: "fastly", company: "Fastly" },
  { boardToken: "betterhelpcom", company: "BetterHelp" },
  { boardToken: "calendly", company: "Calendly" },
  { boardToken: "redcircle", company: "RedCircle" },
  { boardToken: "crunchyroll", company: "Crunchyroll" },
  { boardToken: "scaleai", company: "Scale AI" },
  { boardToken: "intercom", company: "Intercom" },
  { boardToken: "growtherapy", company: "Grow Therapy" },
  { boardToken: "glossgenius", company: "GlossGenius" },
  { boardToken: "figma", company: "Figma" },
  { boardToken: "chime", company: "Chime" },
  { boardToken: "doordash", company: "DoorDash" },
  { boardToken: "instacart", company: "Instacart" },
  { boardToken: "affirm", company: "Affirm" },
  { boardToken: "gusto", company: "Gusto" },
  { boardToken: "brex", company: "Brex" },
  { boardToken: "rippling", company: "Rippling" },
  { boardToken: "databricks", company: "Databricks" },
  { boardToken: "snowflake", company: "Snowflake" },
  { boardToken: "palantir", company: "Palantir" },
  { boardToken: "robinhood", company: "Robinhood" },
  { boardToken: "coinbase", company: "Coinbase" },
  { boardToken: "stripe", company: "Stripe" },
  { boardToken: "airbnb", company: "Airbnb" },
  { boardToken: "lyft", company: "Lyft" },
  { boardToken: "uber", company: "Uber" },
  { boardToken: "netflix", company: "Netflix" },
  { boardToken: "dropbox", company: "Dropbox" },
  { boardToken: "asana", company: "Asana" },
  { boardToken: "twilio", company: "Twilio" },
  { boardToken: "twitch", company: "Twitch" },
  { boardToken: "pinterest", company: "Pinterest" },
  { boardToken: "snapchat", company: "Snap" },
  { boardToken: "discord", company: "Discord" },
  { boardToken: "reddit", company: "Reddit" },
  { boardToken: "grammarly", company: "Grammarly" },
  { boardToken: "figma", company: "Figma" },
];

const LEVER_SOURCES = [
  { site: "canva", company: "Canva" },
  { site: "atlassian", company: "Atlassian" },
  { site: "github", company: "GitHub" },
  { site: "gitlab", company: "GitLab" },
  { site: "mongodb", company: "MongoDB" },
  { site: "elastic", company: "Elastic" },
  { site: "spotify", company: "Spotify" },
  { site: "shopify", company: "Shopify" },
  { site: "plaid", company: "Plaid" },
  { site: "airtable", company: "Airtable" },
  { site: "box", company: "Box" },
  { site: "clickup", company: "ClickUp" },
  { site: "square", company: "Square" },
];

const ASHBY_SOURCES = [
  { board: "openai", company: "OpenAI" },
  { board: "linear", company: "Linear" },
  { board: "harvey", company: "Harvey" },
  { board: "anthropic", company: "Anthropic" },
  { board: "notion", company: "Notion" },
  { board: "vercel", company: "Vercel" },
  { board: "railway", company: "Railway" },
  { board: "replit", company: "Replit" },
  { board: "mercury", company: "Mercury" },
  { board: "ramp", company: "Ramp" },
  { board: "deel", company: "Deel" },
  { board: "sourcegraph", company: "Sourcegraph" },
  { board: "substack", company: "Substack" },
];

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const outputFile = path.join(dataDir, "jobs.json");

await mkdir(dataDir, { recursive: true });

const startTime = Date.now();

const collected = await Promise.all([
  ...GREENHOUSE_SOURCES.map((source) => collectGreenhouse(source)),
  ...LEVER_SOURCES.map((source) => collectLever(source)),
  ...ASHBY_SOURCES.map((source) => collectAshby(source)),
]);

const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(1);

const jobs = dedupeJobs(collected.flat())
  .filter(isRelevantJob)
  .filter((job) => daysSince(job.postedAt) <= 30)
  .sort((left, right) => new Date(right.postedAt) - new Date(left.postedAt));

const payload = {
  lastUpdated: new Date().toISOString(),
  fetchDuration: `${fetchDuration}s`,
  sourcesScanned: GREENHOUSE_SOURCES.length + LEVER_SOURCES.length + ASHBY_SOURCES.length,
  jobs,
};

await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${jobs.length} jobs (${fetchDuration}s, ${payload.sourcesScanned} sources)`);

/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */

function normalizeGreenhouseJob(job, source) {
  const location = job.location?.name ?? "";
  const description = stripHtml(job.content ?? "");
  const city = pickCity(location, description);

  return {
    id: `gh-${source.boardToken}-${job.id}`,
    title: job.title ?? "",
    company: source.company,
    city,
    state: "CA",
    workMode: inferWorkMode(location, description),
    salary: extractCompensation(job.metadata) ?? null,
    salaryRaw: extractSalaryNumeric(job.metadata),
    postedAt: job.updated_at ?? new Date().toISOString(),
    source: `Greenhouse:${source.boardToken}`,
    url: job.absolute_url ?? `https://job-boards.greenhouse.io/${source.boardToken}/jobs/${job.id}`,
    snippet: excerpt(description),
    skills: detectSkills(`${job.title} ${job.content}`),
  };
}

function normalizeLeverJob(job, source) {
  const location = job.categories?.location ?? "";
  const description = stripHtml(job.descriptionPlain ?? job.description ?? "");
  const city = pickCity(location, description);

  return {
    id: `lever-${source.site}-${job.id}`,
    title: job.text ?? "",
    company: source.company,
    city,
    state: "CA",
    workMode: inferWorkMode(location, description),
    salary: extractLeverSalary(job) ?? null,
    salaryRaw: extractLeverSalaryNumeric(job),
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
    source: `Lever:${source.site}`,
    url: job.hostedUrl ?? `https://jobs.lever.co/${source.site}/${job.id}`,
    snippet: excerpt(description),
    skills: detectSkills(`${job.text} ${description}`),
  };
}

function normalizeAshbyJob(job, source) {
  const location = [
    job.location,
    ...(Array.isArray(job.secondaryLocations)
      ? job.secondaryLocations.map((item) => item.location)
      : []),
  ].filter(Boolean).join(" / ");

  const description = stripHtml(job.descriptionHtml ?? "");

  return {
    id: `ashby-${source.board}-${job.id ?? job.jobUrl ?? crypto.randomUUID()}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(location, description),
    state: "CA",
    workMode: inferWorkMode(location, description, job.isRemote),
    salary: extractAshbyCompensation(job) ?? null,
    salaryRaw: extractAshbySalaryNumeric(job),
    postedAt: job.publishedDate ?? job.updatedAt ?? new Date().toISOString(),
    source: `Ashby:${source.board}`,
    url: job.jobUrl ?? `https://jobs.ashbyhq.com/${source.board}`,
    snippet: excerpt(description),
    skills: detectSkills(`${job.title} ${description}`),
  };
}

/* -------------------------------------------------------------------------- */

function isRelevantJob(job) {
  if (!job.title || !job.company || !job.url) {
    return false;
  }

  const title = job.title.toLowerCase();

  const matchesTitle = TITLE_PATTERNS.some((pattern) => pattern.test(title));
  const excludedTitle = EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));

  return matchesTitle && !excludedTitle && job.city !== "Unknown";
}

function pickCity(locationText, fallbackText = "") {
  const text = `${locationText} ${fallbackText}`.toLowerCase();
  const cityMap = {
    "san francisco": "San Francisco",
    "south san francisco": "South San Francisco",
    "san jose": "San Jose",
    "los angeles": "Los Angeles",
    "san diego": "San Diego",
    "irvine": "Irvine",
    "santa monica": "Santa Monica",
    "pasadena": "Pasadena",
    "oakland": "Oakland",
    "sacramento": "Sacramento",
    "palo alto": "Palo Alto",
    "mountain view": "Mountain View",
    "sunnyvale": "Sunnyvale",
    "santa clara": "Santa Clara",
    "cupertino": "Cupertino",
    "menlo park": "Menlo Park",
    "redwood city": "Redwood City",
    "fremont": "Fremont",
    "burlingame": "Burlingame",
    "burbank": "Burbank",
    "glendale": "Glendale",
    "long beach": "Long Beach",
    "torrance": "Torrance",
    "newport beach": "Newport Beach",
    "costa mesa": "Costa Mesa",
    "anaheim": "Anaheim",
    "el segundo": "El Segundo",
    "culver city": "Culver City",
    "west hollywood": "West Hollywood",
    "venice": "Venice",
    "santa barbara": "Santa Barbara",
    "remote": "Remote",
  };

  for (const [key, value] of Object.entries(cityMap)) {
    if (text.includes(key)) {
      return value;
    }
  }

  if (/\bCA\b/i.test(text) || /california/i.test(text)) {
    return "Remote";
  }

  return "Unknown";
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

function detectSkills(text) {
  const skills = [];
  const checks = [
    { pattern: /\bSQL\b/i, tag: "SQL" },
    { pattern: /\bPython\b/i, tag: "Python" },
    { pattern: /\bTableau\b/i, tag: "Tableau" },
    { pattern: /\bPower\s*BI\b/i, tag: "Power BI" },
    { pattern: /\bLooker\b/i, tag: "Looker" },
    { pattern: /\bExcel\b/i, tag: "Excel" },
    { pattern: /\bDatabricks\b/i, tag: "Databricks" },
    { pattern: /\bSnowflake\b/i, tag: "Snowflake" },
    { pattern: /\bdbt\b/i, tag: "dbt" },
    { pattern: /\bAirflow\b/i, tag: "Airflow" },
    { pattern: /\bSpark\b/i, tag: "Spark" },
    { pattern: /\bAWS\b/i, tag: "AWS" },
    { pattern: /\bGCP\b/i, tag: "GCP" },
    { pattern: /\bR\b/i, tag: "R" },
    { pattern: /\bBigQuery\b/i, tag: "BigQuery" },
    { pattern: /\bRedshift\b/i, tag: "Redshift" },
  ];

  for (const { pattern, tag } of checks) {
    if (pattern.test(text) && !skills.includes(tag)) {
      skills.push(tag);
    }
  }

  return skills.slice(0, 5);
}

function extractCompensation(metadata) {
  if (!Array.isArray(metadata)) {
    return null;
  }

  const compensationField = metadata.find((item) =>
    typeof item?.name === "string" && /compensation|salary|pay/i.test(item.name));

  return compensationField?.value ? String(compensationField.value) : null;
}

function extractSalaryNumeric(metadata) {
  if (!Array.isArray(metadata)) return null;
  const field = metadata.find((item) =>
    typeof item?.name === "string" && /compensation|salary|pay/i.test(item.name));
  if (!field?.value) return null;
  const match = String(field.value).match(/\$?([\d,]+)\s*[kK]?\s*-?\s*\$?([\d,]+)?\s*[kK]?/);
  if (!match) return null;
  const low = parseInt(match[1].replace(/,/g, ""), 10);
  const high = match[2] ? parseInt(match[2].replace(/,/g, ""), 10) : low;
  return low < 500 ? low * 1000 : low; // detect if in K format
}

function extractLeverSalary(job) {
  if (job.salaryRange?.min && job.salaryRange?.max) {
    return `$${job.salaryRange.min.toLocaleString()} - $${job.salaryRange.max.toLocaleString()}`;
  }
  return null;
}

function extractLeverSalaryNumeric(job) {
  if (job.salaryRange?.min) return job.salaryRange.min;
  return null;
}

function extractAshbyCompensation(job) {
  const compensation = job.compensation;
  if (!compensation) return null;
  if (compensation.summary) return compensation.summary;
  if (compensation.minValue && compensation.maxValue && compensation.currencyCode) {
    return `${compensation.currencyCode} ${compensation.minValue.toLocaleString()} - ${compensation.maxValue.toLocaleString()}`;
  }
  return null;
}

function extractAshbySalaryNumeric(job) {
  const compensation = job.compensation;
  if (!compensation) return null;
  if (compensation.minValue) return compensation.minValue;
  return null;
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value) {
  if (!value) return "职位描述未公开。";
  return value.slice(0, 200);
}

function daysSince(value) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((Date.now() - new Date(value).getTime()) / millisecondsPerDay);
}

function dedupeJobs(items) {
  const seen = new Map();

  for (const item of items) {
    if (!item?.url) continue;
    const key = `${item.company}::${item.title}::${item.city}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}