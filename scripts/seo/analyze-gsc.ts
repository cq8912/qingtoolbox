import fs from 'fs';
import path from 'path';
import { scoreOpportunity, type GscRow } from './score-opportunities';

const REPORT_DIR = 'reports/daily';

function parseCsv(file: string): GscRow[] {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf-8').trim();
  if (text.includes('skipped,no_credentials')) return [];

  const lines = text.split('\n').slice(1);
  return lines.map((line) => {
    const parts = line.split(',');
    if (parts.length < 5) return null;
    const page = parts[0]?.replace(/^"|"$/g, '') || '';
    const query = parts.length > 5 ? parts[1]?.replace(/^"|"$/g, '') : undefined;
    const offset = parts.length > 5 ? 2 : 1;
    return {
      page,
      query,
      clicks: Number(parts[offset]),
      impressions: Number(parts[offset + 1]),
      ctr: Number(parts[offset + 2]),
      position: Number(parts[offset + 3]),
    };
  }).filter(Boolean) as GscRow[];
}

async function main() {
  const pqFile = path.join(REPORT_DIR, 'gsc-page-query.csv');
  const rows = parseCsv(pqFile);

  const scored = rows
    .map((r) => ({ ...r, score: scoreOpportunity(r) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, 'opportunities.json'),
    JSON.stringify(scored, null, 2),
  );

  console.log(`分析完成，发现 ${scored.length} 个机会`);
}

main();
