import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig, normalizeConfig } from '../src/config.mjs';

async function tmpConfig(body) {
  const dir = await mkdtemp(path.join(tmpdir(), 'theme-config-'));
  const file = path.join(dir, 'themes.yml');
  await writeFile(file, body);
  return file;
}

const minimal = `
discourse:
  repo_path: /tmp/discourse
  base_url: https://example.com
themes:
  - id: test-theme
    name: Test Theme
    source:
      type: git
      url: https://github.com/example/test-theme.git
`;

describe('config', () => {
  it('loads the example config', async () => {
    const config = await loadConfig('config/themes.example.yml', { checkRepoPath: false });
    expect(config.themes.map((t) => t.id)).toEqual([
      'discourse-verso',
      'discourse-air',
      'discourse-mint-theme',
      'minima',
    ]);
    expect(config.screenshot.width).toBe(2560);
  });

  it('rejects missing theme id', async () => {
    const file = await tmpConfig(minimal.replace('id: test-theme\n    ', ''));
    await expect(loadConfig(file, { checkRepoPath: false })).rejects.toThrow(/theme 1.*id/i);
  });

  it('rejects unknown source type', async () => {
    const file = await tmpConfig(minimal.replace('type: git', 'type: zip'));
    await expect(loadConfig(file, { checkRepoPath: false })).rejects.toThrow(/source.type/i);
  });

  it('applies screenshot defaults and modes', () => {
    const config = normalizeConfig({
      discourse: { repo_path: '/tmp/discourse', base_url: 'https://example.com' },
      themes: [{ id: 'x', name: 'X', source: { type: 'local', path: '/tmp/x' } }],
    }, { checkRepoPath: false });
    expect(config.screenshot).toMatchObject({ width: 2560, height: 1440, format: 'webp', max_bytes: 1048576 });
    expect(config.themes[0].modes).toEqual(['light', 'dark']);
  });
});
