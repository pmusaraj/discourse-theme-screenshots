import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sourceLabel(source) {
  if (!source) return 'unknown';
  if (source.type === 'git') return `git:${source.url}${source.ref ? `#${source.ref}` : ''}`;
  if (source.type === 'local') return `local:${source.path}`;
  return source.type;
}

export function buildManifest({ generatedAt = new Date().toISOString(), discourseUrl, screenshot, themes, results = [] }) {
  const byTheme = new Map(results.map((r) => [r.themeId, r]));
  return {
    generatedAt,
    discourseUrl,
    screenshot: { width: screenshot.width, height: screenshot.height, format: screenshot.format ?? 'webp', max_bytes: screenshot.max_bytes },
    themes: themes.map((theme) => {
      const result = byTheme.get(theme.id) ?? { screenshots: {}, warnings: ['No screenshot result recorded'] };
      const screenshots = {};
      for (const mode of theme.modes ?? ['light', 'dark']) {
        if (result.screenshots?.[mode]?.relativePath) screenshots[mode] = result.screenshots[mode].relativePath;
      }
      return { id: theme.id, name: theme.name, source: sourceLabel(theme.source), status: result.error ? 'error' : 'ok', screenshots, warnings: result.error ? [result.error, ...(result.warnings ?? [])] : (result.warnings ?? []) };
    }),
  };
}

export async function writeManifest(filePath, manifest) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
