import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const siteUrl = process.env.SITE_URL;

if (!botToken || !chatId) {
  console.log("Skipping Telegram push because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.");
  process.exit(0);
}

const jobsFile = path.join(process.cwd(), "data", "jobs.json");
const raw = await readFile(jobsFile, "utf8");
const payload = JSON.parse(raw);
const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
const searchLinks = [
  "LinkedIn SF: https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=San%20Francisco%2C%20California%2C%20United%20States",
  "LinkedIn SJ: https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=San%20Jose%2C%20California%2C%20United%20States",
  "LinkedIn LA: https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=Los%20Angeles%2C%20California%2C%20United%20States",
  "Indeed SF: https://www.indeed.com/jobs?q=data+analyst&l=San+Francisco%2C+CA",
  "Indeed SJ: https://www.indeed.com/jobs?q=data+analyst&l=San+Jose%2C+CA",
  "Indeed LA: https://www.indeed.com/jobs?q=data+analyst&l=Los+Angeles%2C+CA",
  "Glassdoor SF: https://www.glassdoor.com/Job/san-francisco-data-analyst-jobs-SRCH_IL.0,13_IC1147401_KO14,26.htm",
  "Glassdoor SJ: https://www.glassdoor.com/Job/san-jose-data-analyst-jobs-SRCH_IL.0,8_IC1147436_KO9,21.htm",
  "Glassdoor LA: https://www.glassdoor.com/Job/los-angeles-data-analyst-jobs-SRCH_IL.0,11_IC1146821_KO12,24.htm",
];

const recentToday = jobs.filter((job) => daysSince(job.postedAt) <= 1).slice(0, 6);
const recentWeek = jobs.filter((job) => daysSince(job.postedAt) > 1 && daysSince(job.postedAt) <= 7).slice(0, 6);
const olderBacklog = jobs.filter((job) => daysSince(job.postedAt) > 7).slice(0, 4);

const lines = [
  "美国数据分析岗位日报",
  `更新时间: ${formatDate(payload.lastUpdated ?? new Date().toISOString())}`,
  `今日可重点看: ${recentToday.length} 个`,
  `近 7 天内: ${recentWeek.length} 个`,
  `较早但仍在线: ${olderBacklog.length} 个`,
  "",
];

appendSection(lines, "一、今日 / 近 24 小时", recentToday);
appendSection(lines, "二、最近 7 天", recentWeek);
appendSection(lines, "三、较早但仍可投", olderBacklog);

if (siteUrl) {
  lines.push("");
  lines.push(`完整网站: ${siteUrl}`);
}

lines.push("");
lines.push("补充搜索入口:");
lines.push(...searchLinks);

const text = lines.join("\n").slice(0, 3900);
const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Telegram send failed: ${response.status} ${body}`);
}

console.log("Telegram summary sent.");

function appendSection(lines, title, items) {
  lines.push(title);

  if (items.length === 0) {
    lines.push("暂无匹配岗位");
    lines.push("");
    return;
  }

  items.forEach((job, index) => {
    lines.push(`${index + 1}. ${job.title}`);
    lines.push(`   ${job.company} | ${job.city} | ${job.workMode}`);
    lines.push(`   ${formatAge(job.postedAt)} | ${job.salary}`);
    lines.push(`   ${job.url}`);
  });

  lines.push("");
}

function daysSince(value) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((Date.now() - new Date(value).getTime()) / millisecondsPerDay);
}

function formatAge(value) {
  const days = daysSince(value);
  if (days <= 0) {
    return "今天发布";
  }
  if (days === 1) {
    return "1 天前";
  }
  return `${days} 天前`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}
