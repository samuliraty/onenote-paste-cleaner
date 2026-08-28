import DOMPurify from 'dompurify';
import TurndownService from 'turndown';

export type Mode = 'rich' | 'plain' | 'markdown';

export interface CleanResult {
  html: string;
  text: string;
  markdown: string;
  stats: { stylesRemoved: number; fontsRemoved: number; colorsRemoved: number; chars: number };
}

const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'a', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'div', 'span', 'sup', 'sub',
];
const ALLOWED_ATTR = ['href', 'colspan', 'rowspan'];

const BLOCKS = new Set(['P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TABLE']);

function countStats(raw: string) {
  const styles = (raw.match(/\sstyle=/gi) || []).length + (raw.match(/\sclass=/gi) || []).length;
  const fonts = new Set([...raw.matchAll(/font-family:\s*([^;"']+)/gi)].map((m) => m[1].trim().toLowerCase()));
  const colors = new Set([...raw.matchAll(/(?:^|[;\s"'])(?:background-)?color:\s*([^;"']+)/gi)].map((m) => m[1].trim().toLowerCase()));
  return { stylesRemoved: styles, fontsRemoved: fonts.size, colorsRemoved: colors.size };
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function normalize(root: HTMLElement) {
  root.querySelectorAll('o\\:p, meta, link, style, script, img, svg, input, button').forEach((n) => n.remove());

  root.querySelectorAll('b').forEach((b) => { if (/^(normal|[1-5]00)$/.test((b as HTMLElement).style.fontWeight)) unwrap(b); });

  root.querySelectorAll('[style]').forEach((el) => {
    const s = (el as HTMLElement).style;
    const bold = /^(bold|[6-9]00)$/.test(s.fontWeight);
    const italic = s.fontStyle === 'italic';
    const deco = s.textDecoration || s.textDecorationLine || '';
    const underline = /underline/.test(deco);
    const strike = /line-through/.test(deco);
    if (!(bold || italic || underline || strike)) return;
    if (!['SPAN', 'DIV', 'P', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A'].includes(el.tagName)) return;
    const doc = el.ownerDocument;
    let inner: Element = el;
    const wrapWith = (tag: string) => {
      const w = doc.createElement(tag);
      while (inner.firstChild) w.appendChild(inner.firstChild);
      inner.appendChild(w);
      inner = w;
    };
    if (bold && !el.closest('strong, b, h1, h2, h3, h4, h5, h6')) wrapWith('strong');
    if (italic && !el.closest('em, i')) wrapWith('em');
    if (underline && !el.closest('u')) wrapWith('u');
    if (strike && !el.closest('s')) wrapWith('s');
  });

  root.querySelectorAll('b').forEach((b) => { const s = b.ownerDocument.createElement('strong'); while (b.firstChild) s.appendChild(b.firstChild); b.replaceWith(s); });
  root.querySelectorAll('i').forEach((i) => { const e = i.ownerDocument.createElement('em'); while (i.firstChild) e.appendChild(i.firstChild); i.replaceWith(e); });
  root.querySelectorAll('font').forEach(unwrap);

  root.querySelectorAll('p').forEach((p) => {
    const style = p.getAttribute('style') || '';
    if (!/MsoListParagraph/i.test(p.getAttribute('class') || '') && !/mso-list:/i.test(style)) return;
    const li = p.ownerDocument.createElement('li');
    const levelMatch = style.match(/mso-list:[^;]*level(\d+)/i);
    const margin = parseFloat((p as HTMLElement).style.marginLeft || '0');
    const unit = ((p as HTMLElement).style.marginLeft || '').replace(/[\d.\-]/g, '');
    const marginIn = unit === 'in' ? margin : unit === 'pt' ? margin / 72 : unit === 'px' ? margin / 96 : unit === 'cm' ? margin / 2.54 : 0;
    li.dataset.level = String(levelMatch ? Number(levelMatch[1]) : Math.max(1, Math.round(marginIn * 2)));
    while (p.firstChild) li.appendChild(p.firstChild);
    p.replaceWith(li);
    li.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]').forEach((n) => n.remove());
    li.querySelectorAll('span').forEach((sp) => {
      const ff = (sp as HTMLElement).style.fontFamily || '';
      if (/symbol|wingdings|courier new|times new roman/i.test(ff) && /^[\s\u00a0·•o§●■\-\d.)a-z]*$/i.test(sp.textContent || '')) sp.remove();
    });
    const first = li.ownerDocument.createTreeWalker(li, 4).nextNode();
    if (first) {
      const m = first.textContent!.match(/^[\s\u00a0]*(?:([·•o§●■\-])|(\d+[.)]|[a-zA-Z][.)]))?[\s\u00a0]*/);
      if (m && m[2]) li.dataset.ordered = '1';
      first.textContent = first.textContent!.replace(/^[\s\u00a0]*(?:[·•o§●■\-]|\d+[.)]|[a-zA-Z][.)])?[\s\u00a0]*/, '');
    }
  });
  const parents = new Set<Node>();
  root.querySelectorAll('li[data-level]').forEach((li) => { if (li.parentElement && !['UL', 'OL'].includes(li.parentElement.tagName)) parents.add(li.parentElement); });
  parents.forEach((parent) => {
    let run: HTMLLIElement[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const doc = run[0].ownerDocument;
      const anchor = doc.createComment('');
      run[0].before(anchor);
      const stack: { list: HTMLElement; level: number }[] = [];
      run.forEach((li) => {
        const level = Number(li.dataset.level);
        const tag = li.dataset.ordered ? 'ol' : 'ul';
        while (stack.length && (stack[stack.length - 1].level > level || (stack[stack.length - 1].level === level && stack[stack.length - 1].list.tagName.toLowerCase() !== tag))) stack.pop();
        if (!stack.length || stack[stack.length - 1].level < level) {
          const list = doc.createElement(tag);
          if (!stack.length) anchor.before(list);
          else {
            const parentLi = stack[stack.length - 1].list.lastElementChild || stack[stack.length - 1].list;
            parentLi.appendChild(list);
          }
          stack.push({ list, level });
        }
        stack[stack.length - 1].list.appendChild(li);
      });
      anchor.remove();
      run = [];
    };
    Array.from(parent.childNodes).forEach((n) => {
      if (n.nodeName === 'LI') run.push(n as HTMLLIElement);
      else if (n.nodeType === 3 && !n.textContent?.trim()) return;
      else flush();
    });
    flush();
  });

  root.querySelectorAll('table').forEach((t) => {
    const rows = t.querySelectorAll('tr');
    const cells = t.querySelectorAll('td, th');
    if (rows.length === 1 && cells.length === 1) { while (cells[0].firstChild) t.before(cells[0].firstChild); t.remove(); }
  });
  root.querySelectorAll('thead, tbody, tfoot').forEach((el) => { if (el.children.length === 0) el.remove(); });
}

function stripAttributes(root: HTMLElement) {
  root.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      if (!ALLOWED_ATTR.includes(a.name)) el.removeAttribute(a.name);
    });
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (!/^(https?:|mailto:|tel:)/i.test(href)) unwrap(el);
    }
  });
}

function collapse(root: HTMLElement) {
  root.querySelectorAll('strong, em, u, s, a').forEach((el) => {
    if (el.querySelector('p, div, ul, ol, li, table, h1, h2, h3, h4, h5, h6, blockquote')) unwrap(el);
  });
  root.querySelectorAll('span, div').forEach((el) => {
    if (el.parentElement) unwrap(el);
  });
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll('p, li, strong, em, u, s, h1, h2, h3, h4, h5, h6, blockquote').forEach((el) => {
      if (!el.textContent?.trim() && !el.querySelector('br')) { el.remove(); changed = true; }
    });
  }
  root.querySelectorAll('td, th').forEach((cell) => {
    if (cell.children.length === 1 && cell.firstElementChild!.tagName === 'P') unwrap(cell.firstElementChild!);
  });
  root.querySelectorAll('li').forEach((li) => {
    if (li.children.length === 1 && li.firstElementChild!.tagName === 'P') unwrap(li.firstElementChild!);
  });
}

function pruneWhitespace(root: HTMLElement) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const doomed: Node[] = [];
  const isBlock = (n: Node | null) => !!n && n.nodeType === 1 && (BLOCKS.has((n as Element).tagName) || ['UL', 'OL', 'HR', 'TBODY', 'THEAD', 'TR', 'TD', 'TH'].includes((n as Element).tagName));
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent?.trim()) continue;
    const parent = n.parentElement;
    if (parent === root || ['UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TR'].includes(parent?.tagName || '') || isBlock(n.previousSibling) || isBlock(n.nextSibling) || !n.previousSibling || !n.nextSibling) doomed.push(n);
  }
  doomed.forEach((n) => n.parentNode?.removeChild(n));
}

