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

  const hasGsc = fs.existsSync(path.join(REPORT_DIR, 'gsc-pages.csv')) &&
    !fs.readFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), 'utf-8').includes('no_credentials');

  if (hasGsc) {
    lines.push('- GSC 数据：已拉取');
    lines.push(`- 机会数量：${opportunities.length}`);
    lines.push('');
    lines.push('## Top 10 机会');
    lines.push('');
    for (const o of opportunities.slice(0, 10)) {
      lines.push(`- **${o.query || o.page}** | 曝光 ${o.impressions} | 排名 ${o.position?.toFixed(1)} | 分数 ${o.score}`);
    }
  } else {
    lines.push('- GSC 数据：未配置（待添加 `GOOGLE_APPLICATION_CREDENTIALS_JSON`）');
    lines.push('');
    lines.push('## 冷启动建议');
    lines.push('');
    lines.push('- 提交 sitemap 到 Google Search Console');
    lines.push('- 在知乎/V2EX 等分享实用工具页');
    lines.push('- 每周新增 1 个工具或优化 1 个页面 title');
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
