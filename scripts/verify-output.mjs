import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { validateImage } from '../src/image-optimizer.mjs';

async function exists(file) {
  try { await access(file, constants.F_OK); return true; } catch { return false; }
}

export async function verifyOutput({ outDir = 'public' } = {}) {
  const errors = [];
  const warnings = [];
  for (const asset of ['index.html', 'app.js', 'styles.css']) {
    if (!(await exists(path.join(outDir, asset)))) errors.push(`Missing gallery asset: ${asset}`);
  }
  const manifestPath = path.join(outDir, 'data/manifest.json');
  let manifest;
  if (!(await exists(manifestPath))) {
    errors.push('Missing public/data/manifest.json');
  } else {
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { errors.push(`Invalid manifest JSON: ${error.message}`); }
  }
  if (manifest) {
    const screenshotOptions = manifest.screenshot ?? {};
    for (const theme of manifest.themes ?? []) {
      for (const [mode, rel] of Object.entries(theme.screenshots ?? {})) {
        const file = path.join(outDir, rel);
        if (!(await exists(file))) {
          errors.push(`Missing screenshot for ${theme.id} ${mode}: ${rel}`);
          continue;
        }
        const validation = await validateImage(file, screenshotOptions);
        const allowedSizeWarning = (theme.warnings ?? []).some((w) => /exceeds max_bytes/i.test(w));
        const hardWarnings = validation.warnings.filter((w) => !(allowedSizeWarning && /exceeds max_bytes/i.test(w)));
        if (hardWarnings.length) errors.push(`${theme.id} ${mode}: ${hardWarnings.join('; ')}`);
        warnings.push(...validation.warnings.map((w) => `${theme.id} ${mode}: ${w}`));
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'public';
  verifyOutput({ outDir }).then((result) => {
    for (const warning of result.warnings) console.warn(`warn: ${warning}`);
    if (!result.ok) {
      for (const error of result.errors) console.error(`error: ${error}`);
      process.exit(1);
    }
    console.log(`Output verified in ${outDir}`);
  }).catch((error) => { console.error(error); process.exit(1); });
}
