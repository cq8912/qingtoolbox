import fs from 'fs';
import path from 'path';

const REPORT_DIR = 'reports/daily';
const SITE_URL = process.env.GSC_SITE_URL || 'https://tools.cqzzz.top/';
const CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// GSC API 单次最多 25000 行，ponytail: 按 startRow 分页拉全量
async function queryGsc(dimensions: string[], startDate: string, endDate: string) {
  if (!CREDENTIALS_JSON) {
    console.log('[skip] 未配置 GOOGLE_APPLICATION_CREDENTIALS_JSON，跳过 GSC 拉取');
    return [];
  }

  const { google } = await import('googleapis');
  const creds = JSON.parse(CREDENTIALS_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const rows: any[] = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow,
      },
    });

    const batch = res.data.rows || [];
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }

  return rows;
}

function toCsv(rows: any[], dimensions: string[]) {
  const header = [...dimensions, 'clicks', 'impressions', 'ctr', 'position'].join(',');
  const lines = rows.map((r) => {
    const keys = (r.keys || []).map((k: string) => `"${String(k).replace(/"/g, '""')}"`);
    return [...keys, r.clicks, r.impressions, r.ctr, r.position].join(',');
  });
  return [header, ...lines].join('\n');
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const end = new Date();
  end.setDate(end.getDate() - 2); // GSC 数据有延迟
  const start = new Date(end);
  start.setDate(start.getDate() - 28);

  const startDate = process.env.START_DATE || dateStr(start);
  const endDate = process.env.END_DATE || dateStr(end);

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  if (!CREDENTIALS_JSON) {
    // 无凭证时写占位文件，保证流水线不中断
    const placeholder = 'status,message\nskipped,no_credentials\n';
    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), placeholder);
    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), placeholder);
    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), placeholder);
    console.log('已写入占位 CSV（待配置 GSC 凭证）');
    return;
  }

  const pageRows = await queryGsc(['page'], startDate, endDate);
  const queryRows = await queryGsc(['query'], startDate, endDate);
  const pqRows = await queryGsc(['page', 'query'], startDate, endDate);

  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), toCsv(pageRows, ['page']));
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), toCsv(queryRows, ['query']));
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), toCsv(pqRows, ['page', 'query']));

  // 同步 latest 副本供 Agent 读取
  fs.copyFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), path.join(REPORT_DIR, 'latest-gsc-pages.csv'));
  fs.copyFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), path.join(REPORT_DIR, 'latest-gsc-queries.csv'));
  fs.copyFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), path.join(REPORT_DIR, 'latest-gsc-page-query.csv'));

  console.log(`GSC 数据已导出：pages=${pageRows.length} queries=${queryRows.length} page-query=${pqRows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
