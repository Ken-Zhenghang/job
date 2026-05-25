import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/* ------------------------------------------------------------------ */
/*  CONFIG                                                             */
/* ------------------------------------------------------------------ */

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
  /software engineer/i, /data engineer/i, /machine learning/i,
  /research scientist/i, /sourcing/i, /manager/i, /director/i,
  /vp /i, /chief /i, /head of/i, /senior manager/i, /staff engineer/i,
  /principal /i, /architecture/i, /security/i, /compliance analyst/i,
  /legal/i, /counsel/i, /attorney/i, /recruiter/i, /talent/i,
  /accounting/i, /accountant/i, /auditor/i, /tax /i, /payroll/i,
  /sales/i, /account executive/i, /customer success/i, /support/i,
  /devops/i, /platform engineer/i, /infrastructure/i, /site reliability/i,
  /sre/i, /network engineer/i, /systems engineer/i, /qa /i,
  /quality assurance/i, /ux /i, /designer/i, /graphic/i, /video/i,
  /content /i, /social media/i, /copywriter/i, /editor/i,
];

const GREENHOUSE_SOURCES = [
  // Big Tech
  { boardToken: "airbnb", company: "Airbnb" },
  { boardToken: "asana", company: "Asana" },
  { boardToken: "box", company: "Box" },
  { boardToken: "cloudflare", company: "Cloudflare" },
  { boardToken: "coinbase", company: "Coinbase" },
  { boardToken: "crunchyroll", company: "Crunchyroll" },
  { boardToken: "databricks", company: "Databricks" },
  { boardToken: "doordash", company: "DoorDash" },
  { boardToken: "dropbox", company: "Dropbox" },
  { boardToken: "figma", company: "Figma" },
  { boardToken: "grammarly", company: "Grammarly" },
  { boardToken: "instacart", company: "Instacart" },
  { boardToken: "lyft", company: "Lyft" },
  { boardToken: "netflix", company: "Netflix" },
  { boardToken: "palantir", company: "Palantir" },
  { boardToken: "pinterest", company: "Pinterest" },
  { boardToken: "reddit", company: "Reddit" },
  { boardToken: "robinhood", company: "Robinhood" },
  { boardToken: "snapchat", company: "Snap" },
  { boardToken: "snowflake", company: "Snowflake" },
  { boardToken: "stripe", company: "Stripe" },
  { boardToken: "twilio", company: "Twilio" },
  { boardToken: "twitch", company: "Twitch" },
  { boardToken: "uber", company: "Uber" },

  // Fintech / Banking-as-a-Service
  { boardToken: "affirm", company: "Affirm" },
  { boardToken: "bill", company: "BILL" },
  { boardToken: "brex", company: "Brex" },
  { boardToken: "chainalysis", company: "Chainalysis" },
  { boardToken: "chime", company: "Chime" },
  { boardToken: "circle", company: "Circle" },
  { boardToken: "consensys", company: "ConsenSys" },
  { boardToken: "kraken", company: "Kraken" },
  { boardToken: "marqeta", company: "Marqeta" },
  { boardToken: "plaid", company: "Plaid" },
  { boardToken: "rippling", company: "Rippling" },
  { boardToken: "square", company: "Square" },
  { boardToken: "waveapps", company: "Wave" },

  // SaaS / Enterprise
  { boardToken: "calendly", company: "Calendly" },
  { boardToken: "confluent", company: "Confluent" },
  { boardToken: "fastly", company: "Fastly" },
  { boardToken: "glossgenius", company: "GlossGenius" },
  { boardToken: "gusto", company: "Gusto" },
  { boardToken: "hashicorp", company: "HashiCorp" },
  { boardToken: "intercom", company: "Intercom" },
  { boardToken: "lattice", company: "Lattice" },
  { boardToken: "procore", company: "Procore" },
  { boardToken: "scaleai", company: "Scale AI" },
  { boardToken: "servicetitan", company: "ServiceTitan" },
  { boardToken: "shopify", company: "Shopify" },
  { boardToken: "snyk", company: "Snyk" },
  { boardToken: "zscaler", company: "Zscaler" },

  // Health / Wellness
  { boardToken: "betterhelpcom", company: "BetterHelp" },
  { boardToken: "doximity", company: "Doximity" },
  { boardToken: "growtherapy", company: "Grow Therapy" },
  { boardToken: "springhealth66", company: "Spring Health" },

  // Media / Content
  { boardToken: "medium", company: "Medium" },
  { boardToken: "quora", company: "Quora" },
  { boardToken: "redcircle", company: "RedCircle" },
  { boardToken: "tripadvisor", company: "Tripadvisor" },
  { boardToken: "yelp", company: "Yelp" },
  { boardToken: "zillow", company: "Zillow" },

  // E-commerce / Marketplaces
  { boardToken: "etsy", company: "Etsy" },
  { boardToken: "grubhub", company: "Grubhub" },
  { boardToken: "wayfair", company: "Wayfair" },

  // AI / ML
  { boardToken: "samsara", company: "Samsara" },
  { boardToken: "aurora", company: "Aurora" },
  { boardToken: "nuro", company: "Nuro" },
  { boardToken: "zoox", company: "Zoox" },
];

