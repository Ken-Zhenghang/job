import process from "node:process";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  console.log("Skipping NFL Telegram push because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.");
  process.exit(0);
}

const now = new Date();
const inSeason = isInSeason(now);

const digest = inSeason
  ? await buildInSeasonDigest()
  : await buildOffseasonDigest();

const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    chat_id: chatId,
    text: digest.slice(0, 3900),
    disable_web_page_preview: true,
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`NFL Telegram send failed: ${response.status} ${body}`);
}

console.log("NFL Telegram summary sent.");

async function buildOffseasonDigest() {
  const [transactions, news] = await Promise.all([
    fetchEspnTransactions(),
    fetchNflNews(),
  ]);

  const lines = [
    "NFL 每日简报",
    "模式: 休赛期交易 + 重磅新闻",
    `更新时间: ${formatDate(new Date().toISOString())}`,
    "",
    "一、今日交易 / 签约",
  ];

  if (transactions.length === 0) {
    lines.push("暂无抓到新的交易或签约摘要");
  } else {
    transactions.slice(0, 8).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.team}`);
      lines.push(`   ${item.text}`);
    });
  }

  lines.push("");
  lines.push("二、重磅新闻");

  if (news.length === 0) {
    lines.push("暂无抓到新的头条新闻");
  } else {
    news.slice(0, 6).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(`   ${item.dateLabel}`);
      lines.push(`   ${item.url}`);
    });
  }

  lines.push("");
  lines.push("来源:");
  lines.push("ESPN Transactions: https://www.espn.com/nfl/transactions");
  lines.push("NFL News: https://www.nfl.com/news/");

  return lines.join("\n");
}

async function buildInSeasonDigest() {
  const [scoreboard, news] = await Promise.all([
    fetchEspnScoreboard(),
    fetchNflNews(),
  ]);

  const completed = scoreboard.filter((game) => game.state === "post").slice(0, 6);
  const upcoming = scoreboard.filter((game) => game.state !== "post").slice(0, 6);

  const lines = [
    "NFL 每日简报",
    "模式: 比赛数据 + 重磅新闻",
    `更新时间: ${formatDate(new Date().toISOString())}`,
    "",
    "一、已结束比赛",
  ];

  if (completed.length === 0) {
    lines.push("暂无已结束比赛");
  } else {
    completed.forEach((game, index) => {
      lines.push(`${index + 1}. ${game.awayTeam} ${game.awayScore} - ${game.homeScore} ${game.homeTeam}`);
      lines.push(`   ${game.status}`);
    });
  }

  lines.push("");
  lines.push("二、即将开始 / 进行中");

  if (upcoming.length === 0) {
    lines.push("暂无即将开始的比赛");
  } else {
    upcoming.forEach((game, index) => {
      lines.push(`${index + 1}. ${game.awayTeam} vs ${game.homeTeam}`);
      lines.push(`   ${game.status}`);
    });
  }

  lines.push("");
  lines.push("三、重磅新闻");

  if (news.length === 0) {
    lines.push("暂无抓到新的头条新闻");
  } else {
    news.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(`   ${item.url}`);
    });
  }

  lines.push("");
  lines.push("来源:");
  lines.push("ESPN Scoreboard: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  lines.push("NFL News: https://www.nfl.com/news/");

  return lines.join("\n");
}

async function fetchEspnTransactions() {
  const response = await fetch("https://www.espn.com/nfl/transactions");
  if (!response.ok) {
    throw new Error(`ESPN transactions fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const section = html.split("TRANSACTION").slice(1).join("TRANSACTION");
  const lines = section
    .split("\n")
    .map((line) => decodeHtml(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    if (!line.includes("Image:")) {
      continue;
    }

    const text = line.replace(/^.*Image:\s*/, "").trim();
    const teamMatch = text.match(/^([A-Za-z\s'.-]+?)\s{0,}(Signed|Re-signed|Released|Waived|Acquired|Placed|Tendered|Terminated|Traded)/i);
    if (!teamMatch) {
      continue;
    }

    const team = teamMatch[1].trim();
    const actionText = text.slice(team.length).trim();
    items.push({ team, text: actionText });

    if (items.length >= 12) {
      break;
    }
  }

  return items;
}

async function fetchNflNews() {
  const response = await fetch("https://www.nfl.com/news/");
  if (!response.ok) {
    throw new Error(`NFL news fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(/href="([^"]+)"[^>]*>\s*([^<]+?)\s+(Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb)\s+\d{1,2},\s+\d{4}\s*/g)];

  const items = [];

  for (const match of matches) {
    const [, href, title] = match;
    if (href.includes("/news/") && !title.toLowerCase().includes("view all")) {
      items.push({
        title: decodeHtml(title.trim()),
        url: href.startsWith("http") ? href : `https://www.nfl.com${href}`,
        dateLabel: extractDateLabel(match[0]),
      });
    }
  }

  return dedupeBy(items, (item) => item.url).slice(0, 10);
}

async function fetchEspnScoreboard() {
  const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  if (!response.ok) {
    throw new Error(`ESPN scoreboard fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  const events = Array.isArray(payload.events) ? payload.events : [];

  return events.map((event) => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((item) => item.homeAway === "home");
    const away = competitors.find((item) => item.homeAway === "away");

    return {
      awayTeam: away?.team?.displayName ?? "Away",
      homeTeam: home?.team?.displayName ?? "Home",
      awayScore: away?.score ?? "-",
      homeScore: home?.score ?? "-",
      state: competition?.status?.type?.state ?? "pre",
      status: competition?.status?.type?.shortDetail ?? competition?.status?.type?.description ?? "TBD",
    };
  });
}

function isInSeason(date) {
  const month = date.getUTCMonth() + 1;
  return month >= 8 || month <= 2;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function extractDateLabel(value) {
  const match = value.match(/(Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb)\s+\d{1,2},\s+\d{4}/);
  return match ? match[0] : "";
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ");
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
