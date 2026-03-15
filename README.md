# 美国数据分析岗位雷达

一个轻量网页，用来追踪美国数据分析相关岗位，默认聚焦以下城市：

- Los Angeles
- San Jose
- San Francisco

当前计划对接的 GitHub 仓库：

- 用户名：`Ken-Zhenghang`
- 仓库名：`job`
- 仓库地址：`https://github.com/Ken-Zhenghang/job`

## 现在能做什么

- 展示岗位列表
- 按关键词、城市、工作方式、发布时间筛选
- 记录你已看过的岗位
- 有新增岗位时触发浏览器通知
- 通过 `scripts/update-jobs.mjs` 从多个公开职位源抓取最新数据
- 通过 `scripts/send-wechat.mjs` 把每日岗位摘要推送到企业微信机器人

## 本地运行

直接在项目目录启动一个静态服务器：

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## 数据格式

前端默认读取 `data/jobs.json`，格式如下：

```json
{
  "lastUpdated": "2026-03-15T08:30:00-05:00",
  "jobs": [
    {
      "id": "sf-001",
      "title": "Senior Data Analyst",
      "company": "Stripe",
      "city": "San Francisco",
      "state": "CA",
      "workMode": "Hybrid",
      "salary": "$145,000 - $175,000",
      "postedAt": "2026-03-15T06:15:00-05:00",
      "source": "Company Careers",
      "url": "https://example.com/jobs/sf-001",
      "snippet": "Build KPI frameworks and support product decisions."
    }
  ]
}
```

## 每日自动更新

仓库现在内置的是多源采集器，默认会抓取公开职位板：

```bash
node ./scripts/update-jobs.mjs
```

当前策略：

- 主源：公司官网所使用的 Greenhouse、Lever、Ashby 职位板 API
- 补充发现源：Indeed、LinkedIn、Glassdoor
- 筛选：优先保留 Data Analyst、Senior Data Analyst、Product Analyst、Business Analyst、Marketing Analyst、Analytics Engineer 等贴近数据分析的职位

建议把采集命令放进：

- `GitHub Actions`
- `cron`
- 或 Codex automation

这样每天更新 `data/jobs.json` 后，网页刷新即可看到新岗位。

如果你要用 GitHub Actions 自动跑，仓库里已经有定时工作流模板，后续只需要在仓库 Secrets 中填入：

- `WECOM_WEBHOOK_URL`
- `SITE_URL`

如果暂时没填 `WECOM_WEBHOOK_URL`，工作流会跳过企业微信发送，不会因为缺少 webhook 而失败。

## 说明

当前仓库内置的是我已手动核过的一批公开岗位链接，同时也加上了自动多源采集器。长期策略如下：

- 主源：公司官网、Greenhouse、Lever、Ashby
- 补充源：Indeed、LinkedIn、Glassdoor
- 推送：企业微信机器人

原因是 Indeed、LinkedIn、Glassdoor 反爬更强、页面结构变化更频繁，不适合作为唯一主抓取源。

## 微信推送

当前仓库已经预留企业微信机器人推送脚本：

```bash
WECOM_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" node ./scripts/send-wechat.mjs
```

可选环境变量：

```bash
SITE_URL="https://your-fixed-site.example" WECOM_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" node ./scripts/send-wechat.mjs
```

说明：

- 这是最容易稳定落地的“接微信”方案
- 如果你要接个人微信，而不是企业微信/群机器人，通常需要服务号、企业微信，或者第三方桥接服务

## 固定网站

如果走 GitHub Pages，固定网址会是：

```text
https://ken-zhenghang.github.io/job/
```

部署工作流文件在 `.github/workflows/deploy-pages.yml`。

注意：

- GitHub Pages 站点本身是公开可访问的
- 如果你要“非公开但你自己能看”，建议后续改成 Netlify + 密码保护
- 代码仍然可以放在 GitHub 私有仓库或公开仓库里
