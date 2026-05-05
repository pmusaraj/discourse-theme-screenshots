import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { planThemeSource, slugFromRepoUrl } from '../src/theme-source.mjs';

describe('theme-source', () => {
  it('slugs GitHub urls', () => {
    expect(slugFromRepoUrl('https://github.com/Discourse/discourse-air.git')).toBe('discourse-air');
  });

  it('plans local paths without changing them', () => {
    const plan = planThemeSource({ id: 'local-theme', source: { type: 'local', path: '/tmp/theme' } }, { cacheDir: '.cache/themes' });
    expect(plan).toMatchObject({ type: 'local', path: '/tmp/theme', willClone: false });
  });

  it('plans git cache directory using theme id', () => {
    const plan = planThemeSource({ id: 'air', source: { type: 'git', url: 'https://github.com/Discourse/discourse-air.git' } }, { cacheDir: '.cache/themes' });
    expect(plan.path).toBe(path.resolve('.cache/themes/air'));
    expect(plan.willClone).toBe(true);
  });
});
