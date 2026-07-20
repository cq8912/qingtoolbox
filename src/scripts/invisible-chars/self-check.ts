import { scan, cleanText, visualizeText, previewHtml } from './detect';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 零宽空格定位
const zw = '你好\u200B世界';
const f1 = scan(zw);
assert(f1.length == 1, `期望 1 处，实际 ${f1.length}`);
assert(f1[0].marker == 'ZWSP', f1[0].marker);
assert(f1[0].index == 2, `index=${f1[0].index}`);
assert(cleanText(zw) == '你好世界', cleanText(zw));
assert(visualizeText(zw) == '你好[ZWSP]世界', visualizeText(zw));

// NBSP 清洗成普通空格
const nb = 'a\u00A0b';
assert(cleanText(nb, true) == 'a b', cleanText(nb, true));
assert(cleanText(nb, false) == 'ab', cleanText(nb, false));

// BOM + 全角空格
const mix = '\uFEFF标题\u3000内容';
const f2 = scan(mix);
assert(f2.length == 2, `期望 2，实际 ${f2.length}`);
assert(f2[0].marker == 'BOM' && f2[1].marker == 'IDSP', 'BOM/IDSP');

// 预览 HTML 含标记
const html = previewHtml('x\u200By');
assert(html.includes('[ZWSP]'), html);
assert(html.includes('ic-zero-width'), html);

// 干净文本无命中
assert(scan('正常文本 ABC\n123').length == 0, '应无命中');

console.log('PASS: invisible-chars detect OK');
