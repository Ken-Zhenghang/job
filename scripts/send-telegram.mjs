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
const jobs = Array.isArray(payload.jobs) ? payload.jobs.slice(0, 8) : [];

const lines = [
  "美国数据分析岗位日报",
  `更新时间: ${payload.lastUpdated ?? new Date().toISOString()}`,
  "",
];

for (const job of jobs) {
  lines.push(`${job.title} | ${job.company} | ${job.city}`);
  lines.push(`${job.workMode} | ${job.salary}`);
  lines.push(job.url);
  lines.push("");
}

if (siteUrl) {
  lines.push(`完整网站: ${siteUrl}`);
}

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
