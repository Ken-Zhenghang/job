import process from "node:process";

const CATEGORY_LABELS = {
  model_updates: "模型进展",
  product_launches: "产品发布",
  funding_business: "融资/商业",
  policy_safety: "政策/安全",
};

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  console.log("Skipping AI Telegram push because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.");
  process.exit(0);
}

const digest = await buildAiDigest();

const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    chat_id: chatId,
    text: truncateDigest(digest, 3900),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`AI Telegram send failed: ${response.status} ${body}`);
}

console.log("AI Telegram summary sent.");

async function buildAiDigest() {
  const [openaiNews, anthropicNews, deepmindNews, metaNews, xaiNews, teslaOfficialNews, teslaAutoNews, techCrunchAiNews] = await Promise.all([
    fetchOpenAiNews(),
    fetchAnthropicNews(),
    fetchDeepMindNews(),
    fetchMetaAiNews(),
    fetchXaiNews(),
    fetchTeslaOfficialNews(),
    fetchTeslaAutoNews(),
    fetchTechCrunchAiNews(),
  ]);

  const allItems = dedupeAiItems([
    ...openaiNews,
    ...anthropicNews,
    ...deepmindNews,
    ...metaNews,
    ...xaiNews,
    ...teslaOfficialNews,
    ...teslaAutoNews,
    ...techCrunchAiNews,
  ]).slice(0, 24);

  const top3 = buildTopStories(allItems);
  const topUrls = new Set(top3.map((item) => item.url));
  const companyItems = pickCompanyItems([
    ["OpenAI", openaiNews],
    ["Anthropic", anthropicNews],
    ["Google DeepMind", deepmindNews],
    ["Meta", metaNews],
    ["xAI", xaiNews],
    ["Tesla", [...teslaOfficialNews, ...teslaAutoNews]],
  ], topUrls);
  const industry = techCrunchAiNews.filter((item) => !topUrls.has(item.url)).slice(0, 2);

  const lines = [
    "<b>AI Morning Brief</b>",
    "<i>精简版：重点 / 公司动态 / 行业补充</i>",
    `更新时间: <code>${formatDate(new Date().toISOString())}</code>`,
    "",
    "<b>今日重点 3 条</b>",
  ];

  if (top3.length === 0) {
    lines.push("• 暂无抓到 AI 新闻");
  } else {
    top3.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.company)} ${renderCategoryTag(item.category)} <a href="${escapeHtmlAttr(item.url)}">${escapeHtml(trimText(item.title, 88))}</a>`);
      lines.push(`   ${escapeHtml(buildCommentary(item))} · ${escapeHtml(item.source)}`);
    });
  }

  lines.push("");
  lines.push("<b>公司动态</b>");
  appendCompanyDigest(lines, companyItems);

  lines.push("");
  lines.push("<b>行业补充</b>");
  if (industry.length === 0) {
    lines.push("• 暂无额外行业新闻");
  } else {
    industry.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.company)} ${renderCategoryTag(item.category)} <a href="${escapeHtmlAttr(item.url)}">${escapeHtml(trimText(item.title, 80))}</a>`);
      lines.push(`   ${escapeHtml(buildCommentary(item))} · ${escapeHtml(item.source)}`);
    });
  }

  return lines.join("\n");
}

function appendCompanyDigest(lines, items) {
  if (items.length === 0) {
    lines.push("• 暂无新的公司动态");
    return;
  }

  items.forEach((item) => {
    lines.push(`• ${renderSourceTag(item.company)} ${renderCategoryTag(item.category)} <a href="${escapeHtmlAttr(item.url)}">${escapeHtml(trimText(item.title, 76))}</a>`);
    lines.push(`  ${escapeHtml(buildCommentary(item))}`);
  });
}

