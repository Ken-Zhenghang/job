import { readFile } from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import path from "node:path";
import process from "node:process";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;
const mailTo = process.env.MAIL_TO;
const siteUrl = process.env.SITE_URL;

if (!smtpHost || !smtpUser || !smtpPass || !mailFrom || !mailTo) {
  console.log("Skipping email push because SMTP settings are incomplete.");
  process.exit(0);
}

const jobsFile = path.join(process.cwd(), "data", "jobs.json");
const raw = await readFile(jobsFile, "utf8");
const payload = JSON.parse(raw);
const jobs = Array.isArray(payload.jobs) ? payload.jobs.slice(0, 10) : [];

const subject = "美国数据分析岗位日报";
const bodyLines = [
  "美国数据分析岗位日报",
  `更新时间: ${payload.lastUpdated ?? new Date().toISOString()}`,
  "",
];

for (const job of jobs) {
  bodyLines.push(`${job.title} | ${job.company} | ${job.city} | ${job.workMode}`);
  bodyLines.push(`薪资: ${job.salary}`);
  bodyLines.push(`链接: ${job.url}`);
  bodyLines.push("");
}

if (siteUrl) {
  bodyLines.push(`完整网站: ${siteUrl}`);
}

await sendEmail({
  host: smtpHost,
  port: smtpPort,
  user: smtpUser,
  pass: smtpPass,
  from: mailFrom,
  to: mailTo,
  subject,
  body: bodyLines.join("\r\n"),
});

console.log("Email summary sent.");

async function sendEmail({ host, port, user, pass, from, to, subject, body }) {
  let socket = port === 465
    ? tls.connect(port, host, { servername: host })
    : net.connect(port, host);

  const state = {
    buffer: "",
  };

  await onceConnected(socket);
  await readResponse(socket, state);
  await command(socket, state, `EHLO ${host}`);

  if (port !== 465) {
    await command(socket, state, "STARTTLS");
    const secureSocket = tls.connect({
      socket,
      servername: host,
    });
    await onceConnected(secureSocket);
    state.buffer = "";
    await readResponse(secureSocket, state);
    socket.destroy();
    socket = secureSocket;
    await command(socket, state, `EHLO ${host}`);
  }

  await command(socket, state, "AUTH LOGIN");
  await command(socket, state, Buffer.from(user).toString("base64"));
  await command(socket, state, Buffer.from(pass).toString("base64"));
  await command(socket, state, `MAIL FROM:<${from}>`);
  await command(socket, state, `RCPT TO:<${to}>`);
  await command(socket, state, "DATA");

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
    ".",
  ].join("\r\n");

  socket.write(message + "\r\n");
  await readResponse(socket, state);
  await command(socket, state, "QUIT");
  socket.end();
}

function command(socket, state, line) {
  socket.write(`${line}\r\n`);
  return readResponse(socket, state);
}

function readResponse(socket, state) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      state.buffer += chunk.toString("utf8");
      const lines = state.buffer.split("\r\n").filter(Boolean);
      const last = lines.at(-1);

      if (!last || !/^\d{3}[ -]/.test(last)) {
        return;
      }

      if (last[3] === "-") {
        return;
      }

      cleanup();
      state.buffer = "";

      const code = Number(last.slice(0, 3));
      if (code >= 400) {
        reject(new Error(lines.join("\n")));
        return;
      }

      resolve(lines);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function onceConnected(socket) {
  return new Promise((resolve, reject) => {
    if (socket.readyState === "open") {
      resolve();
      return;
    }

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("secureConnect", onConnect);
      socket.off("error", onError);
    };

    socket.on("connect", onConnect);
    socket.on("secureConnect", onConnect);
    socket.on("error", onError);
  });
}

function encodeSubject(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
