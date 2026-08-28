import { describe, it, expect } from 'vitest';
import { clean } from './clean';

const onenote = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv=Content-Type content="text/html; charset=utf-8"><style>p.MsoNormal{margin:0;font-size:11pt;font-family:Calibri}</style></head><body lang=EN-US style='font-family:Calibri;font-size:11.0pt'>
<div style='direction:ltr;'>
<table border=0 cellpadding=0 cellspacing=0 style='border-collapse:collapse;width:6in'><tr><td style='padding:0'>
<p style='margin:0in;font-family:"Calibri Light";font-size:20.0pt;font-weight:bold'>Q3 Planning<o:p></o:p></p>
<p style='margin:0in;font-family:Calibri;font-size:11.0pt;background:#FFF2CC'>Owner: <span style='color:#2E75B6'>Sam</span></p>
<p class=MsoListParagraph style='margin:0in;text-indent:-.25in;mso-list:l0 level1 lfo1'><span style='font-family:Symbol'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span>Ship <b>v2 importer</b></p>
<p class=MsoListParagraph style='margin:0in;mso-list:l0 level1 lfo1'><span style='font-family:Symbol'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span><span style='color:#7F7F7F'>Review pricing</span></p>
<p style='margin:0in'>See <a href="https://example.com/doc">the doc</a>.</p>
</td></tr></table></div></body></html>`;

const gdocs = `<meta charset='utf-8'><b style="font-weight:normal;" id="docs-internal-guid-abc"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:700;">Bold title</span></p><p dir="ltr" style="line-height:1.38;"><span style="font-size:11pt;font-family:Arial;font-style:italic;">Italic body</span></p><ul style="margin-top:0;margin-bottom:0;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;"><p dir="ltr" style="line-height:1.38;"><span style="font-size:11pt;">Item one</span></p></li></ul></b>`;

const nested = `<p class=MsoListParagraph style='margin-left:.5in;mso-list:l0 level1 lfo1'><span style='font-family:Symbol'>·<span style='font:7.0pt "Times New Roman"'>&nbsp; </span></span>Parent</p>
<p class=MsoListParagraph style='margin-left:1.0in;mso-list:l0 level2 lfo1'><span style='font-family:"Courier New"'>o<span style='font:7.0pt "Times New Roman"'>&nbsp; </span></span>Child A</p>
<p class=MsoListParagraph style='margin-left:1.5in;mso-list:l0 level3 lfo1'><span style='font-family:Wingdings'>§<span style='font:7.0pt "Times New Roman"'>&nbsp; </span></span>Grandchild</p>
<p class=MsoListParagraph style='margin-left:1.0in;mso-list:l0 level2 lfo1'><span style='font-family:"Courier New"'>o<span style='font:7.0pt "Times New Roman"'>&nbsp; </span></span>Child B</p>
<p class=MsoListParagraph style='margin-left:.5in;mso-list:l1 level1 lfo2'><span style='font-family:Calibri'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp; </span></span>Numbered</p>
<p style='margin:0'>After</p>`;

describe('clean', () => {
  it('rebuilds nested and numbered Office lists', () => {
    const r = clean(nested, '');
    expect(r.html).toBe('<ul><li>Parent<ul><li>Child A<ul><li>Grandchild</li></ul></li><li>Child B</li></ul></li></ul><ol><li>Numbered</li></ol><p>After</p>');
    expect(r.markdown).toBe('- Parent\n  - Child A\n    - Grandchild\n  - Child B\n\n1. Numbered\n\nAfter');
    expect(r.text).toBe('- Parent\n  - Child A\n    - Grandchild\n  - Child B\n\n1. Numbered\n\nAfter');
  });

  it('strips OneNote markup but keeps structure', () => {
    const r = clean(onenote, '');
    expect(r.html).not.toMatch(/style=|class=|<o:p|<table|Calibri/);
    expect(r.html).toContain('<strong>Q3 Planning</strong>');
    expect(r.html).toContain('<p>Owner: Sam</p>');
    expect(r.html).toContain('<ul><li>Ship <strong>v2 importer</strong></li><li>Review pricing</li></ul>');
    expect(r.html).toContain('<a href="https://example.com/doc">the doc</a>');
    expect(r.stats.stylesRemoved).toBeGreaterThan(5);
  });

  it('produces plain text with list markers', () => {
    const r = clean(onenote, '');
    expect(r.text).toBe('Q3 Planning\n\nOwner: Sam\n\n- Ship v2 importer\n- Review pricing\n\nSee the doc.');
  });

  it('produces markdown', () => {
    const r = clean(onenote, '');
    expect(r.markdown).toContain('**Q3 Planning**');
    expect(r.markdown).toContain('- Ship **v2 importer**');
    expect(r.markdown).toContain('[the doc](https://example.com/doc)');
  });

  it('converts Google Docs inline weight/style to tags', () => {
    const r = clean(gdocs, '');
    expect(r.html).toContain('<p><strong>Bold title</strong></p>');
    expect(r.html).toContain('<p><em>Italic body</em></p>');
    expect(r.html).toContain('<ul><li>Item one</li></ul>');
  });

  it('drops unsafe content and non-http links', () => {
    const r = clean(`<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <img src="x.png"><script>alert(1)</script></p>`, '');
    expect(r.html).toBe('<p>Hi bad</p>');
  });

  it('falls back to plain text input', () => {
    const r = clean('', 'line one\nline two\n\npara two');
    expect(r.html).toBe('<p>line one<br>line two</p><p>para two</p>');
    expect(r.text).toBe('line one\nline two\n\npara two');
  });

  it('fixes lists nested directly inside lists', () => {
    const r = clean('<ul><li>Parent</li><ul><li>Child</li><ul><li>Grandchild</li></ul></ul><li>Sibling</li></ul>', '');
    expect(r.html).toBe('<ul><li>Parent<ul><li>Child<ul><li>Grandchild</li></ul></li></ul></li><li>Sibling</li></ul>');
    expect(r.markdown).toBe('- Parent\n  - Child\n    - Grandchild\n- Sibling');
    expect(r.text).toBe('- Parent\n  - Child\n    - Grandchild\n- Sibling');
  });

  it('emits Jira wiki markup', () => {
    const r = clean('<h2>Title</h2><p>Hi <strong>bold</strong> <a href="https://x.io">link</a></p><ul><li>Parent<ul><li>Child</li></ul></li><li>Sib</li></ul><ol><li>One</li></ol><table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>', '');
    expect(r.jira).toBe('h2. Title\n\nHi *bold* [link|https://x.io]\n\n* Parent\n** Child\n* Sib\n\n# One\n\n||a||b||\n|1|2|');
  });

  it('renders tables as markdown tables', () => {
    const r = clean('<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>', '');
    expect(r.markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(r.text).toBe('a\tb\n1\t2');
  });
});
