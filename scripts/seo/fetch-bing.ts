import fs from 'fs';
import path from 'path';

const REPORT_DIR = 'reports/daily';
const API_KEY = process.env.BING_WEBMASTER_API_KEY;
const SITE_URL = process.env.BING_SITE_URL || 'https://tools.cqzzz.top/';
const API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

type BingFeed = {
  Url?: string;
  Type?: string;
  Status?: string;
  UrlCount?: number;
  LastCrawled?: string;
};

type BingCrawl = {
  Date?: string;
  InIndex?: number;
  CrawledPages?: number;
  CrawlErrors?: number;
};

type BingTraffic = {
  Date?: string;
  Impressions?: number;
  Clicks?: number;
};

function parseBingDate(raw?: string) {
  const m = String(raw || '').match(/\/Date\((\d+)/);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : '';
}

async function bingGet<T>(method: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ apikey: API_KEY!, siteUrl: SITE_URL, ...params });
  const res = await fetch(`${API_BASE}/${method}?${qs}`);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} 非 JSON 响应`);
  }
  if (json.ErrorCode) throw new Error(json.Message || `Bing API error ${json.ErrorCode}`);
  return (json.d ?? []) as T;
}

function sumTraffic(rows: BingTraffic[], days = 7) {
  const slice = rows.slice(-days);
  return {
    impressions: slice.reduce((n, r) => n + (r.Impressions || 0), 0),
    clicks: slice.reduce((n, r) => n + (r.Clicks || 0), 0),
  };
}

function writePlaceholder(reason: string, message: string) {
  fs.writeFileSync(path.join(REPORT_DIR, 'bing-stats.json'), JSON.stringify({
    status: reason,
    message,
    siteUrl: SITE_URL,
  }, null, 2));
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  if (!API_KEY) {
    writePlaceholder('skipped', 'no_api_key');
    console.log('[skip] 未配置 BING_WEBMASTER_API_KEY');
    return;
  }

  try {
    const [feeds, crawlStats, trafficStats, queryStats, pageStats] = await Promise.all([
      bingGet<BingFeed[]>('GetFeeds'),
      bingGet<BingCrawl[]>('GetCrawlStats'),
      bingGet<BingTraffic[]>('GetRankAndTrafficStats'),
      bingGet<any[]>('GetQueryStats'),
      bingGet<any[]>('GetPageStats'),
    ]);

    const latestCrawl = crawlStats[crawlStats.length - 1] || {};
    const traffic7d = sumTraffic(trafficStats, 7);

    const stats = {
      status: 'ok',
      siteUrl: SITE_URL,
      fetchedAt: new Date().toISOString(),
      sitemaps: (feeds || []).map((f) => ({
        url: f.Url,
        type: f.Type,
        status: f.Status,
        urlCount: f.UrlCount ?? 0,
        lastCrawled: parseBingDate(f.LastCrawled),
      })),
      index: {
        inIndex: latestCrawl.InIndex ?? 0,
        crawledPages: latestCrawl.CrawledPages ?? 0,
        crawlErrors: latestCrawl.CrawlErrors ?? 0,
        date: parseBingDate(latestCrawl.Date),
      },
      traffic7d,
      topQueries: (queryStats || []).slice(0, 5).map((q) => ({
        query: q.Query,
        impressions: q.Impressions,
        clicks: q.Clicks,
      })),
      topPages: (pageStats || []).slice(0, 5).map((p) => ({
        url: p.Url,
        impressions: p.Impressions,
        clicks: p.Clicks,
      })),
    };

    fs.writeFileSync(path.join(REPORT_DIR, 'bing-stats.json'), JSON.stringify(stats, null, 2));
    console.log(`Bing 数据已导出：收录=${stats.index.inIndex} sitemap URLs=${stats.sitemaps.reduce((n, s) => n + s.urlCount, 0)} 近7天展示=${traffic7d.impressions}`);
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 200);
    console.error('[warn] Bing 拉取失败:', msg);
    writePlaceholder('fetch_failed', msg);
  }
}

main();
