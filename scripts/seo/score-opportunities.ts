export type GscRow = {
  page: string;
  query?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export function scoreOpportunity(row: GscRow) {
  let score = 0;

  // 高曝光低 CTR：改标题/meta
  if (row.impressions > 500 && row.ctr < 0.01) score += 30;
  else if (row.impressions >= 20 && row.ctr < 0.02) score += 15;
  // 排名可优化区间
  if (row.position >= 8 && row.position <= 20) score += 30;
  else if (row.position >= 5 && row.position < 8) score += 20;
  else if (row.position > 20 && row.position <= 40) score += 10;
  // 排名 4-7：冲一下
  if (row.position >= 4 && row.position < 8) score += 15;
  // 有曝光无点击
  if (row.impressions > 300 && row.clicks == 0) score += 20;
  else if (row.impressions >= 10 && row.clicks == 0) score += 10;
  // 数据太少不值得花时间
  if (row.impressions < 5) score -= 20;

  return score;
}

// ponytail: 最小自检
if (import.meta.url == `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const r = scoreOpportunity({ page: '/test', clicks: 0, impressions: 600, ctr: 0.005, position: 12 });
  console.assert(r >= 50, 'score sanity check failed');
}
