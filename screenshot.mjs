import puppeteer from 'puppeteer';
import { join } from 'path';
import { homedir } from 'os';

const outDir = join(homedir(), 'Desktop', 'stp-screenshots');
const pages = [
  { name: 'overview',     url: 'http://localhost:3001/dashboard/overview' },
  { name: 'performance',  url: 'http://localhost:3001/dashboard/performance' },
  { name: 'qubits',       url: 'http://localhost:3001/dashboard/qubits' },
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const p of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3500));
  const file = join(outDir, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved:', file);
  await page.close();
}

await browser.close();