function buildTopStories(items) {
  return items
    .map((item) => ({ item, score: scoreItem(item) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
    .slice(0, 3);
}

function scoreItem(item) {
  let score = 0;
  if (item.company === "OpenAI") score += 50;
  if (item.company === "Anthropic") score += 30;
  if (item.company === "Google DeepMind") score += 25;
  if (item.company === "Tesla") score += 12;
  if (item.category === "model_updates") score += 25;
  if (item.category === "product_launches") score += 20;
  if (item.category === "policy_safety") score += 10;
  if (item.source === "TechCrunch AI") score += 5;
  return score;
}

function buildCommentary(item) {
  const company = item.company || "行业";

  if (item.category === "model_updates") {
    return `${company} 有模型能力更新，重点看性能和可用性。`;
  }
  if (item.category === "product_launches") {
    return `${company} 有产品动作，重点看是否已经正式开放。`;
  }
  if (item.category === "funding_business") {
    return `${company} 有商业化进展，重点看合作、收入或融资。`;
  }
  if (item.category === "policy_safety") {
    return `${company} 有政策或安全动态，可能影响上线节奏。`;
  }
  if (company === "Tesla") {
    return "Tesla 有车型、软件或市场评价更新，重点看交付、体验和 FSD 相关变化。";
  }

  return `${company} 有值得关注的新动态。`;
}

async function fetchOpenAiNews() {
  const response = await fetch("https://openai.com/news");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/(?:index|news)\/[^"]+)"[\s\S]{0,500}?>([^<]+)<\/a>[\s\S]{0,200}?(Company|Research|Product|Safety|Security|Global Affairs|AI Adoption|Engineering|Release|Publication|Announcements)?[\s\S]{0,120}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title, section] = match;
    return {
      title: decodeHtml(title.trim()),
      url: href.startsWith("http") ? href : `https://openai.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "OpenAI News",
      company: "OpenAI",
      section: section || "OpenAI News",
    };
  })).slice(0, 10);
}

async function fetchAnthropicNews() {
  const response = await fetch("https://www.anthropic.com/news");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/news\/[^"]+)"[\s\S]{0,300}?>([^<]+)<\/a>[\s\S]{0,180}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: `https://www.anthropic.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "Anthropic News",
      company: "Anthropic",
    };
  })).slice(0, 8);
}

async function fetchDeepMindNews() {
  const response = await fetch("https://deepmind.google/discover/blog/");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/discover\/blog\/[^"]+)"[\s\S]{0,400}?>([^<]+)<\/a>[\s\S]{0,150}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: `https://deepmind.google${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "Google DeepMind Blog",
      company: "Google DeepMind",
    };
  })).slice(0, 8);
}

async function fetchMetaAiNews() {
  const response = await fetch("https://ai.meta.com/blog/");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(https:\/\/ai\.meta\.com\/blog\/[^"]+|\/blog\/[^"]+)"[\s\S]{0,300}?>([^<]+)<\/a>[\s\S]{0,150}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: href.startsWith("http") ? href : `https://ai.meta.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "Meta AI Blog",
      company: "Meta",
    };
  })).slice(0, 8);
}

async function fetchXaiNews() {
  const response = await fetch("https://x.ai/news");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/news\/[^"]+)"[\s\S]{0,300}?>([^<]+)<\/a>[\s\S]{0,160}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: `https://x.ai${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "xAI News",
      company: "xAI",
    };
  })).slice(0, 8);
}

async function fetchTeslaOfficialNews() {
  const response = await fetch("https://www.tesla.com/blog");
  if (!response.ok) return [];
  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/blog\/[^"]+)"[\s\S]{0,400}?>([^<]+)<\/a>[\s\S]{0,220}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];
  return normalizeItems(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: `https://www.tesla.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "Tesla Official",
      company: "Tesla",
    };
  })).slice(0, 6);
}

