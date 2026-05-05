import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { verifyOutput } from '../scripts/verify-output.mjs';

describe('verify output', () => {
  it('verifies gallery and manifest screenshots', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'verify-'));
    await mkdir(path.join(dir, 'data'), { recursive: true });
    await mkdir(path.join(dir, 'screenshots/air'), { recursive: true });
    await writeFile(path.join(dir, 'index.html'), '<!doctype html>');
    await writeFile(path.join(dir, 'app.js'), '');
    await writeFile(path.join(dir, 'styles.css'), '');
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#111' } }).webp().toFile(path.join(dir, 'screenshots/air/light.webp'));
    await writeFile(path.join(dir, 'data/manifest.json'), JSON.stringify({ screenshot: { width: 1600, height: 900, max_bytes: 1048576 }, themes: [{ id: 'air', screenshots: { light: 'screenshots/air/light.webp' }, warnings: [] }] }));
    const result = await verifyOutput({ outDir: dir });
    expect(result.ok).toBe(true);
  });
});