const LEVER_SOURCES = [
  // Big Tech / SaaS
  { site: "atlassian", company: "Atlassian" },
  { site: "canva", company: "Canva" },
  { site: "elastic", company: "Elastic" },
  { site: "github", company: "GitHub" },
  { site: "gitlab", company: "GitLab" },
  { site: "grafana", company: "Grafana" },
  { site: "hudsonrivertrading", company: "Hudson River Trading" },
  { site: "mongodb", company: "MongoDB" },
  { site: "spotify", company: "Spotify" },
  { site: "wex", company: "WEX" },

  // Fintech / Crypto
  { site: "circle", company: "Circle" },
  { site: "mercury", company: "Mercury" },
  { site: "plaid", company: "Plaid" },
  { site: "ramp", company: "Ramp" },
  { site: "stripe", company: "Stripe" },

  // Productivity / Collaboration
  { site: "airtable", company: "Airtable" },
  { site: "clickup", company: "ClickUp" },
  { site: "notion", company: "Notion" },

  // Logistics / Mobility
  { site: "flexport", company: "Flexport" },
  { site: "samsara", company: "Samsara" },

  // AI / Research
  { site: "perplexity", company: "Perplexity" },
  { site: "wandb", company: "Weights & Biases" },

  // Media / Social
  { site: "vimeo", company: "Vimeo" },

  // Health / Bio
  { site: "flatiron", company: "Flatiron Health" },
  { site: "ro", company: "Ro" },
  { site: "tempus", company: "Tempus" },

  // Other
  { site: "eightfold", company: "Eightfold AI" },
  { site: "webflow", company: "Webflow" },
];

const ASHBY_SOURCES = [
  { board: "anthropic", company: "Anthropic" },
  { board: "deel", company: "Deel" },
  { board: "harvey", company: "Harvey" },
  { board: "linear", company: "Linear" },
  { board: "mercury", company: "Mercury" },
  { board: "notion", company: "Notion" },
  { board: "openai", company: "OpenAI" },
  { board: "railway", company: "Railway" },
  { board: "ramp", company: "Ramp" },
  { board: "replit", company: "Replit" },
  { board: "sourcegraph", company: "Sourcegraph" },
  { board: "substack", company: "Substack" },
  { board: "vercel", company: "Vercel" },
];

const WORKABLE_SOURCES = [
  { subdomain: "hotjar", company: "Hotjar" },
  { subdomain: "toggl", company: "Toggl" },
  { subdomain: "transferwise", company: "Wise" },
  { subdomain: "duckduckgo", company: "DuckDuckGo" },
  { subdomain: "bunq", company: "bunq" },
  { subdomain: "automattic", company: "Automattic" },
  { subdomain: "basecamp", company: "Basecamp" },
  { subdomain: "godaddy", company: "GoDaddy" },
];

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const outputFile = path.join(dataDir, "jobs.json");

await mkdir(dataDir, { recursive: true });

const startTime = Date.now();

const tasks = [
  ...GREENHOUSE_SOURCES.map((s) => collectGreenhouse(s)),
  ...LEVER_SOURCES.map((s) => collectLever(s)),
  ...ASHBY_SOURCES.map((s) => collectAshby(s)),
  ...WORKABLE_SOURCES.map((s) => collectWorkable(s)),
];

const collected = await Promise.all(tasks);

const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(1);

const jobs = dedupeJobs(collected.flat())
  .filter(isRelevantJob)
  .filter((job) => daysSince(job.postedAt) <= 60)
  .sort((left, right) => new Date(right.postedAt) - new Date(left.postedAt));

const payload = {
  lastUpdated: new Date().toISOString(),
  fetchDuration: `${fetchDuration}s`,
  sourcesScanned: tasks.length,
  jobs,
};

await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${jobs.length} jobs (${fetchDuration}s, ${tasks.length} sources)`);

/* ------------------------------------------------------------------ */
/*  FETCHERS                                                           */
/* ------------------------------------------------------------------ */

async function collectGreenhouse(source) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${source.boardToken}/jobs?content=true`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.jobs || []).map((j) => normalizeGreenhouseJob(j, source));
  } catch (e) { console.warn(`GH:${source.boardToken}`, e.message); return []; }
}

