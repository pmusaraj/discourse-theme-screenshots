import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planScreenshotJobs, runSampleScreenshots } from '../src/screenshot-runner.mjs';
import { validateImage } from '../src/image-optimizer.mjs';

describe('screenshot runner', () => {
  it('plans output paths for modes', () => {
    const jobs = planScreenshotJobs([{ id: 'air', name: 'Air', modes: ['light', 'dark'] }], { outDir: '/tmp/public', only: null });
    expect(jobs.map((j) => j.outputPath)).toEqual(['/tmp/public/screenshots/air/light.webp', '/tmp/public/screenshots/air/dark.webp']);
  });

  it('generates deterministic sample screenshots', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'samples-'));
    const results = await runSampleScreenshots({ themes: [{ id: 'air', name: 'Air', modes: ['light', 'dark'] }], outDir: dir, screenshot: { width: 640, height: 360, max_bytes: 1048576 } });
    expect(results[0].screenshots.light.relativePath).toBe('screenshots/air/light.webp');
    expect((await validateImage(path.join(dir, 'screenshots/air/dark.webp'), { width: 640, height: 360, max_bytes: 1048576 })).ok).toBe(true);
  });
});
