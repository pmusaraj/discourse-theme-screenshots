export async function installTheme({ themeId, themePath, config, dryRun = true, skipInstall = true } = {}) {
  if (skipInstall || dryRun) {
    return { skipped: true, action: 'install', themeId, themePath, reason: skipInstall ? 'skip-install enabled' : 'dry-run enabled' };
  }
  throw new Error('Live Discourse theme installation is not enabled in this safe adapter. Use --skip-install or implement an explicit local mutation strategy.');
}

export async function activateTheme({ themeId, mode, dryRun = true, skipInstall = true } = {}) {
  if (skipInstall || dryRun) return { skipped: true, action: 'activate', themeId, mode };
  throw new Error('Live theme activation is not enabled by default.');
}

export async function deactivateTheme({ themeId, dryRun = true, skipInstall = true } = {}) {
  if (skipInstall || dryRun) return { skipped: true, action: 'deactivate', themeId };
  throw new Error('Live theme deactivation is not enabled by default.');
}
