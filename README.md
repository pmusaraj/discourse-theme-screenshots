# Theme Screenshots

Standalone Node.js tooling for preparing Discourse theme sources, capturing light/dark screenshots, validating the Discourse screenshot spec, and building a static review gallery.

## What it creates

For each configured theme the default sample workflow writes:

- `public/screenshots/<theme-id>/light.webp`
- `public/screenshots/<theme-id>/dark.webp`
- `public/data/manifest.json`
- a static gallery in `public/index.html`, `public/app.js`, and `public/styles.css`

The screenshots honor the Discourse theme screenshot convention: 16:9 WebP images, recommended `2560x1440`, ideally under 1MB, with theme repos eventually containing:

```json
{
  "screenshots": ["screenshots/light.webp", "screenshots/dark.webp"]
}
```

## Prerequisites

- Node.js and pnpm
- Local Discourse repository at `/Users/pmusaraj/Projects/discourse`
- Optional for live capture: reachable Discourse instance at `https://disco2021.musaraj.com`
- Optional for live capture: `pnpm exec playwright install chromium`

No GitHub API token is required. Theme sources are cloned with public HTTPS git URLs into this project's `.cache/` directory.

## Install

```bash
pnpm install
```

## Basic deterministic sample run

Sample mode is the default and does not mutate Discourse or any theme repository.

```bash
pnpm screenshot-themes -- --config config/themes.yml --out public
pnpm verify-output
python3 -m http.server 8123 --directory public
```

Open `http://127.0.0.1:8123` to review the gallery.

## Dry run

```bash
pnpm screenshot-themes -- --config config/themes.yml --dry-run
```

This prints planned theme jobs, modes, source cache locations, viewport, and output paths without cloning or writing screenshots.

## Live browser capture

Live capture is opt-in. It still avoids risky Discourse DB mutations unless installation is explicitly enabled.

```bash
pnpm exec playwright install chromium
pnpm screenshot-themes -- --config config/themes.yml --no-sample --skip-install --out public
```

To call the safe install adapter in dry-run style:

```bash
pnpm screenshot-themes -- --config config/themes.yml --no-sample --install --dry-run
```

The current install adapter is intentionally conservative: it validates intent and reports what would be needed instead of mutating the local Discourse DB by default.

## Configuration

`config/themes.yml` initially includes exactly:

- `pmusaraj/discourse-verso`
- `Discourse/discourse-air`
- `Discourse/discourse-mint-theme`
- `Discourse/minima`

Git `ref` is optional and omitted for these repos so the default branch remains flexible.

## Verification

```bash
pnpm test
pnpm verify-output
pnpm screenshot-themes -- --config config/themes.yml --dry-run
```

`verify-output` checks the manifest, referenced screenshot files, dimensions, 16:9 ratio, size budget warnings, and gallery assets.

## Copying screenshots back to a theme

After reviewing generated images, copy them manually into a theme repo:

```text
theme-root/screenshots/light.webp
theme-root/screenshots/dark.webp
```

Then update `about.json` to include:

```json
{
  "screenshots": ["screenshots/light.webp", "screenshots/dark.webp"]
}
```

## Troubleshooting

- **Discourse not reachable:** use default sample mode, or verify the `discourse.base_url` URL and tunnel.
- **Theme install failure:** use `--skip-install`; install/activation is isolated and conservative by design.
- **Screenshot over 1MB:** the optimizer lowers WebP quality to a floor and records warnings if the target is still exceeded.
- **Dark mode not applying:** live mode uses best-effort localStorage, media emulation, and Discourse color-scheme helpers; verify manually in the gallery.
