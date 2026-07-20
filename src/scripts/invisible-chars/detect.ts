/** 不可见 / 异常字符检测（纯本地） */

export type CharCategory = 'zero-width' | 'control' | 'space' | 'bidi' | 'format';

export type Finding = {
  index: number;
  char: string;
  code: number;
  hex: string;
  label: string;
  marker: string;
  category: CharCategory;
  line: number;
  col: number;
};

type CharInfo = { label: string; marker: string; category: CharCategory };

// 常见「看不见却捣乱」的字符
const KNOWN: Record<number, CharInfo> = {
  0x00a0: { label: '不换行空格', marker: 'NBSP', category: 'space' },
  0x00ad: { label: '软连字符', marker: 'SHY', category: 'format' },
  0x034f: { label: '组合字形连接符', marker: 'CGJ', category: 'format' },
  0x061c: { label: '阿拉伯字母标记', marker: 'ALM', category: 'bidi' },
  0x115f: { label: '谚文字母填充', marker: 'HCF', category: 'format' },
  0x1160: { label: '谚文拼音填充', marker: 'HJF', category: 'format' },
  0x17b4: { label: '高棉元音固有 AQ', marker: 'KVAQ', category: 'format' },
  0x17b5: { label: '高棉元音固有 AA', marker: 'KVAA', category: 'format' },
  0x180e: { label: '蒙古文元音分隔符', marker: 'MVS', category: 'format' },
  0x2000: { label: 'En 空格（四分）', marker: 'NQSP', category: 'space' },
  0x2001: { label: 'Em 空格（正方）', marker: 'MQSP', category: 'space' },
  0x2002: { label: 'En 空格', marker: 'ENSP', category: 'space' },
  0x2003: { label: 'Em 空格', marker: 'EMSP', category: 'space' },
  0x2004: { label: '三分空格', marker: '3/MSP', category: 'space' },
  0x2005: { label: '四分空格', marker: '4/MSP', category: 'space' },
  0x2006: { label: '六分空格', marker: '6/MSP', category: 'space' },
  0x2007: { label: '数字空格', marker: 'FSP', category: 'space' },
  0x2008: { label: '标点空格', marker: 'PSP', category: 'space' },
  0x2009: { label: '薄空格', marker: 'THSP', category: 'space' },
  0x200a: { label: '头发空格', marker: 'HSP', category: 'space' },
  0x200b: { label: '零宽空格', marker: 'ZWSP', category: 'zero-width' },
  0x200c: { label: '零宽不连字', marker: 'ZWNJ', category: 'zero-width' },
  0x200d: { label: '零宽连字', marker: 'ZWJ', category: 'zero-width' },
  0x200e: { label: '左到右标记', marker: 'LRM', category: 'bidi' },
  0x200f: { label: '右到左标记', marker: 'RLM', category: 'bidi' },
  0x2028: { label: '行分隔符', marker: 'LS', category: 'control' },
  0x2029: { label: '段分隔符', marker: 'PS', category: 'control' },
  0x202a: { label: '左到右嵌入', marker: 'LRE', category: 'bidi' },
  0x202b: { label: '右到左嵌入', marker: 'RLE', category: 'bidi' },
  0x202c: { label: '弹出方向格式', marker: 'PDF', category: 'bidi' },
  0x202d: { label: '左到右强制', marker: 'LRO', category: 'bidi' },
  0x202e: { label: '右到左强制', marker: 'RLO', category: 'bidi' },
  0x202f: { label: '窄不换行空格', marker: 'NNBSP', category: 'space' },
  0x205f: { label: '中等数学空格', marker: 'MMSP', category: 'space' },
  0x2060: { label: '词连接符', marker: 'WJ', category: 'zero-width' },
  0x2061: { label: '函数应用', marker: 'FA', category: 'format' },
  0x2062: { label: '不可见乘号', marker: 'IT', category: 'format' },
  0x2063: { label: '不可见分隔符', marker: 'IS', category: 'format' },
  0x2064: { label: '不可见加号', marker: 'IP', category: 'format' },
  0x2066: { label: '左到右隔离', marker: 'LRI', category: 'bidi' },
  0x2067: { label: '右到左隔离', marker: 'RLI', category: 'bidi' },
  0x2068: { label: '首强隔离', marker: 'FSI', category: 'bidi' },
  0x2069: { label: '弹出隔离', marker: 'PDI', category: 'bidi' },
  0x3000: { label: '全角空格', marker: 'IDSP', category: 'space' },
  0x3164: { label: '谚文填充符', marker: 'HF', category: 'format' },
  0xfeff: { label: 'BOM / 零宽不换行', marker: 'BOM', category: 'zero-width' },
  0xffa0: { label: '半角谚文填充', marker: 'HWHF', category: 'format' },
  0xfff9: { label: '行间注解锚点', marker: 'IAA', category: 'format' },
  0xfffa: { label: '行间注解分隔', marker: 'IAS', category: 'format' },
  0xfffb: { label: '行间注解终止', marker: 'IAT', category: 'format' },
};

