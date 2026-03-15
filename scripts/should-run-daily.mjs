import { appendFile } from "node:fs/promises";
import process from "node:process";

const eventName = process.env.GITHUB_EVENT_NAME;
const outputPath = process.env.GITHUB_OUTPUT;
const targetHour = Number(process.env.TARGET_HOUR ?? 9);
const targetMinute = Number(process.env.TARGET_MINUTE ?? 0);
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const parts = formatter.formatToParts(new Date());
const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const hour = Number(values.hour);
const minute = Number(values.minute);
const shouldRun = eventName === "workflow_dispatch" || (hour === targetHour && minute === targetMinute);
const localTime = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute} America/Chicago`;

if (!outputPath) {
  console.log(JSON.stringify({ shouldRun, localTime }));
  process.exit(0);
}

await appendFile(outputPath, `should_run=${shouldRun}\nlocal_time=${localTime}\n`, "utf8");
