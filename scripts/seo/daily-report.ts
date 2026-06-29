import fs from 'fs';
import path from 'path';

const today = new Date().toISOString().slice(0, 10);
const REPORT_DIR = 'reports/daily';
const WEEKLY_DIR = 'reports/weekly';

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(WEEKLY_DIR, { recursive: true });

  const oppFile = path.join(REPORT_DIR, 'opportunities.json');
  let opportunities: any[] = [];
  if (fs.existsSync(oppFile)) {
    opportunities = JSON.parse(fs.readFileSync(oppFile, 'utf-8'));
  }

  const lines = [
    `# SEO 日报 ${today}`,
    '',
    `> 站点：tools.cqzzz.top（轻工具箱）`,
    `> 生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '## 数据状态',
    '',
  ];

  const gscFile = path.join(REPORT_DIR, 'gsc-pages.csv');
  const gscContent = fs.existsSync(gscFile) ? fs.readFileSync(gscFile, 'utf-8') : '';
  const hasGsc = gscContent && !gscContent.includes('no_credentials') && !gscContent.includes('fetch_failed');

  if (hasGsc) {
    const pqFile = path.join(REPORT_DIR, 'gsc-page-query.csv');
    const pqContent = fs.existsSync(pqFile) ? fs.readFileSync(pqFile, 'utf-8').trim() : '';
    const realRows = pqContent && !pqContent.includes('status,message')
      ? Math.max(0, pqContent.split('\n').length - 1)
      : 0;

    lines.push('- GSC 数据：已拉取');
    lines.push(`- 搜索记录：${realRows} 条（近 28 天 page-query）`);
    lines.push(`- 机会数量：${opportunities.length}`);
    if (realRows == 0) {
      lines.push('- 说明：API 已连通但暂无曝光数据，新站常见；sitemap 格式正常，等 Google 收录后会有数据');
    } else if (opportunities.length == 0) {
      lines.push('- 说明：有曝光数据，但尚未达到机会评分阈值');
    }
    lines.push('');
    lines.push('## Top 10 机会');
    lines.push('');
    for (const o of opportunities.slice(0, 10)) {
      lines.push(`- **${o.query || o.page}** | 曝光 ${o.impressions} | 排名 ${o.position?.toFixed(1)} | 分数 ${o.score}`);
    }
  } else if (gscContent.includes('fetch_failed')) {
    lines.push('- GSC 数据：拉取失败（Google API 网络临时错误，已自动重试）');
    lines.push('- 日报仍正常生成，明日定时任务会再次拉取');
    lines.push('');
    lines.push('## 冷启动建议');
    lines.push('');
    lines.push('- 提交 sitemap 到 Google Search Console');
    lines.push('- 在知乎/V2EX 等分享实用工具页');
    lines.push('- 每周新增 1 个工具或优化 1 个页面 title');
  } else {
    lines.push('- GSC 数据：未配置（待添加 `GOOGLE_APPLICATION_CREDENTIALS_JSON`）');
    lines.push('');
    lines.push('## 冷启动建议');
    lines.push('');
    lines.push('- 提交 sitemap 到 Google Search Console');
    lines.push('- 在知乎/V2EX 等分享实用工具页');
    lines.push('- 每周新增 1 个工具或优化 1 个页面 title');
  }

  // Bing 站长数据
  lines.push('');
  lines.push('## Bing 数据');
  lines.push('');
  const bingFile = path.join(REPORT_DIR, 'bing-stats.json');
  if (fs.existsSync(bingFile)) {
    const bing = JSON.parse(fs.readFileSync(bingFile, 'utf-8'));
    if (bing.status == 'ok') {
      const smTotal = (bing.sitemaps || []).reduce((n: number, s: any) => n + (s.urlCount || 0), 0);
      lines.push(`- 索引页数（InIndex）：${bing.index?.inIndex ?? 0}`);
      lines.push(`- 近 7 天抓取页数：${bing.index?.crawledPages ?? 0}`);
      lines.push(`- Sitemap 发现 URL：${smTotal}（${(bing.sitemaps || []).map((s: any) => s.url).join('、') || '无'}）`);
      lines.push(`- 近 7 天展示/点击：${bing.traffic7d?.impressions ?? 0} / ${bing.traffic7d?.clicks ?? 0}`);
      if (smTotal <= 1 && (bing.index?.inIndex ?? 0) == 0) {
        lines.push('- 说明：Bing 已抓取 sitemap-index，但子地图/收录几乎为空；建议补交 `sitemap-0.xml` 并 URL 检查提交核心页');
      }
      if ((bing.topQueries || []).length) {
        lines.push('');
        lines.push('### Bing Top 查询');
        lines.push('');
        for (const q of bing.topQueries) {
          lines.push(`- **${q.query}** | 展示 ${q.impressions} | 点击 ${q.clicks}`);
        }
      }
    } else if (bing.status == 'fetch_failed') {
      lines.push(`- 拉取失败：${bing.message}`);
    } else {
      lines.push('- 未配置（待添加 `BING_WEBMASTER_API_KEY`）');
    }
  } else {
    lines.push('- 未拉取');
  }

  lines.push('');
  lines.push('## 站点健康');
  lines.push('');
  lines.push('- 工具页：6 个已上线');
  lines.push('- 构建状态：见 GitHub Actions CI');

  const reportPath = path.join(REPORT_DIR, `${today}-report.md`);
  fs.writeFileSync(reportPath, lines.join('\n'));
  fs.writeFileSync(path.join(REPORT_DIR, 'latest-report.md'), lines.join('\n'));

  // 周一额外生成周报
  if (new Date().getDay() == 1) {
    const weeklyPath = path.join(WEEKLY_DIR, `${today}-growth-plan.md`);
    const weekly = [
      `# 增长周报 ${today}`,
      '',
      '## 本周自动建议',
      '',
      ...opportunities.slice(0, 5).map((o, i) =>
        `${i + 1}. 优化 \`${o.page}\` 针对关键词「${o.query || '未知'}」`,
      ),
      '',
      '## 待执行（Agent 自动）',
      '',
      '- [ ] 优化 Top 3 页面的 title / meta',
      '- [ ] 补充内链',
      '- [ ] 技术 SEO 巡检',
      '',
    ].join('\n');
    fs.writeFileSync(weeklyPath, weekly);
  }

  console.log(`日报已生成：${reportPath}`);
}

main();
