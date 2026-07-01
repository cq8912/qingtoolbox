import fs from 'fs';
import path from 'path';

const REPORT_DIR = 'reports/daily';
const TOOLS_FILE = 'src/data/tools.json';
const CACHE_DAYS = 7;

type Tool = { slug: string; name: string; desc: string };

const FETCH_TIMEOUT = 8000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) return '';
  return res.text();
}

async function fetchGoogleSuggest(q: string) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=psy&q=${encodeURIComponent(q)}`;
  const text = await fetchText(url);
  if (!text) return [];
  const data = JSON.parse(text);
  return ((data[1] as string[]) || []).slice(0, 8);
}

async function fetchBingSuggest(q: string) {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`;
  const text = await fetchText(url);
  if (!text) return [];
  const data = JSON.parse(text);
  return ((data[1] as string[]) || []).slice(0, 8);
}

async function fetchBaiduSuggest(q: string) {
  const url = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(q)}&cb=_`;
  const text = await fetchText(url);
  if (!text) return [];
  const m = text.match(/\{.*\}/);
  if (!m) return [];
  try {
    return ((JSON.parse(m[0]).s as string[]) || []).slice(0, 8);
  } catch {
    return [];
  }
}

function seedQuery(tool: Tool) {
  // 中文工具站常见搜索意图
  if (tool.name.match(/[a-zA-Z0-9]/)) return `${tool.name} 在线`;
  return `${tool.name} 在线工具`;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outFile = path.join(REPORT_DIR, 'keyword-hints.json');

  if (!process.env.FORCE_KEYWORD_HINTS && fs.existsSync(outFile)) {
    const age = Date.now() - fs.statSync(outFile).mtimeMs;
    if (age < CACHE_DAYS * 86400000) {
      console.log(`keyword-hints 缓存有效（${CACHE_DAYS} 天内），跳过拉取`);
      return;
    }
  }

  const tools: Tool[] = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf-8'));
  const hints: any[] = [];
  const allSuggestions = new Map<string, number>();

  for (const tool of tools) {
    const seed = seedQuery(tool);
    const [google, bing, baidu] = await Promise.all([
      fetchGoogleSuggest(seed).catch(() => []),
      fetchBingSuggest(seed).catch(() => []),
      fetchBaiduSuggest(seed).catch(() => []),
    ]);

    for (const s of [...google, ...bing, ...baidu]) {
      if (!s || s == seed) continue;
      allSuggestions.set(s, (allSuggestions.get(s) || 0) + 1);
    }

    hints.push({ slug: tool.slug, name: tool.name, seed, google, bing, baidu });
    // ponytail: 简单限速，避免 Actions 里短时间打爆联想接口
    await sleep(400);
  }

  const topSuggestions = [...allSuggestions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([q, hits]) => ({ query: q, hits }));

  const result = {
    generatedAt: new Date().toISOString(),
    tools: hints.length,
    topSuggestions,
    hints,
  };

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`关键词灵感已生成：${topSuggestions.length} 条热门联想（${tools.length} 个工具）`);
}

main();
