# 📊 Daily Push — Automated Job Tracker for Data Analysts

A lightweight web dashboard + multi-channel alert system for tracking Data Analyst / Business Analyst job postings in **Los Angeles, San Jose, and San Francisco**.

**[Live Demo](https://ken-zhenghang.github.io/daily-push/)**

---

## Features

- 🔍 **Multi-Source Scraping** — Greenhouse, Lever, Ashby job boards + Indeed, LinkedIn, Glassdoor
- 🏷️ **Smart Filtering** — Filter by keyword, city, work mode, and posting date
- 📋 **View Tracking** — Mark jobs as viewed, never re-read the same listing
- 🔔 **Browser Notifications** — Alerts on new listings
- 📬 **Multi-Channel Delivery** — Daily summaries via Telegram, Email, and WeCom
- ⏰ **Automated Scheduling** — GitHub Actions runs daily at 9 AM CT

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, HTML/CSS |
| Scraping | Node.js, Greenhouse/Lever/Ashby APIs |
| Automation | GitHub Actions (cron) |
| Notifications | Telegram Bot API, SMTP, WeCom Webhook |
| Hosting | GitHub Pages |

---

## Quick Start

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

---

## Configuration

Required GitHub Secrets:

| Secret | Purpose |
|--------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot auth |
| `TELEGRAM_CHAT_ID` | Target chat for alerts |
| `SMTP_*` | Email delivery (optional) |
| `WECOM_WEBHOOK_URL` | WeCom bot (optional) |

Missing a config? The workflow skips that channel gracefully.

---

## Bonus Workflows

- 🏈 `daily-nfl.yml` — NFL news & scores
- 🤖 `daily-ai.yml` — AI industry roundup (OpenAI, Anthropic, DeepMind, Meta, xAI)

---

## Why This Project

Built to solve a real problem: manually checking 5+ job boards every morning for California DA roles was a time sink. This automates discovery and lets me focus on applying.
