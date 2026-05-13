# Theme Screenshots

Ruby tooling for running Discourse core's theme screenshot system spec for a configured list of themes, collecting the generated PNGs, and publishing a static review gallery.

The screenshot capture itself lives in the Discourse repository (`spec/system/theme_screenshots_spec.rb`). This repo provides:

- a theme list in YAML (`config/themes.yml` locally, `config/github.yml` in GitHub Actions)
- scheduled/manual GitHub Actions that capture screenshots
- a static webpage in `public/` that displays the generated screenshots

## GitHub Actions

Two workflows are included:

- `.github/workflows/checks.yml` — runs Ruby tests and verifies the static gallery shell on push/PR.
- `.github/workflows/theme-screenshots.yml` — runs nightly and via `workflow_dispatch`, checks out `discourse/discourse`, runs the Discourse screenshot spec for every theme in `config/github.yml`, uploads `public/` as an artifact, and deploys it to GitHub Pages from `main`.

To enable the deployed site in GitHub:

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Run **Actions → Theme screenshots → Run workflow** once, or wait for the nightly schedule.

Manual workflow inputs:

- `theme`: optional theme id from `config/github.yml`, for example `minima`.
- `subset`: optional `SCREENSHOTS_SUBSET` override; defaults to `topic`.

## Theme configuration

`config/github.yml` is intentionally GitHub-runnable: it uses public git URLs and Discourse core themes only.

Supported theme sources:

```yaml
# Discourse core theme
- id: foundation
  name: Foundation
  source:
    type: core
    theme: foundation

# Remote git theme
- id: minima
  name: Minima
  source:
    type: git
    url: https://github.com/Discourse/minima.git

# Local-only theme, useful for development on this Mac
- id: zleek
  name: zleek
  source:
    type: local
    path: /Users/pmusaraj/Projects/discourse-zleek
```

`config/themes.yml` remains the local configuration and can include local paths. Local themes are snapshotted into temporary git repositories before Discourse imports them.

## Local prerequisites

- Ruby
- Local Discourse repository at `/Users/pmusaraj/Projects/discourse`
- Discourse core must include `spec/system/theme_screenshots_spec.rb`
- The Discourse test environment must be ready to run system specs

## Local usage

Dry-run the exact Discourse commands:

```bash
bin/screenshot-themes --config config/themes.yml --dry-run
```

Run screenshots and build the gallery:

```bash
bin/screenshot-themes --config config/themes.yml --out public
bin/verify-output --out public
```

Run one theme:

```bash
bin/screenshot-themes --config config/themes.yml --theme minima --out public
```

Override the subset, if needed:

```bash
bin/screenshot-themes --config config/themes.yml --subset topic-list --out public
```

Open the gallery with any static file server:

```bash
python3 -m http.server 8123 --directory public
```

Then visit `http://127.0.0.1:8123`.

## Output

For each theme, the collector copies generated PNGs into:

```text
public/themes/<theme-id>/raw/*.png
```

It writes:

```text
public/data/manifest.json
public/index.html
public/app.js
public/styles.css
```

The gallery shows a light-mode homepage preview and links to all raw screenshots copied for each theme. Individual theme pages split desktop and mobile screenshots into horizontal carousels.

## Development

All automation in this repo is Ruby:

```bash
ruby -Itest -e 'Dir["test/**/*_test.rb"].sort.each { |file| require_relative file }'
# or
bundle exec rake test
```
