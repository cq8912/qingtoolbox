import fs from 'fs';
import path from 'path';

type Opportunity = {
  page?: string;
  query?: string;
  score?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  position?: number;
};

const REPORT_DIR = 'reports/daily';
const TOOLS_FILE = 'src/data/tools.json';
const SUMMARY_FILE = path.join(REPORT_DIR, 'autopilot-summary.json');
const HISTORY_FILE = path.join(REPORT_DIR, 'autopilot-history.json');
const MAX_PAGES = Number(process.env.SEO_AUTOPILOT_MAX_PAGES || 3);
const MIN_IMPRESSIONS = Number(process.env.SEO_AUTOPILOT_MIN_IMPRESSIONS || 80);
const MAX_CTR = Number(process.env.SEO_AUTOPILOT_MAX_CTR || 0.15);
const MIN_POSITION = Number(process.env.SEO_AUTOPILOT_MIN_POSITION || 4);
const MAX_POSITION = Number(process.env.SEO_AUTOPILOT_MAX_POSITION || 20);
const COOLDOWN_DAYS = Number(process.env.SEO_AUTOPILOT_COOLDOWN_DAYS || 7);

const TOOL_TEMPLATE: Record<string, (q: string) => string> = {
  'json-viewer': (q) => `JSON 格式化校验工具，支持${q}、在线修复压缩与树形查看，浏览器本地处理。`,
  base64: (q) => `Base64 在线编码解码工具，支持${q}、中文 UTF-8 文本互转与一键复制。`,
  md5: (q) => `MD5 在线哈希计算工具，支持${q}等常见校验场景，实时生成 32 位 MD5 值。`,
  'image-merge': (q) => `图片在线拼接与标注工具，支持${q}、等宽等高合并与拖拽粘贴上传。`,
  'image-compress': (q) => `图片压缩在线工具，支持${q}、质量尺寸调节与浏览器本地处理。`,
};

const TOOL_SHORT_TEMPLATE: Record<string, (q: string) => string> = {
  'json-viewer': (q) => `格式化、校验、修复 JSON，支持${q}`,
  base64: (q) => `Base64 文本互转，支持${q}`,
  md5: (q) => `在线计算 MD5 哈希，支持${q}`,
  'image-merge': (q) => `多图拼接 + 标注，支持${q}`,
  'image-compress': (q) => `本地压缩图片，支持${q}`,
};

function normalizeQuery(input: string) {
  return input.replace(/\s+/g, '').replace(/[<>]/g, '').slice(0, 18);
}

function parseSlug(page?: string) {
  if (!page) return '';
  try {
    const url = new URL(page);
    const m = url.pathname.match(/^\/tools\/([^/]+)\/?$/);
    return m?.[1] || '';
  } catch {
    return '';
  }
}

function shouldOptimize(row: Opportunity) {
  const impressions = row.impressions || 0;
  const clicks = row.clicks || 0;
  const ctr = row.ctr || 0;
  const position = row.position || 0;
  if (impressions < MIN_IMPRESSIONS) return false;
  if (clicks < 1) return false;
  if (ctr > MAX_CTR) return false;
  if (position < MIN_POSITION || position > MAX_POSITION) return false;
  return true;
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return {} as Record<string, string>;
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as Record<string, string>;
}

function inCooldown(lastUpdated: string | undefined) {
  if (!lastUpdated) return false;
  const last = new Date(lastUpdated);
  if (Number.isNaN(last.getTime())) return false;
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  return diff < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

function pickBestBySlug(rows: Opportunity[]) {
  const best = new Map<string, Opportunity>();
  for (const row of rows) {
    const slug = parseSlug(row.page);
    if (!slug || !(slug in TOOL_TEMPLATE)) continue;
    if (!shouldOptimize(row)) continue;
    const query = normalizeQuery(row.query || '');
    if (!query || query.length < 2) continue;
    const prev = best.get(slug);
    if (!prev || (row.score || 0) > (prev.score || 0)) {
      best.set(slug, { ...row, query });
    }
  }
  return best;
}

function updateToolPage(slug: string, query: string) {
  const file = path.join('src/pages/tools', `${slug}.astro`);
  if (!fs.existsSync(file)) return false;
  const content = fs.readFileSync(file, 'utf-8');
  const nextDesc = TOOL_TEMPLATE[slug](query);
  const next = content.replace(/description="[^"]+"/, `description="${nextDesc}"`);
  if (next == content) return false;
  fs.writeFileSync(file, next);
  return true;
}

function updateToolsJson(best: Map<string, Opportunity>) {
  if (!fs.existsSync(TOOLS_FILE)) return false;
  const list = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf-8')) as Array<{ slug: string; desc: string }>;
  let changed = false;
  for (const item of list) {
    const hit = best.get(item.slug);
    if (!hit?.query || !TOOL_SHORT_TEMPLATE[item.slug]) continue;
    const nextDesc = TOOL_SHORT_TEMPLATE[item.slug](hit.query);
    if (item.desc != nextDesc) {
      item.desc = nextDesc;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(TOOLS_FILE, `${JSON.stringify(list, null, 2)}\n`);
  }
  return changed;
}

function selfCheck() {
  // ponytail: 最小自检，防止 URL 解析回归
  const slug = parseSlug('https://tools.cqzzz.top/tools/json-viewer/');
  if (slug != 'json-viewer') throw new Error('self-check failed: parseSlug');
}

async function main() {
  selfCheck();
  const oppFile = path.join(REPORT_DIR, 'opportunities.json');
  if (!fs.existsSync(oppFile)) {
    console.log('skip: opportunities.json 不存在');
    return;
  }
  const rows = JSON.parse(fs.readFileSync(oppFile, 'utf-8')) as Opportunity[];
  const allBest = pickBestBySlug(rows);
  const history = loadHistory();
  const best = new Map<string, Opportunity>();
  for (const [slug, row] of allBest) {
    if (inCooldown(history[slug])) continue;
    best.set(slug, row);
    if (best.size >= MAX_PAGES) break;
  }
  let touched = 0;
  const touchedPages: string[] = [];
  const touchedKeywords: string[] = [];
  for (const [slug, row] of best) {
    if (row.query && updateToolPage(slug, row.query)) {
      touched += 1;
      touchedPages.push(slug);
      touchedKeywords.push(row.query);
    }
  }
  if (updateToolsJson(best)) touched += 1;
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const nowIso = new Date().toISOString();
  for (const slug of touchedPages) {
    history[slug] = nowIso;
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  fs.writeFileSync(
    SUMMARY_FILE,
    JSON.stringify({
      touched,
      maxPages: MAX_PAGES,
      minImpressions: MIN_IMPRESSIONS,
      maxCtr: MAX_CTR,
      minPosition: MIN_POSITION,
      maxPosition: MAX_POSITION,
      cooldownDays: COOLDOWN_DAYS,
      pages: touchedPages,
      keywords: touchedKeywords,
      targets: best.size,
    }, null, 2),
  );
  console.log(`auto-optimize done, touched=${touched}, targets=${best.size}`);
}

main();
