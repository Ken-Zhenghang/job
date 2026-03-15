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
    parse_mode: "HTML",
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
    fetchCombinedNews(),
  ]);

  const trades = transactions.filter((item) => /(traded|acquired)/i.test(item.text));
  const injuries = transactions.filter((item) => /(injured reserve|reserve\/injured|physically unable|non-football injury|injury|concussion|NFI|PUP)/i.test(item.text));
  const cuts = transactions.filter((item) => /(released|waived|terminated|cut)/i.test(item.text));
  const signings = transactions.filter((item) => !trades.includes(item) && !injuries.includes(item) && !cuts.includes(item));
  const top3 = buildTopStories({ trades, injuries, cuts, signings, news });

  const lines = [
    "<b>NFL 每日简报</b>",
    "<i>休赛期模式: 交易 / 伤病 / 裁员 / 新闻</i>",
    `更新时间: <code>${formatDate(new Date().toISOString())}</code>`,
    "",
    "<b>今日重点 3 条</b>",
  ];

  if (top3.length === 0) {
    lines.push("• 暂无足够内容生成今日重点");
  } else {
    top3.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  lines.push("");
  lines.push("<b>一、交易</b>");
  appendTransactionSection(lines, trades, "暂无抓到新的交易摘要");

  lines.push("");
  lines.push("<b>二、伤病</b>");
  appendTransactionSection(lines, injuries, "暂无抓到新的伤病动态");

  lines.push("");
  lines.push("<b>三、裁员 / Waived / Released</b>");
  appendTransactionSection(lines, cuts, "暂无抓到新的裁员或放弃球员动态");

  lines.push("");
  lines.push("<b>四、签约 / 续约 / 其他动态</b>");
  appendTransactionSection(lines, signings, "暂无抓到新的签约或续约动态");

  lines.push("");
  lines.push("<b>五、重磅新闻</b>");
  appendNewsSection(lines, news, 6);

  lines.push("");
  lines.push("<b>来源</b>");
  lines.push("• ESPN Transactions");
  lines.push("• NFL.com");
  lines.push("• ProFootballTalk");

  return lines.join("\n");
}

async function buildInSeasonDigest() {
  const [scoreboard, news] = await Promise.all([
    fetchEspnScoreboard(),
    fetchCombinedNews(),
  ]);

  const completed = scoreboard.filter((game) => game.state === "post").slice(0, 6);
  const upcoming = scoreboard.filter((game) => game.state !== "post").slice(0, 6);
  const top3 = buildInSeasonTopStories({ completed, upcoming, news });

  const lines = [
    "<b>NFL 每日简报</b>",
    "<i>赛季模式: 比分 / 赛程 / 新闻</i>",
    `更新时间: <code>${formatDate(new Date().toISOString())}</code>`,
    "",
    "<b>今日重点 3 条</b>",
  ];

  if (top3.length === 0) {
    lines.push("• 暂无足够内容生成今日重点");
  } else {
    top3.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  lines.push("");
  lines.push("<b>一、已结束比赛</b>");
  appendGameSection(lines, completed, "暂无已结束比赛");

  lines.push("");
  lines.push("<b>二、即将开始 / 进行中</b>");
  appendGameSection(lines, upcoming, "暂无即将开始的比赛", true);

  lines.push("");
  lines.push("<b>三、重磅新闻</b>");
  appendNewsSection(lines, news, 5);

  lines.push("");
  lines.push("<b>来源</b>");
  lines.push("• ESPN Scoreboard");
  lines.push("• NFL.com");
  lines.push("• ProFootballTalk");

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
    items.push({
      team,
      text: actionText,
      source: "ESPN Transactions",
      teamTags: detectTeams(`${team} ${actionText}`),
    });

    if (items.length >= 16) {
      break;
    }
  }

  return items;
}

async function fetchNflNews() {
  const response = await fetch("https://www.nfl.com/news/");
  if (!response.ok) {
    return [];
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
        source: "NFL.com",
        teamTags: detectTeams(title),
      });
    }
  }

  return dedupeBy(items, (item) => item.url).slice(0, 12);
}

