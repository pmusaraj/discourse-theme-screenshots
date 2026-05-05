import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { optimizeImage } from './image-optimizer.mjs';

export function planScreenshotJobs(themes, { outDir = 'public', only = null } = {}) {
  const jobs = [];
  for (const theme of themes) {
    for (const mode of theme.modes ?? ['light', 'dark']) {
      if (only && mode !== only) continue;
      jobs.push({ themeId: theme.id, themeName: theme.name, mode, outputPath: path.join(outDir, 'screenshots', theme.id, `${mode}.webp`) });
    }
  }
  return jobs;
}

function colorFor(themeId, mode) {
  let hash = 0;
  for (const ch of themeId) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return mode === 'dark' ? { bg: `hsl(${hash}, 32%, 10%)`, fg: `hsl(${hash}, 70%, 78%)` } : { bg: `hsl(${hash}, 58%, 94%)`, fg: `hsl(${hash}, 62%, 28%)` };
}

export async function createSampleScreenshot({ theme, mode, outputPath, screenshot }) {
  const width = screenshot.width ?? 2560;
  const height = screenshot.height ?? 1440;
  const colors = colorFor(theme.id, mode);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors.bg}"/><stop offset="1" stop-color="${colors.fg}" stop-opacity="0.28"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="96" y="96" width="${width - 192}" height="${height - 192}" rx="48" fill="${mode === 'dark' ? '#111827' : '#ffffff'}" opacity="0.82"/><text x="160" y="230" font-family="Inter, Arial" font-size="86" font-weight="700" fill="${colors.fg}">${escapeXml(theme.name)}</text><text x="160" y="330" font-family="Inter, Arial" font-size="42" fill="${colors.fg}" opacity="0.72">${mode.toUpperCase()} · deterministic sample screenshot</text><g opacity="0.38">${Array.from({ length: 8 }, (_, i) => `<rect x="160" y="${460 + i * 86}" width="${900 + ((i * 137) % 760)}" height="34" rx="17" fill="${colors.fg}"/>`).join('')}</g><circle cx="${width - 260}" cy="260" r="118" fill="${colors.fg}" opacity="0.18"/></svg>`;
  const tmpPath = outputPath.replace(/\.webp$/i, '.sample-source.png');
  await sharp(Buffer.from(svg)).png().toFile(tmpPath);
  const optimized = await optimizeImage(tmpPath, outputPath, screenshot);
  await rm(tmpPath, { force: true });
  return { relativePath: path.posix.join('screenshots', theme.id, `${mode}.webp`), ...optimized };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

export async function runSampleScreenshots({ themes, outDir = 'public', screenshot, only = null }) {
  const results = [];
  for (const theme of themes) {
    const themeResult = { themeId: theme.id, screenshots: {}, warnings: [] };
    for (const mode of theme.modes ?? ['light', 'dark']) {
      if (only && mode !== only) continue;
      const outputPath = path.join(outDir, 'screenshots', theme.id, `${mode}.webp`);
      const result = await createSampleScreenshot({ theme, mode, outputPath, screenshot });
      themeResult.screenshots[mode] = result;
      themeResult.warnings.push(...(result.warnings ?? []).map((w) => `${mode}: ${w}`));
    }
    results.push(themeResult);
  }
  return results;
}

export async function setColorMode(page, mode) {
  await page.emulateMedia({ colorScheme: mode });
  await page.addInitScript((value) => {
    localStorage.setItem('theme-screenshots-color-scheme', value);
    localStorage.setItem('discourse_theme_screenshots_color_scheme', value);
    document.documentElement.dataset.themeScreenshotsMode = value;
  }, mode);
  await page.evaluate((value) => { document.documentElement.dataset.themeScreenshotsMode = value; }, mode).catch(() => {});
}

export async function runLiveScreenshots({ themes, outDir = 'public', screenshot, discourseUrl, only = null, route = '/latest' }) {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const theme of themes) {
      const themeResult = { themeId: theme.id, screenshots: {}, warnings: [] };
      for (const mode of theme.modes ?? ['light', 'dark']) {
        if (only && mode !== only) continue;
        const page = await browser.newPage({ viewport: { width: screenshot.width, height: screenshot.height }, deviceScaleFactor: 1 });
        await setColorMode(page, mode);
        const url = new URL(route, discourseUrl).toString();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1000);
        const tmp = path.join(outDir, 'screenshots', theme.id, `${mode}.png`);
        const outputPath = path.join(outDir, 'screenshots', theme.id, `${mode}.webp`);
        await mkdir(path.dirname(tmp), { recursive: true });
        await page.screenshot({ path: tmp, fullPage: false });
        const optimized = await optimizeImage(tmp, outputPath, screenshot);
        await rm(tmp, { force: true });
        themeResult.screenshots[mode] = { relativePath: path.posix.join('screenshots', theme.id, `${mode}.webp`), ...optimized };
        themeResult.warnings.push(...(optimized.warnings ?? []).map((w) => `${mode}: ${w}`));
        await page.close();
      }
      results.push(themeResult);
    }
  } finally {
    await browser.close();
  }
  return results;
}
