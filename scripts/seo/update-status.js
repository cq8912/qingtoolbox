/**
 * 更新根目录 STATUS.md，作为自动化状态看板
 */
import fs from 'fs';
import path from 'path';

const today = new Date().toISOString().slice(0, 10);
const reportFile = 'reports/daily/latest-report.md';
let reportSnippet = '暂无日报';

if (fs.existsSync(reportFile)) {
  reportSnippet = fs.readFileSync(reportFile, 'utf-8').slice(0, 2000);
}

const weeklyDir = 'reports/weekly';
let weeklySnippet = '暂无周报';
if (fs.existsSync(weeklyDir)) {
  const files = fs.readdirSync(weeklyDir).filter((f) => f.endsWith('.md')).sort().reverse();
  if (files[0]) {
    weeklySnippet = fs.readFileSync(path.join(weeklyDir, files[0]), 'utf-8').slice(0, 1500);
  }
}

const md = `# 轻工具箱 · 自动化状态看板

> 最后更新：${today}

## 快速入口

| 项目 | 地址 |
|------|------|
| 生产站 | https://tools.cqzzz.top |
| 仓库 | GitHub 本仓库 |
| 最新日报 | [reports/daily/latest-report.md](./reports/daily/latest-report.md) |

## 自动化流水线

| 任务 | 频率 | 说明 |
|------|------|------|
| Daily SEO Report | 每天 09:30 北京时间 | 拉 GSC → 分析 → 写日报 → commit main |
| Weekly Growth Plan | 每周一 | 生成增长周报 + 更新本看板 |
| CI | 每次 push/PR | lint + build + metadata 检查 |

## 你需要关注的

1. **PR 通知**：GitHub 邮件 / 手机 App 推送（可选）
2. **本文件 + 日报**：了解 Agent 做了什么
3. **AdSense**：有稳定流量后再申请（建议日 UV 100+ 或收录 20+ 页）

---

## 最新日报摘要

${reportSnippet}

---

## 最新周报摘要

${weeklySnippet}
`;

fs.writeFileSync('STATUS.md', md);
console.log('STATUS.md 已更新');