async function collectLever(source) {
  const url = `https://api.lever.co/v0/postings/${source.site}?mode=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d) ? d : []).map((j) => normalizeLeverJob(j, source));
  } catch (e) { console.warn(`Lever:${source.site}`, e.message); return []; }
}

async function collectAshby(source) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${source.board}?includeCompensation=true`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.jobs || []).map((j) => normalizeAshbyJob(j, source));
  } catch (e) { console.warn(`Ashby:${source.board}`, e.message); return []; }
}

async function collectWorkable(source) {
  const url = `https://${source.subdomain}.workable.com/api/v3/jobs?state=published`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.jobs || []).map((j) => normalizeWorkableJob(j, source));
  } catch (e) { console.warn(`Workable:${source.subdomain}`, e.message); return []; }
}

/* ------------------------------------------------------------------ */
/*  NORMALIZERS                                                        */
/* ------------------------------------------------------------------ */

function normalizeGreenhouseJob(job, source) {
  const loc = job.location?.name ?? "";
  const desc = stripHtml(job.content ?? "");
  return {
    id: `gh-${source.boardToken}-${job.id}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(loc, desc),
    state: "CA",
    workMode: inferWorkMode(loc, desc),
    salary: extractCompensation(job.metadata) ?? null,
    salaryRaw: extractSalaryNumeric(job.metadata),
    postedAt: job.updated_at ?? new Date().toISOString(),
    source: `Greenhouse`,
    url: job.absolute_url ?? `https://job-boards.greenhouse.io/${source.boardToken}/jobs/${job.id}`,
    snippet: excerpt(desc),
    skills: detectSkills(`${job.title} ${desc}`),
  };
}

function normalizeLeverJob(job, source) {
  const loc = job.categories?.location ?? "";
  const desc = stripHtml(job.descriptionPlain ?? job.description ?? "");
  return {
    id: `lever-${source.site}-${job.id}`,
    title: job.text ?? "",
    company: source.company,
    city: pickCity(loc, desc),
    state: "CA",
    workMode: inferWorkMode(loc, desc),
    salary: extractLeverSalary(job) ?? null,
    salaryRaw: extractLeverSalaryNumeric(job),
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
    source: "Lever",
    url: job.hostedUrl ?? `https://jobs.lever.co/${source.site}/${job.id}`,
    snippet: excerpt(desc),
    skills: detectSkills(`${job.text} ${desc}`),
  };
}

function normalizeAshbyJob(job, source) {
  const loc = [
    job.location,
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations.map((it) => it.location) : []),
  ].filter(Boolean).join(" / ");
  const desc = stripHtml(job.descriptionHtml ?? "");
  return {
    id: `ashby-${source.board}-${job.id ?? crypto.randomUUID()}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(loc, desc),
    state: "CA",
    workMode: inferWorkMode(loc, desc, job.isRemote),
    salary: extractAshbyCompensation(job) ?? null,
    salaryRaw: extractAshbySalaryNumeric(job),
    postedAt: job.publishedDate ?? job.updatedAt ?? new Date().toISOString(),
    source: "Ashby",
    url: job.jobUrl ?? `https://jobs.ashbyhq.com/${source.board}`,
    snippet: excerpt(desc),
    skills: detectSkills(`${job.title} ${desc}`),
  };
}

