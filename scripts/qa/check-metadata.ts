import fs from 'fs';
import path from 'path';

// 检查 dist 内 HTML 是否有 title
const DIST = 'dist';

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) files.push(...walk(p));
    else if (p.endsWith('.html')) files.push(p);
  }
  return files;
}

const htmlFiles = walk(DIST);
let missing = 0;

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf-8');
  if (!html.includes('<title>')) {
    console.log(`缺少 title: ${f}`);
    missing++;
  }
}

if (missing > 0) {
  console.error(`共 ${missing} 个页面缺少 title`);
  process.exit(1);
}

console.log(`metadata 检查通过：${htmlFiles.length} 个页面`);
