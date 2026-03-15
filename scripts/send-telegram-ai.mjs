import process from "node:process";

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
    text: digest.slice(0, 3900),
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
  const [openaiNews, anthropicNews, deepmindNews, metaNews, xaiNews, techCrunchAiNews] = await Promise.all([
    fetchOpenAiNews(),
    fetchAnthropicNews(),
    fetchDeepMindNews(),
    fetchMetaAiNews(),
    fetchXaiNews(),
    fetchTechCrunchAiNews(),
  ]);

  const allItems = dedupeBy([
    ...openaiNews,
    ...anthropicNews,
    ...deepmindNews,
    ...metaNews,
    ...xaiNews,
    ...techCrunchAiNews,
  ], (item) => item.url).slice(0, 40);

  const top3 = buildTopStories(allItems);
  const categories = groupByCategory(allItems);

  const lines = [
    "<b>AI Morning Brief</b>",
    "<i>每日 AI 新闻 / 公司分栏 / 分类摘要</i>",
    `更新时间: <code>${formatDate(new Date().toISOString())}</code>`,
    "",
    "<b>今日重点 3 条</b>",
  ];

  if (top3.length === 0) {
    lines.push("• 暂无抓到 AI 新闻");
  } else {
    top3.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.company)} ${renderCategoryTag(item.category)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
      lines.push(`   ${escapeHtml(item.dateLabel)} | ${escapeHtml(item.source)}`);
    });
  }

  lines.push("");
  lines.push("<b>一、分类摘要</b>");
  appendCategorySummary(lines, "模型进展", categories.model_updates);
  appendCategorySummary(lines, "产品发布", categories.product_launches);
  appendCategorySummary(lines, "融资 / 商业", categories.funding_business);
  appendCategorySummary(lines, "政策 / 安全", categories.policy_safety);

  appendCompanySection(lines, "二、OpenAI", openaiNews);
  appendCompanySection(lines, "三、Anthropic", anthropicNews);
  appendCompanySection(lines, "四、Google DeepMind", deepmindNews);
  appendCompanySection(lines, "五、Meta", metaNews);
  appendCompanySection(lines, "六、xAI", xaiNews);

  lines.push("");
  lines.push("<b>七、行业补充</b>");
  const industry = techCrunchAiNews.slice(0, 4);
  if (industry.length === 0) {
    lines.push("• 暂无行业补充新闻");
  } else {
    industry.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.company)} ${renderCategoryTag(item.category)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
      lines.push(`   ${escapeHtml(item.dateLabel)} | ${escapeHtml(item.source)}`);
    });
  }

  lines.push("");
  lines.push("<b>来源</b>");
  lines.push("• OpenAI News");
  lines.push("• Anthropic News");
  lines.push("• Google DeepMind Blog");
  lines.push("• Meta AI Blog");
  lines.push("• xAI News");
  lines.push("• TechCrunch AI");

  return lines.join("\n");
}

function appendCompanySection(lines, title, items) {
  lines.push("");
  lines.push(`<b>${title}</b>`);

  if (items.length === 0) {
    lines.push("• 暂无新的动态");
    return;
  }

  items.slice(0, 3).forEach((item, index) => {
    lines.push(`${index + 1}. ${renderCategoryTag(item.category)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
    lines.push(`   ${escapeHtml(item.dateLabel)} | ${escapeHtml(item.source)}`);
  });
}

function appendCategorySummary(lines, label, items) {
  if (!items || items.length === 0) {
    lines.push(`• ${label}: 暂无`);
    return;
  }

  const top = items[0];
  lines.push(`• ${label}: ${renderSourceTag(top.company)} <a href="${top.url}">${escapeHtml(trimText(top.title, 72))}</a>`);
}

function buildTopStories(items) {
  const scored = items
    .map((item) => ({ item, score: scoreItem(item) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item);

  return scored.slice(0, 3);
}

function scoreItem(item) {
  let score = 0;
  if (item.company === "OpenAI") {
    score += 50;
  }
  if (item.company === "Anthropic") {
    score += 30;
  }
  if (item.category === "model_updates") {
    score += 25;
  }
  if (item.category === "product_launches") {
    score += 20;
  }
  if (item.category === "policy_safety") {
    score += 10;
  }
  if (item.source === "TechCrunch AI") {
    score += 5;
  }
  return score;
}

function groupByCategory(items) {
  return {
    model_updates: items.filter((item) => item.category === "model_updates").slice(0, 4),
    product_launches: items.filter((item) => item.category === "product_launches").slice(0, 4),
    funding_business: items.filter((item) => item.category === "funding_business").slice(0, 4),
    policy_safety: items.filter((item) => item.category === "policy_safety").slice(0, 4),
  };
}

async function fetchOpenAiNews() {
  const response = await fetch("https://openai.com/news");
  if (!response.ok) {
    return [];
  }

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
  if (!response.ok) {
    return [];
  }

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
  if (!response.ok) {
    return [];
  }

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
  if (!response.ok) {
    return [];
  }

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
  if (!response.ok) {
    return [];
  }

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

async function fetchTechCrunchAiNews() {
  const response = await fetch("https://techcrunch.com/category/artificial-intelligence/feed/");
  if (!response.ok) {
    return [];
  }

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
  return dedupeBy(items.filter((item) => item.title && item.url).map((item) => ({
    ...item,
    category: classifyItem(item.title),
  })), (item) => item.url);
}

function classifyItem(title) {
  const text = String(title).toLowerCase();

  if (/(model|reasoning|benchmark|training|agent|multimodal|frontier|gpt|claude|gemini|llama|grok)/i.test(text)) {
    return "model_updates";
  }
  if (/(launch|release|rollout|introduc|available|app|api|product|tool|platform|feature)/i.test(text)) {
    return "product_launches";
  }
  if (/(funding|raise|raised|valuation|revenue|partnership|acqui|investment|financing|enterprise)/i.test(text)) {
    return "funding_business";
  }
  if (/(policy|regulat|government|law|safety|security|copyright|compliance|ethics|privacy)/i.test(text)) {
    return "policy_safety";
  }

  return "product_launches";
}

function inferCompany(title) {
  const text = String(title).toLowerCase();
  if (text.includes("openai")) return "OpenAI";
  if (text.includes("anthropic") || text.includes("claude")) return "Anthropic";
  if (text.includes("deepmind") || text.includes("gemini") || text.includes("google")) return "Google DeepMind";
  if (text.includes("meta") || text.includes("llama")) return "Meta";
  if (text.includes("xai") || text.includes("grok")) return "xAI";
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
    if (seen.has(key)) {
      return false;
    }
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
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CATEGORY_LABELS = {
  model_updates: "模型进展",
  product_launches: "产品发布",
  funding_business: "融资/商业",
  policy_safety: "政策/安全",
};