function normalizeWorkableJob(job, source) {
  const loc = job.location?.city ? `${job.location.city}, ${job.location.region || ""}` : (job.location || "");
  const desc = stripHtml(job.description ?? job.full_description ?? "");
  return {
    id: `wb-${source.subdomain}-${job.shortcode || job.id}`,
    title: job.title ?? "",
    company: source.company,
    city: pickCity(String(loc), desc),
    state: "CA",
    workMode: inferWorkMode(String(loc), desc, job.remote),
    salary: job.salary ? `${job.salary}` : null,
    salaryRaw: job.salary_raw ?? null,
    postedAt: job.published_on ?? job.created_at ?? new Date().toISOString(),
    source: "Workable",
    url: job.application_url ?? job.url ?? `https://${source.subdomain}.workable.com/j/${job.shortcode}`,
    snippet: excerpt(desc),
    skills: detectSkills(`${job.title} ${desc}`),
  };
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function isRelevantJob(job) {
  if (!job.title || !job.company || !job.url) return false;
  const title = job.title.toLowerCase();
  return TITLE_PATTERNS.some((p) => p.test(title)) && !EXCLUDED_TITLE_PATTERNS.some((p) => p.test(title)) && job.city !== "Unknown";
}

function pickCity(loc, fallback = "") {
  const map = {
    "san francisco": "San Francisco", "south san francisco": "South San Francisco",
    "san jose": "San Jose", "los angeles": "Los Angeles", "san diego": "San Diego",
    "irvine": "Irvine", "santa monica": "Santa Monica", "pasadena": "Pasadena",
    "oakland": "Oakland", "sacramento": "Sacramento", "palo alto": "Palo Alto",
    "mountain view": "Mountain View", "sunnyvale": "Sunnyvale", "santa clara": "Santa Clara",
    "cupertino": "Cupertino", "menlo park": "Menlo Park", "redwood city": "Redwood City",
    "fremont": "Fremont", "burlingame": "Burlingame", "burbank": "Burbank",
    "glendale": "Glendale", "long beach": "Long Beach", "torrance": "Torrance",
    "newport beach": "Newport Beach", "costa mesa": "Costa Mesa", "anaheim": "Anaheim",
    "el segundo": "El Segundo", "culver city": "Culver City",
    "west hollywood": "West Hollywood", "venice": "Venice", "santa barbara": "Santa Barbara",
    "remote": "Remote",
  };
  const txt = `${loc} ${fallback}`.toLowerCase();
  for (const [k, v] of Object.entries(map)) if (txt.includes(k)) return v;
  if (/\bCA\b/i.test(txt) || /california/i.test(txt)) return "Remote";
  return "Unknown";
}

function inferWorkMode(loc, txt = "", isRemote = false) {
  const t = `${loc} ${txt}`.toLowerCase();
  if (isRemote || t.includes("remote")) return "Remote";
  if (t.includes("hybrid")) return "Hybrid";
  return "On-site";
}

function detectSkills(text) {
  const skills = [];
  const checks = [
    { p: /\bSQL\b/i, t: "SQL" }, { p: /\bPython\b/i, t: "Python" },
    { p: /\bTableau\b/i, t: "Tableau" }, { p: /\bPower\s*BI\b/i, t: "Power BI" },
    { p: /\bLooker\b/i, t: "Looker" }, { p: /\bExcel\b/i, t: "Excel" },
    { p: /\bDatabricks\b/i, t: "Databricks" }, { p: /\bSnowflake\b/i, t: "Snowflake" },
    { p: /\bdbt\b/i, t: "dbt" }, { p: /\bAirflow\b/i, t: "Airflow" },
    { p: /\bSpark\b/i, t: "Spark" }, { p: /\bAWS\b/i, t: "AWS" },
    { p: /\bGCP\b/i, t: "GCP" }, { p: /\bR\b/i, t: "R" },
    { p: /\bBigQuery\b/i, t: "BigQuery" }, { p: /\bRedshift\b/i, t: "Redshift" },
  ];
  for (const { p, t } of checks) if (p.test(text) && !skills.includes(t)) skills.push(t);
  return skills.slice(0, 5);
}

function extractCompensation(meta) {
  if (!Array.isArray(meta)) return null;
  const f = meta.find((m) => typeof m?.name === "string" && /compensation|salary|pay/i.test(m.name));
  return f?.value ? String(f.value) : null;
}

function extractSalaryNumeric(meta) {
  if (!Array.isArray(meta)) return null;
  const f = meta.find((m) => typeof m?.name === "string" && /compensation|salary|pay/i.test(m.name));
  if (!f?.value) return null;
  const m = String(f.value).match(/\$?([\d,]+)\s*[kK]?\s*-?\s*\$?([\d,]+)?\s*[kK]?/);
  if (!m) return null;
  const lo = parseInt(m[1].replace(/,/g, ""), 10);
  return lo < 500 ? lo * 1000 : lo;
}

function extractLeverSalary(job) {
  if (job.salaryRange?.min && job.salaryRange?.max) return `$${job.salaryRange.min.toLocaleString()} - $${job.salaryRange.max.toLocaleString()}`;
  return null;
}
function extractLeverSalaryNumeric(job) { return job.salaryRange?.min ?? null; }

function extractAshbyCompensation(job) {
  const c = job.compensation;
  if (!c) return null;
  if (c.summary) return c.summary;
  if (c.minValue && c.maxValue && c.currencyCode) return `${c.currencyCode} ${c.minValue.toLocaleString()} - ${c.maxValue.toLocaleString()}`;
  return null;
}
function extractAshbySalaryNumeric(job) { return job.compensation?.minValue ?? null; }

function stripHtml(v) {
  return String(v).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function excerpt(v) { return v ? v.slice(0, 200) : "Description not available."; }
function daysSince(v) { return Math.floor((Date.now() - new Date(v).getTime()) / 86400000); }

function dedupeJobs(items) {
  const seen = new Map();
  for (const item of items) {
    if (!item?.url) continue;
    const key = `${item.company}::${item.title}::${item.city}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}