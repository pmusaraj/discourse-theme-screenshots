#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { logger, formatJob } from './logger.mjs';
import { planThemeSource, prepareThemeSources } from './theme-source.mjs';
import { installTheme, activateTheme, deactivateTheme } from './theme-installer.mjs';
import { planScreenshotJobs, runLiveScreenshots, runSampleScreenshots } from './screenshot-runner.mjs';
import { buildManifest, writeManifest } from './manifest-writer.mjs';
import { buildGallery } from './gallery-builder.mjs';

const program = new Command();
program
  .name('screenshot-themes')
  .description('Capture Discourse theme screenshots and build a static gallery')
  .option('--config <path>', 'YAML config path', 'config/themes.yml')
  .option('--out <dir>', 'output directory', 'public')
  .option('--discourse-url <url>', 'override Discourse base URL')
  .option('--theme <id>', 'only run one theme id')
  .option('--only <mode>', 'only capture light or dark')
  .option('--skip-install', 'skip Discourse theme installation', true)
  .option('--install', 'request installation adapter (still safe unless implemented)')
  .option('--sample', 'generate deterministic sample screenshots', true)
  .option('--no-sample', 'use live Playwright capture')
  .option('--dry-run', 'print planned jobs without mutating')
  .action(async (opts) => {
    const config = await loadConfig(opts.config, { checkRepoPath: false });
    if (opts.discourseUrl) config.discourse.base_url = opts.discourseUrl;
    if (opts.only && !['light', 'dark'].includes(opts.only)) throw new Error('--only must be light or dark');
    const selectedThemes = config.themes.filter((theme) => !opts.theme || theme.id === opts.theme).map((theme) => opts.only ? { ...theme, modes: theme.modes.filter((m) => m === opts.only) } : theme);
    if (!selectedThemes.length) throw new Error(`No themes selected${opts.theme ? ` for ${opts.theme}` : ''}`);
    const cacheDir = path.resolve('.cache/themes');
    const sourcePlans = selectedThemes.map((theme) => planThemeSource(theme, { cacheDir }));
    const jobs = planScreenshotJobs(selectedThemes, { outDir: opts.out, only: opts.only });

    if (opts.dryRun) {
      logger.info('Theme screenshot dry run');
      logger.info(`Discourse URL: ${config.discourse.base_url}`);
      logger.info(`Viewport: ${config.screenshot.width}x${config.screenshot.height}`);
      logger.info(`Output: ${path.resolve(opts.out)}`);
      logger.info(`Mode: ${opts.sample ? 'sample' : 'live'}`);
      for (const plan of sourcePlans) logger.info(`Source: ${plan.themeId} ${plan.type} -> ${plan.path}`);
      for (const job of jobs) logger.info(`Job: ${formatJob(job)}`);
      return;
    }

    logger.info(`Preparing ${selectedThemes.length} theme source(s)`);
    const prepared = await prepareThemeSources(selectedThemes, { cacheDir });
    const skipInstall = opts.install ? false : opts.skipInstall;
    for (const plan of prepared) {
      const installResult = await installTheme({ themeId: plan.themeId, themePath: plan.path, config, dryRun: true, skipInstall });
      logger.info(`${installResult.action}: ${plan.themeId} (${installResult.reason ?? 'safe dry-run'})`);
      await activateTheme({ themeId: plan.themeId, dryRun: true, skipInstall });
    }

    const route = config.screenshot.routes?.[0]?.path ?? '/latest';
    const results = opts.sample
      ? await runSampleScreenshots({ themes: selectedThemes, outDir: opts.out, screenshot: config.screenshot, only: opts.only })
      : await runLiveScreenshots({ themes: selectedThemes, outDir: opts.out, screenshot: config.screenshot, discourseUrl: config.discourse.base_url, only: opts.only, route });

    for (const plan of prepared) await deactivateTheme({ themeId: plan.themeId, dryRun: true, skipInstall });
    const manifest = buildManifest({ discourseUrl: config.discourse.base_url, screenshot: config.screenshot, themes: selectedThemes, results });
    await writeManifest(path.join(opts.out, 'data/manifest.json'), manifest);
    await buildGallery({ outDir: opts.out });
    logger.info(`Wrote ${manifest.themes.length} theme(s) to ${opts.out}`);
  });

const argv = process.argv.filter((arg, index) => !(index === 2 && arg === '--'));
program.parseAsync(argv).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
