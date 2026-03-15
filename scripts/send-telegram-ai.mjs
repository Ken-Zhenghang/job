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
  const [openaiNews, anthropicNews, tcAiNews] = await Promise.all([
    fetchOpenAiNews(),
    fetchAnthropicNews(),
    fetchTechCrunchAiNews(),
  ]);

  const combined = dedupeBy([
    ...openaiNews.map((item) => ({ ...item, priority: 0 })),
    ...anthropicNews.map((item) => ({ ...item, priority: 1 })),
    ...tcAiNews.map((item) => ({ ...item, priority: 2 })),
  ], (item) => item.url)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 15);

  const top3 = combined.slice(0, 3);
  const openaiTop = openaiNews.slice(0, 4);
  const industryTop = combined.filter((item) => item.source !== "OpenAI").slice(0, 6);

  const lines = [
    "<b>AI Morning Brief</b>",
    "<i>每日 AI 新闻 / OpenAI 优先 / 行业进展</i>",
    `更新时间: <code>${formatDate(new Date().toISOString())}</code>`,
    "",
    "<b>今日重点 3 条</b>",
  ];

  if (top3.length === 0) {
    lines.push("• 暂无抓到 AI 新闻");
  } else {
    top3.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.source)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
      lines.push(`   ${escapeHtml(item.dateLabel)}`);
    });
  }

  lines.push("");
  lines.push("<b>一、OpenAI 重点</b>");

  if (openaiTop.length === 0) {
    lines.push("• 暂无抓到新的 OpenAI 动态");
  } else {
    openaiTop.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.source)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
      lines.push(`   ${escapeHtml(item.dateLabel)} | ${escapeHtml(item.section ?? "OpenAI News")}`);
    });
  }

  lines.push("");
  lines.push("<b>二、行业进展</b>");

  if (industryTop.length === 0) {
    lines.push("• 暂无抓到新的行业新闻");
  } else {
    industryTop.forEach((item, index) => {
      lines.push(`${index + 1}. ${renderSourceTag(item.source)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
      lines.push(`   ${escapeHtml(item.dateLabel)}`);
    });
  }

  lines.push("");
  lines.push("<b>来源</b>");
  lines.push("• OpenAI News");
  lines.push("• Anthropic News");
  lines.push("• TechCrunch AI");

  return lines.join("\n");
}

async function fetchOpenAiNews() {
  const response = await fetch("https://openai.com/news");
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/(?:index|news)\/[^"]+)"[\s\S]{0,500}?>([^<]+)<\/a>[\s\S]{0,200}?(Company|Research|Product|Safety|Security|Global Affairs|AI Adoption|Engineering|Release|Publication|Announcements)?[\s\S]{0,120}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];

  return dedupeBy(blocks.map((match) => {
    const [, href, title, section] = match;
    return {
      title: decodeHtml(title.trim()),
      url: href.startsWith("http") ? href : `https://openai.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "OpenAI",
      section: section || "OpenAI News",
    };
  }), (item) => item.url).slice(0, 10);
}

async function fetchAnthropicNews() {
  const response = await fetch("https://www.anthropic.com/news");
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const blocks = [...html.matchAll(/href="(\/news\/[^"]+)"[\s\S]{0,300}?>([^<]+)<\/a>[\s\S]{0,180}?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g)];

  return dedupeBy(blocks.map((match) => {
    const [, href, title] = match;
    return {
      title: decodeHtml(title.trim()),
      url: `https://www.anthropic.com${href}`,
      dateLabel: extractDateLabel(match[0]),
      source: "Anthropic",
    };
  }), (item) => item.url).slice(0, 8);
}

async function fetchTechCrunchAiNews() {
  const response = await fetch("https://techcrunch.com/category/artificial-intelligence/feed/");
  if (!response.ok) {
    return [];
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);

  return items.map((item) => ({
    title: decodeHtml(readXmlTag(item, "title")),
    url: readXmlTag(item, "link"),
    dateLabel: readXmlTag(item, "pubDate"),
    source: "TechCrunch AI",
  })).filter((item) => item.title && item.url).slice(0, 8);
}

function renderSourceTag(source) {
  return `<code>${escapeHtml(source)}</code>`;
}

function readXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() : "";
}

function extractDateLabel(value) {
  const match = value.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/);
  return match ? match[0] : value.slice(0, 40);
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