async function fetchPftNews() {
  const response = await fetch("https://profootballtalk.nbcsports.com/feed/");
  if (!response.ok) {
    return [];
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);

  return items.map((item) => {
    const title = readXmlTag(item, "title");
    const url = readXmlTag(item, "link");
    const dateLabel = readXmlTag(item, "pubDate");

    return {
      title: decodeHtml(title),
      url,
      dateLabel,
      source: "ProFootballTalk",
      teamTags: detectTeams(title),
    };
  }).filter((item) => item.title && item.url).slice(0, 12);
}

async function fetchCombinedNews() {
  const results = await Promise.allSettled([
    fetchNflNews(),
    fetchPftNews(),
  ]);

  const merged = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  return dedupeBy(merged, (item) => item.url).slice(0, 14);
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
      teamTags: [away?.team?.abbreviation, home?.team?.abbreviation].filter(Boolean),
    };
  });
}

function appendTransactionSection(lines, items, emptyText) {
  if (items.length === 0) {
    lines.push(`• ${emptyText}`);
    return;
  }

  items.slice(0, 6).forEach((item, index) => {
    lines.push(`${index + 1}. ${renderTeamTag(item.teamTags)} <b>${escapeHtml(item.team)}</b>`);
    lines.push(`   ${escapeHtml(item.text)}`);
    lines.push(`   ${escapeHtml(item.source)}`);
  });
}

function appendNewsSection(lines, items, limit) {
  if (items.length === 0) {
    lines.push("• 暂无抓到新的头条新闻");
    return;
  }

  items.slice(0, limit).forEach((item, index) => {
    lines.push(`${index + 1}. ${renderTeamTag(item.teamTags)} <a href="${item.url}">${escapeHtml(item.title)}</a>`);
    lines.push(`   ${escapeHtml(item.dateLabel)} | ${escapeHtml(item.source)}`);
  });
}

function appendGameSection(lines, items, emptyText, upcoming = false) {
  if (items.length === 0) {
    lines.push(`• ${emptyText}`);
    return;
  }

  items.forEach((game, index) => {
    if (upcoming) {
      lines.push(`${index + 1}. ${renderTeamTag(game.teamTags)} <b>${escapeHtml(game.awayTeam)} vs ${escapeHtml(game.homeTeam)}</b>`);
    } else {
      lines.push(`${index + 1}. ${renderTeamTag(game.teamTags)} <b>${escapeHtml(game.awayTeam)} ${game.awayScore} - ${game.homeScore} ${escapeHtml(game.homeTeam)}</b>`);
    }
    lines.push(`   ${escapeHtml(game.status)}`);
  });
}

function buildTopStories({ trades, injuries, cuts, signings, news }) {
  const highlights = [];

  if (trades[0]) {
    highlights.push(`${renderPlainTag(trades[0].teamTags)} 交易: ${trimSentence(trades[0].text)}`);
  }
  if (signings[0]) {
    highlights.push(`${renderPlainTag(signings[0].teamTags)} 签约: ${trimSentence(signings[0].text)}`);
  }
  if (news[0]) {
    highlights.push(`${renderPlainTag(news[0].teamTags)} 新闻: ${trimSentence(news[0].title, 70)}`);
  }
  if (injuries[0] && highlights.length < 3) {
    highlights.push(`${renderPlainTag(injuries[0].teamTags)} 伤病: ${trimSentence(injuries[0].text)}`);
  }
  if (cuts[0] && highlights.length < 3) {
    highlights.push(`${renderPlainTag(cuts[0].teamTags)} 裁员: ${trimSentence(cuts[0].text)}`);
  }

  return highlights.slice(0, 3);
}

