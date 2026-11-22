import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import { rankRoles } from './ranking.mjs';
import { chromium } from 'playwright-core';

const source = 'https://layoffsandhires.com/jobs?r=IN&roles=tech';
async function resumeText(file) {
  switch (extname(file).toLowerCase()) {
    case '.txt': return readFile(file, 'utf8');
    case '.docx': {
      const { default: mammoth } = await import('mammoth');
      return (await mammoth.extractRawText({ path: file })).value;
    }
    case '.pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: await readFile(file) });
      try { return (await parser.getText()).text; }
      finally { await parser.destroy(); }
    }
    default: throw new Error('Supply a PDF, DOCX or TXT resume.');
  }
}

async function collect(page) {
  const cards = page.locator('li.job:visible');
  await page.waitForFunction(() => document.querySelector('li.job') &&
    ![...document.querySelectorAll('li.job')].every(el => el.closest('[aria-busy="true"]')), { }, { timeout: 25000 })
    .catch(() => {}); // Empty result pages also reach this point.
  const seen = new Map();
  for (let batch = 0; batch < 50; batch++) {
    const rows = await cards.evaluateAll(nodes => nodes.map(el => ({
      id: el.getAttribute('data-view'),
      title: el.querySelector('.job-title')?.textContent?.trim(),
      company: el.querySelector('.job-co')?.textContent?.trim(),
      location: el.querySelector('[data-country]')?.textContent?.trim(),
      url: el.querySelector('a.job-apply[href]')?.href ?? null
    })));
    const before = seen.size;
    for (const row of rows) {
      if (row.company && row.title) seen.set(row.id || JSON.stringify(row), row);
    }
    if (seen.size === before) break;
    const more = page.getByRole('button', { name: /^(show more(?: jobs)?|load more(?: jobs)?|next(?: page)?)$/i }).first();
    if (batch === 49 || !(await more.isVisible()) || !(await more.isEnabled())) break;
    const signature = await cards.allTextContents();
    await more.click();
    await page.waitForFunction(old => JSON.stringify([...document.querySelectorAll('li.job')]
      .filter(el => el.getClientRects().length).map(el => el.textContent)) !== JSON.stringify(old), signature,
      { timeout: 12000 }).catch(() => {});
  }
  return [...seen.values()];
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run match -- "path/to/resume.pdf" [--login]');
  const profile = await resumeText(file);
  if (profile.trim().split(/\s+/).length < 5) throw new Error('Too little readable resume text. Supply a text-based PDF, DOCX or TXT.');
  const login = process.argv.includes('--login');
  const context = await chromium.launchPersistentContext(join(process.env.LOCALAPPDATA || homedir(), 'JobMatcher', 'EdgeProfile'), { channel: 'msedge', headless: !login });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    try { await page.goto(source, { waitUntil: 'domcontentloaded' }); }
    catch (error) {
      if (!error.message.includes('ERR_NETWORK_CHANGED')) throw error;
      await page.goto(source, { waitUntil: 'domcontentloaded' });
    }
    if (login) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try { await prompt.question('Sign in, confirm India and Tech roles on the jobs page, then press Enter here. '); }
      finally { prompt.close(); }
    }
    const rows = await collect(page);
    if (!rows.length) throw new Error('No readable job cards appeared. Check the portal with --login.');
    const india = rows.filter(j => /\b(india|IN)\b/i.test(j.location ?? ''));
    const shortlist = rankRoles(india, profile);
    const report = { retrieved: new Date().toISOString(), source, scanned: rows.length, indiaCards: india.length, shortlist };
    await writeFile('shortlist.json', JSON.stringify(report, null, 2));
    console.table(shortlist.slice(0, 15).map(({ title, company, score, matched }) => ({ title, company, score, matched: matched.join(', ') })));
    console.log('Scanned %d cards, confirmed %d India listings, saved %d matches to shortlist.json.', rows.length, india.length, shortlist.length);
    if (!india.length) console.log('Check the country filter and session with --login.');
  } finally { await context.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });



