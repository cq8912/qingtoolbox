import fs from 'fs';
import path from 'path';

const REPORT_DIR = 'reports/daily';
const SITE_URL = process.env.GSC_SITE_URL || 'https://tools.cqzzz.top/';
const CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

function writePlaceholder(reason: string, message: string) {
  const placeholder = `status,message\n${reason},${message}\n`;
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), placeholder);
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), placeholder);
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), placeholder);
}

// ponytail: 仅重试常见瞬时网络错误，鉴权/权限类错误直接抛出
function isRetryableError(err: unknown) {
  const e = err as { code?: string; message?: string; error?: { code?: string } };
  const code = e?.code || e?.error?.code || '';
  const msg = String(e?.message || err);
  return (
    code == 'ERR_STREAM_PREMATURE_CLOSE' ||
    code == 'ECONNRESET' ||
    code == 'ETIMEDOUT' ||
    code == 'ENOTFOUND' ||
    msg.includes('Premature close') ||
    msg.includes('socket hang up')
  );
}

async function withRetry<T>(fn: () => Promise<T>, label: string, max = 4) {
  let lastErr: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || i == max - 1) throw err;
      const delay = 2000 * Math.pow(2, i);
      console.warn(`[retry ${i + 1}/${max - 1}] ${label} 失败，${delay}ms 后重试`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function parseCredentials(raw: string) {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  return JSON.parse(cleaned);
}

// GSC API 单次最多 25000 行，ponytail: 按 startRow 分页拉全量
async function queryGsc(dimensions: string[], startDate: string, endDate: string) {
  if (!CREDENTIALS_JSON) {
    console.log('[skip] 未配置 GOOGLE_APPLICATION_CREDENTIALS_JSON，跳过 GSC 拉取');
    return [];
  }

  const { google } = await import('googleapis');
  const creds = parseCredentials(CREDENTIALS_JSON);
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
    writePlaceholder('skipped', 'no_credentials');
    console.log('已写入占位 CSV（待配置 GSC 凭证）');
    return;
  }

  try {
    const pageRows = await withRetry(() => queryGsc(['page'], startDate, endDate), 'pages');
    const queryRows = await withRetry(() => queryGsc(['query'], startDate, endDate), 'queries');
    const pqRows = await withRetry(() => queryGsc(['page', 'query'], startDate, endDate), 'page-query');

    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), toCsv(pageRows, ['page']));
    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), toCsv(queryRows, ['query']));
    fs.writeFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), toCsv(pqRows, ['page', 'query']));

    // 同步 latest 副本供 Agent 读取
    fs.copyFileSync(path.join(REPORT_DIR, 'gsc-pages.csv'), path.join(REPORT_DIR, 'latest-gsc-pages.csv'));
    fs.copyFileSync(path.join(REPORT_DIR, 'gsc-queries.csv'), path.join(REPORT_DIR, 'latest-gsc-queries.csv'));
    fs.copyFileSync(path.join(REPORT_DIR, 'gsc-page-query.csv'), path.join(REPORT_DIR, 'latest-gsc-page-query.csv'));

    console.log(`GSC 数据已导出：pages=${pageRows.length} queries=${queryRows.length} page-query=${pqRows.length}（${startDate} ~ ${endDate}）`);
    if (pageRows.length == 0) {
      console.warn('[warn] GSC 返回 0 条记录：站点可能尚无搜索曝光，或 GSC 资源 URL 与 Secret 不一致');
    }
  } catch (err) {
    // 拉取失败不阻断日报，写占位后正常退出
    const msg = String((err as Error)?.message || err).replace(/[\r\n,]/g, ' ').slice(0, 200);
    console.error('[warn] GSC 拉取失败，写入占位文件继续日报:', msg);
    writePlaceholder('fetch_failed', msg);
  }
}

main();
