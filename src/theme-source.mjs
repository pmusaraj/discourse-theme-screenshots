import { mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

export function slugFromRepoUrl(url) {
  const part = url.split('/').pop() || url;
  return part.replace(/\.git$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

export function planThemeSource(theme, { cacheDir = '.cache/themes' } = {}) {
  if (theme.source.type === 'local') {
    return { type: 'local', path: path.resolve(theme.source.path), willClone: false, themeId: theme.id };
  }
  return {
    type: 'git',
    url: theme.source.url,
    ref: theme.source.ref,
    path: path.resolve(cacheDir, theme.id || slugFromRepoUrl(theme.source.url)),
    willClone: true,
    themeId: theme.id,
  };
}

async function exists(file) {
  try { await access(file, constants.F_OK); return true; } catch { return false; }
}

export async function prepareThemeSource(theme, options = {}) {
  const plan = planThemeSource(theme, options);
  if (plan.type === 'local') return plan;
  await mkdir(path.dirname(plan.path), { recursive: true });
  if (await exists(path.join(plan.path, '.git'))) {
    await execa('git', ['fetch', '--prune'], { cwd: plan.path });
  } else {
    await execa('git', ['clone', plan.url, plan.path]);
  }
  if (plan.ref) await execa('git', ['checkout', plan.ref], { cwd: plan.path });
  return { ...plan, prepared: true };
}

export async function prepareThemeSources(themes, options = {}) {
  const out = [];
  for (const theme of themes) out.push(await prepareThemeSource(theme, options));
  return out;
}
