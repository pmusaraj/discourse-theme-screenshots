import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildManifest, writeManifest } from '../src/manifest-writer.mjs';

describe('manifest writer', () => {
  it('uses deterministic relative screenshot paths', async () => {
    const manifest = buildManifest({
      generatedAt: '2026-05-05T00:00:00.000Z',
      discourseUrl: 'https://example.com',
      screenshot: { width: 2560, height: 1440, format: 'webp' },
      themes: [{ id: 'air', name: 'Air', source: { type: 'git', url: 'https://github.com/Discourse/discourse-air.git' }, status: 'ok', modes: ['light', 'dark'] }],
      results: [{ themeId: 'air', screenshots: { light: { relativePath: 'screenshots/air/light.webp' }, dark: { relativePath: 'screenshots/air/dark.webp' } }, warnings: [] }],
    });
    expect(manifest.themes[0].screenshots.dark).toBe('screenshots/air/dark.webp');
    const dir = await mkdtemp(path.join(tmpdir(), 'manifest-'));
    await writeManifest(path.join(dir, 'manifest.json'), manifest);
    expect(JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')).themes).toHaveLength(1);
  });
});