const CATEGORY_LABEL: Record<CharCategory, string> = {
  'zero-width': '零宽',
  control: '控制符',
  space: '特殊空白',
  bidi: '双向控制',
  format: '格式符',
};

export function categoryLabel(c: CharCategory) {
  return CATEGORY_LABEL[c];
}

function toHex(code: number) {
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
}

function lookup(code: number): CharInfo | null {
  if (KNOWN[code]) return KNOWN[code];

  // C0 控制符（保留常见空白：TAB/LF/CR）
  if (code <= 0x1f && code != 0x09 && code != 0x0a && code != 0x0d) {
    return { label: 'C0 控制符', marker: 'C0', category: 'control' };
  }
  if (code == 0x7f || (code >= 0x80 && code <= 0x9f)) {
    return { label: 'C1 / DEL 控制符', marker: 'C1', category: 'control' };
  }
  // 标签字符等少见格式区
  if (code >= 0xe0001 && code <= 0xe007f) {
    return { label: '标签字符', marker: 'TAG', category: 'format' };
  }
  if (code >= 0xe0100 && code <= 0xe01ef) {
    return { label: '变体选择符', marker: 'VS', category: 'format' };
  }
  return null;
}

function lineColAt(text: string, index: number) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] == '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/** 扫描文本，返回所有可疑字符 */
export function scan(text: string): Finding[] {
  const out: Finding[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // 跳过代理对高位，按完整码点处理
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        const cp = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        const info = lookup(cp);
        if (info) {
          const { line, col } = lineColAt(text, i);
          out.push({
            index: i,
            char: text.slice(i, i + 2),
            code: cp,
            hex: toHex(cp),
            label: info.label,
            marker: info.marker,
            category: info.category,
            line,
            col,
          });
        }
        i++;
        continue;
      }
    }
    const info = lookup(code);
    if (!info) continue;
    const { line, col } = lineColAt(text, i);
    out.push({
      index: i,
      char: text[i],
      code,
      hex: toHex(code),
      label: info.label,
      marker: info.marker,
      category: info.category,
      line,
      col,
    });
  }
  return out;
}

/** 清除所有可疑字符；特殊空白可替换成普通空格 */
export function cleanText(text: string, spaceToNormal = true) {
  const findings = scan(text);
  if (!findings.length) return text;
  let out = '';
  let cursor = 0;
  for (const f of findings) {
    out += text.slice(cursor, f.index);
    if (spaceToNormal && f.category == 'space') out += ' ';
    cursor = f.index + f.char.length;
  }
  out += text.slice(cursor);
  return out;
}

/** 把可疑字符换成 [MARKER] 可视化文本 */
export function visualizeText(text: string) {
  const findings = scan(text);
  if (!findings.length) return text;
  let out = '';
  let cursor = 0;
  for (const f of findings) {
    out += text.slice(cursor, f.index);
    out += `[${f.marker}]`;
    cursor = f.index + f.char.length;
  }
  out += text.slice(cursor);
  return out;
}

export function escHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** 高亮预览 HTML（可疑字符显示为标记） */
export function previewHtml(text: string) {
  const findings = scan(text);
  if (!text) return '<span class="ic-empty">粘贴文本后这里会高亮显示可疑字符</span>';
  if (!findings.length) return `<span class="ic-ok">${escHtml(text)}</span>`;

  let html = '';
  let cursor = 0;
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    if (f.index > cursor) html += escHtml(text.slice(cursor, f.index));
    html += `<mark class="ic-mark ic-${f.category}" data-idx="${i}" title="${escHtml(f.label)} ${f.hex}">[${escHtml(f.marker)}]</mark>`;
    cursor = f.index + f.char.length;
  }
  if (cursor < text.length) html += escHtml(text.slice(cursor));
  return html;
}

export function countByCategory(findings: Finding[]) {
  const map: Record<CharCategory, number> = {
    'zero-width': 0,
    control: 0,
    space: 0,
    bidi: 0,
    format: 0,
  };
  for (const f of findings) map[f.category]++;
  return map;
}
