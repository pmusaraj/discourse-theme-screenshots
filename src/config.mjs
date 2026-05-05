import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const DEFAULT_SCREENSHOT = {
  width: 2560,
  height: 1440,
  format: 'webp',
  max_bytes: 1048576,
  routes: [{ name: 'latest', path: '/latest' }],
};

export async function loadConfig(filePath = 'config/themes.yml', options = {}) {
  const fullPath = path.resolve(filePath);
  const raw = await readFile(fullPath, 'utf8');
  return normalizeConfig(YAML.parse(raw), { ...options, configDir: path.dirname(fullPath) });
}

export function normalizeConfig(input, options = {}) {
  const errors = [];
  const config = input ?? {};
  if (!config.discourse) errors.push('discourse config is required');
  const discourse = config.discourse ?? {};
  if (!discourse.repo_path) errors.push('discourse.repo_path is required');
  if (!discourse.base_url) {
    errors.push('discourse.base_url is required');
  } else {
    try { new URL(discourse.base_url); } catch { errors.push('discourse.base_url must be a valid URL'); }
  }

  if (!Array.isArray(config.themes) || config.themes.length === 0) errors.push('themes must be a non-empty array');

  const screenshot = {
    ...DEFAULT_SCREENSHOT,
    ...(config.screenshot ?? {}),
  };
  if (!Array.isArray(screenshot.routes) || screenshot.routes.length === 0) screenshot.routes = DEFAULT_SCREENSHOT.routes;
  if (screenshot.format !== 'webp') errors.push('screenshot.format currently must be webp');

  const themes = (config.themes ?? []).map((theme, index) => {
    const label = `theme ${index + 1}`;
    if (!theme?.id) errors.push(`${label} id is required`);
    if (!theme?.name) errors.push(`${label} name is required`);
    if (!theme?.source?.type) errors.push(`${label} source.type is required`);
    if (theme?.source?.type && !['local', 'git'].includes(theme.source.type)) errors.push(`${label} source.type must be local or git`);
    if (theme?.source?.type === 'local' && !theme.source.path) errors.push(`${label} source.path is required for local sources`);
    if (theme?.source?.type === 'git' && !theme.source.url) errors.push(`${label} source.url is required for git sources`);
    const modes = theme.modes ?? ['light', 'dark'];
    if (!Array.isArray(modes) || modes.some((m) => !['light', 'dark'].includes(m))) errors.push(`${label} modes must contain light and/or dark`);
    return { ...theme, modes };
  });

  if (options.checkRepoPath !== false && discourse.repo_path) {
    // Defer existence check to async loadConfig where possible; normalizeConfig remains sync for tests.
  }

  if (errors.length) throw new Error(`Invalid config: ${errors.join('; ')}`);
  return { ...config, discourse, screenshot, themes };
}

export async function assertRepoPath(config) {
  await access(config.discourse.repo_path, constants.R_OK);
  return config;
}