async function fetchTeslaAutoNews() {
  const response = await fetch("https://electrek.co/guides/tesla/feed/");
  if (!response.ok) return [];
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  return normalizeItems(items.map((item) => ({
    title: decodeHtml(readXmlTag(item, "title")),
    url: readXmlTag(item, "link"),
    dateLabel: readXmlTag(item, "pubDate"),
    source: "Electrek Tesla",
    company: "Tesla",
  }))).slice(0, 6);
}

async function fetchTechCrunchAiNews() {
  const response = await fetch("https://techcrunch.com/category/artificial-intelligence/feed/");
  if (!response.ok) return [];
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  return normalizeItems(items.map((item) => ({
    title: decodeHtml(readXmlTag(item, "title")),
    url: readXmlTag(item, "link"),
    dateLabel: readXmlTag(item, "pubDate"),
    source: "TechCrunch AI",
    company: inferCompany(readXmlTag(item, "title")),
  }))).slice(0, 8);
}

function normalizeItems(items) {
  return items.filter((item) => item.title && item.url).map((item) => ({
    ...item,
    category: classifyItem(item.title),
  }));
}

function dedupeAiItems(items) {
  return dedupeBy(
    dedupeBy(items, (item) => normalizeTitle(item.title)),
    (item) => item.url,
  );
}

function pickCompanyItems(groups, excludedUrls) {
  return groups
    .map(([company, items]) => items.find((item) => item.company === company && !excludedUrls.has(item.url)))
    .filter(Boolean)
    .slice(0, 5);
}

function classifyItem(title) {
  const text = String(title).toLowerCase();
  if (/(model|reasoning|benchmark|training|agent|multimodal|frontier|gpt|claude|gemini|llama|grok)/i.test(text)) return "model_updates";
  if (/(launch|release|rollout|introduc|available|app|api|product|tool|platform|feature|model y|model 3|cybertruck|fsd|autopilot|software update|refresh|delivery|review)/i.test(text)) return "product_launches";
  if (/(funding|raise|raised|valuation|revenue|partnership|acqui|investment|financing|enterprise)/i.test(text)) return "funding_business";
  if (/(policy|regulat|government|law|safety|security|copyright|compliance|ethics|privacy)/i.test(text)) return "policy_safety";
  return "product_launches";
}

function inferCompany(title) {
  const text = String(title).toLowerCase();
  if (text.includes("openai")) return "OpenAI";
  if (text.includes("anthropic") || text.includes("claude")) return "Anthropic";
  if (text.includes("deepmind") || text.includes("gemini") || text.includes("google")) return "Google DeepMind";
  if (text.includes("meta") || text.includes("llama")) return "Meta";
  if (text.includes("xai") || text.includes("grok")) return "xAI";
  if (text.includes("tesla") || text.includes("cybertruck") || text.includes("model y") || text.includes("model 3") || text.includes("autopilot") || text.includes("fsd")) return "Tesla";
  return "Industry";
}

function renderSourceTag(source) {
  return `<code>${escapeHtml(source)}</code>`;
}

function renderCategoryTag(category) {
  return `<code>${escapeHtml(CATEGORY_LABELS[category] ?? "动态")}</code>`;
}

function readXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() : "";
}

function extractDateLabel(value) {
  const match = String(value).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/);
  return match ? match[0] : String(value).slice(0, 40);
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function trimText(value, max) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function truncateDigest(digest, maxLength) {
  if (digest.length <= maxLength) return digest;

  const lines = digest.split("\n");
  const kept = [];
  let currentLength = 0;

  for (const line of lines) {
    const nextLength = currentLength + line.length + (kept.length > 0 ? 1 : 0);
    if (nextLength > maxLength - 30) break;
    kept.push(line);
    currentLength = nextLength;
  }

  if (kept.length === 0) {
    return "<b>AI Morning Brief</b>\n<i>内容过长，已省略。</i>";
  }

  kept.push("");
  kept.push("<i>内容已截断，完整内容请看网站或下一次推送。</i>");
  return kept.join("\n");
}