function wrapLooseText(root: HTMLElement) {
  const doc = root.ownerDocument;
  let p: HTMLParagraphElement | null = null;
  Array.from(root.childNodes).forEach((n) => {
    const isBlock = n.nodeType === 1 && (BLOCKS.has((n as Element).tagName) || ['UL', 'OL', 'HR', 'TBODY', 'THEAD', 'TR', 'TD', 'TH'].includes((n as Element).tagName));
    if (isBlock) { p = null; return; }
    if (n.nodeType === 3 && !n.textContent?.trim() && !p) return;
    if (!p) { p = doc.createElement('p'); root.insertBefore(p, n); }
    p.appendChild(n);
  });
}

function toText(root: HTMLElement): string {
  const out: string[] = [];
  const walk = (n: Node, prefix = '') => {
    if (n.nodeType === 3) { out.push(n.textContent!.replace(/\s+/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName;
    if (tag === 'BR') { out.push('\n'); return; }
    if (tag === 'LI') {
      const parent = el.parentElement;
      const idx = parent ? Array.from(parent.children).indexOf(el) + 1 : 1;
      out.push(prefix + (parent?.tagName === 'OL' ? `${idx}. ` : '- '));
      el.childNodes.forEach((c) => walk(c, prefix + '  '));
      out.push('\n');
      return;
    }
    if (tag === 'UL' || tag === 'OL') { el.childNodes.forEach((c) => walk(c, prefix)); out.push('\n'); return; }
    if (tag === 'TR') {
      out.push(Array.from(el.children).map((c) => c.textContent!.trim()).join('\t') + '\n');
      return;
    }
    if (BLOCKS.has(tag)) { el.childNodes.forEach((c) => walk(c, prefix)); out.push('\n\n'); return; }
    el.childNodes.forEach((c) => walk(c, prefix));
  };
  root.childNodes.forEach((c) => walk(c));
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
}

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
turndown.addRule('table', {
  filter: 'table',
  replacement(_content, node) {
    const rows = Array.from((node as HTMLElement).querySelectorAll('tr')).map((tr) =>
      Array.from(tr.children).map((c) => c.textContent!.trim().replace(/\|/g, '\\|')),
    );
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => '| ' + Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ') + ' |';
    return '\n\n' + line(rows[0]) + '\n| ' + Array(width).fill('---').join(' | ') + ' |\n' + rows.slice(1).map(line).join('\n') + '\n\n';
  },
});

export function clean(rawHtml: string, rawText: string): CleanResult {
  const stats = countStats(rawHtml);
  if (!rawHtml.trim()) {
    const text = rawText.trim();
    const html = text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    return { html, text, markdown: text, stats: { ...stats, chars: text.length } };
  }
  const sanitized = DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: [...ALLOWED_TAGS, 'font', 'o:p'], ALLOWED_ATTR: [...ALLOWED_ATTR, 'style', 'class'], WHOLE_DOCUMENT: false });
  const root = document.createElement('div');
  root.innerHTML = sanitized;
  normalize(root);
  stripAttributes(root);
  collapse(root);
  pruneWhitespace(root);
  wrapLooseText(root);
  const html = root.innerHTML.replace(/ /g, ' ').replace(/>\s+</g, '><').trim();
  const text = toText(root);
  const markdown = turndown.turndown(html).replace(/^( *)([-*]|\d+\.)[ \t]{2,}/gm, (_m, sp: string, mk: string) => ' '.repeat(sp.length / 2) + mk + ' ').trim();
  return { html, text, markdown, stats: { ...stats, chars: text.length } };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function copyResult(result: CleanResult, mode: Mode): Promise<void> {
  if (mode === 'rich' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'text/html': new Blob([result.html], { type: 'text/html' }),
      'text/plain': new Blob([result.text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(mode === 'markdown' ? result.markdown : result.text);
}
