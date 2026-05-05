import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildGallery } from '../src/gallery-builder.mjs';

describe('gallery builder', () => {
  it('writes static gallery assets', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'gallery-'));
    await mkdir(path.join(dir, 'data'), { recursive: true });
    await writeFile(path.join(dir, 'data/manifest.json'), JSON.stringify({ generatedAt: 'now', themes: [] }));
    await buildGallery({ outDir: dir });
    expect(await readFile(path.join(dir, 'index.html'), 'utf8')).toContain('Discourse Theme Screenshots');
    expect(await readFile(path.join(dir, 'app.js'), 'utf8')).toContain('manifest.json');
    expect(await readFile(path.join(dir, 'styles.css'), 'utf8')).toContain(':root');
  });
});
