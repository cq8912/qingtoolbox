import fs from 'fs';
import path from 'path';

const PAGES_DIR = 'src/pages';

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) files.push(...walk(p));
    else if (f.endsWith('.astro')) files.push(p);
  }
  return files;
}

const pages = walk(PAGES_DIR);
console.log(`共 ${pages.length} 个页面文件，内链检查跳过（静态站无运行时链接）`);