function buildInSeasonTopStories({ completed, upcoming, news }) {
  const highlights = [];

  if (completed[0]) {
    highlights.push(`${renderPlainTag(completed[0].teamTags)} 比分: ${completed[0].awayTeam} ${completed[0].awayScore} - ${completed[0].homeScore} ${completed[0].homeTeam}`);
  }
  if (upcoming[0]) {
    highlights.push(`${renderPlainTag(upcoming[0].teamTags)} 赛程: ${upcoming[0].awayTeam} vs ${upcoming[0].homeTeam}`);
  }
  if (news[0]) {
    highlights.push(`${renderPlainTag(news[0].teamTags)} 新闻: ${trimSentence(news[0].title, 70)}`);
  }

  return highlights.slice(0, 3);
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

function readXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() : "";
}

function decodeHtml(value) {
  return String(value)
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

function detectTeams(value) {
  const text = String(value).toLowerCase();
  return TEAM_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.tag).slice(0, 2);
}

function renderTeamTag(tags) {
  const values = Array.isArray(tags) ? tags : [tags];
  const filtered = values.filter(Boolean).slice(0, 2);
  if (filtered.length === 0) {
    return "<code>LEAGUE</code>";
  }
  return filtered.map((tag) => `<code>${escapeHtml(tag)}</code>`).join(" ");
}

function renderPlainTag(tags) {
  const values = Array.isArray(tags) ? tags : [tags];
  const filtered = values.filter(Boolean).slice(0, 2);
  if (filtered.length === 0) {
    return "[LEAGUE]";
  }
  return filtered.map((tag) => `[${tag}]`).join("");
}

function trimSentence(value, max = 90) {
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

const TEAM_PATTERNS = [
  { tag: "ARI", pattern: /\barizona\b|\bcardinals\b/ },
  { tag: "ATL", pattern: /\batlanta\b|\bfalcons\b/ },
  { tag: "BAL", pattern: /\bbaltimore\b|\bravens\b/ },
  { tag: "BUF", pattern: /\bbuffalo\b|\bbills\b/ },
  { tag: "CAR", pattern: /\bcarolina\b|\bpanthers\b/ },
  { tag: "CHI", pattern: /\bchicago\b|\bbears\b/ },
  { tag: "CIN", pattern: /\bcincinnati\b|\bbengals\b/ },
  { tag: "CLE", pattern: /\bcleveland\b|\bbrowns\b/ },
  { tag: "DAL", pattern: /\bdallas\b|\bcowboys\b/ },
  { tag: "DEN", pattern: /\bdenver\b|\bbroncos\b/ },
  { tag: "DET", pattern: /\bdetroit\b|\blions\b/ },
  { tag: "GB", pattern: /\bgreen bay\b|\bpackers\b/ },
  { tag: "HOU", pattern: /\bhouston\b|\btexans\b/ },
  { tag: "IND", pattern: /\bindianapolis\b|\bcolts\b/ },
  { tag: "JAX", pattern: /\bjacksonville\b|\bjaguars\b/ },
  { tag: "KC", pattern: /\bkansas city\b|\bchiefs\b/ },
  { tag: "LV", pattern: /\blas vegas\b|\braiders\b/ },
  { tag: "LAC", pattern: /\bchargers\b/ },
  { tag: "LAR", pattern: /\brams\b/ },
  { tag: "MIA", pattern: /\bmiami\b|\bdolphins\b/ },
  { tag: "MIN", pattern: /\bminnesota\b|\bvikings\b/ },
  { tag: "NE", pattern: /\bpatriots\b|\bnew england\b/ },
  { tag: "NO", pattern: /\bsaints\b|\bnew orleans\b/ },
  { tag: "NYG", pattern: /\bgiants\b/ },
  { tag: "NYJ", pattern: /\bjets\b/ },
  { tag: "PHI", pattern: /\beagles\b|\bphiladelphia\b/ },
  { tag: "PIT", pattern: /\bsteelers\b|\bpittsburgh\b/ },
  { tag: "SEA", pattern: /\bseahawks\b|\bseattle\b/ },
  { tag: "SF", pattern: /\b49ers\b|\bsan francisco\b/ },
  { tag: "TB", pattern: /\bbuccaneers\b|\btampa bay\b/ },
  { tag: "TEN", pattern: /\btitans\b|\btennessee\b/ },
  { tag: "WAS", pattern: /\bcommanders\b|\bwashington\b/ },
];
