import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const webhookUrl = process.env.WECOM_WEBHOOK_URL;
const siteUrl = process.env.SITE_URL;

if (!webhookUrl) {
  console.log("Skipping WeCom push because WECOM_WEBHOOK_URL is not set.");
  process.exit(0);
}

const jobsFile = path.join(process.cwd(), "data", "jobs.json");
const raw = await readFile(jobsFile, "utf8");
const payload = JSON.parse(raw);
const jobs = Array.isArray(payload.jobs) ? payload.jobs.slice(0, 8) : [];

const lines = [
  `美国数据分析岗位日报`,
  `更新时间: ${payload.lastUpdated ?? new Date().toISOString()}`,
  "",
];

for (const job of jobs) {
  lines.push(`- ${job.title} | ${job.company} | ${job.city} | ${job.workMode}`);
  lines.push(`  薪资: ${job.salary}`);
  lines.push(`  链接: ${job.url}`);
}

if (siteUrl) {
  lines.push("");
  lines.push(`完整网站: ${siteUrl}`);
}

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    msgtype: "text",
    text: {
      content: lines.join("\n"),
    },
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Failed to send WeChat payload: ${response.status} ${text}`);
  process.exit(1);
}

console.log("WeChat payload sent.");
