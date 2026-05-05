# Theme Screenshots Project Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Create a new project at `/Users/pmusaraj/Projects/theme-screenshots` that can take light/dark preview screenshots for a list of Discourse themes using the local Discourse repo/instance, then display the generated results in a polished static HTML/JS gallery.

**Architecture:** Build a standalone Node.js CLI + static gallery project. The CLI reads a theme list, prepares each theme in the local Discourse development instance, drives a browser at the Discourse-recommended screenshot dimensions, captures `light.webp` and `dark.webp`, writes metadata, and generates a static gallery under `public/`. Keep Discourse-specific integration isolated so the screenshot runner can be adapted if Discourse theme install APIs or local paths change.

**Tech Stack:** Node.js, Playwright, Sharp, YAML config, static HTML/CSS/JS. Local Discourse repo at `/Users/pmusaraj/Projects/discourse`; local Discourse dev instance available at `https://disco2021.musaraj.com` via Docker/Cloudflare Tunnel.

---

## Current context / assumptions

- New project path: `/Users/pmusaraj/Projects/theme-screenshots`.
- Local Discourse repo path: `/Users/pmusaraj/Projects/discourse`.
- Discourse theme screenshot spec exists in the local Discourse repo:
  - `/Users/pmusaraj/Projects/discourse/docs/developer-guides/docs/05-themes-components/34-theme-screenshots.md`
- Spec requirements to honor:
  - Theme repo should contain `screenshots/`.
  - Expected files are typically `screenshots/light.webp` and `screenshots/dark.webp`.
  - Screenshots should be 16:9, recommended `2560 × 1440`.
  - Each image should be under `1MB` where possible.
  - Accepted formats: WebP, PNG, JPEG; use WebP by default.
  - `about.json` needs: `"screenshots": ["screenshots/light.webp", "screenshots/dark.webp"]`.
- This plan assumes “discord themes” in the request means **Discourse themes**.
- Initial implementation should be local-first and deterministic, not a hosted service.
- Avoid committing generated screenshots unless explicitly requested later; treat them as build artifacts first.

## Proposed project shape

```text
/Users/pmusaraj/Projects/theme-screenshots/
  package.json
  README.md
  .gitignore
  config/
    themes.example.yml
    themes.yml                 # local working list, gitignored if needed
  src/
    cli.mjs
    config.mjs
    discourse-client.mjs
    theme-installer.mjs
    screenshot-runner.mjs
    image-optimizer.mjs
    manifest-writer.mjs
    gallery-builder.mjs
    logger.mjs
  public/
    index.html
    app.js
    styles.css
    data/manifest.json
    screenshots/...            # generated files
  scripts/
    verify-output.mjs
  tests/
    config.test.mjs
    manifest-writer.test.mjs
    image-optimizer.test.mjs
    gallery-builder.test.mjs
```

## CLI interface target

Primary command:

```bash
pnpm screenshot-themes --config config/themes.yml --out public --discourse-url https://disco2021.musaraj.com
```

Useful options:

```bash
pnpm screenshot-themes --theme discourse-horizon
pnpm screenshot-themes --skip-install
pnpm screenshot-themes --only light
pnpm screenshot-themes --dry-run
pnpm build-gallery --manifest public/data/manifest.json --out public
pnpm verify-output
```

## Theme config target

`config/themes.example.yml`:

```yaml
discourse:
  repo_path: /Users/pmusaraj/Projects/discourse
  base_url: https://disco2021.musaraj.com
  admin_username: system
  # Prefer DISCOURSE_API_KEY / DISCOURSE_API_USERNAME env vars when possible.

screenshot:
  width: 2560
  height: 1440
  format: webp
  max_bytes: 1048576
  routes:
    - name: latest
      path: /latest

themes:
  - id: horizon
    name: Horizon
    source:
      type: local
      path: /Users/pmusaraj/Projects/discourse/themes/horizon
    modes: [light, dark]
  - id: example-remote-theme
    name: Example remote theme
    source:
      type: git
      url: https://github.com/discourse/example-theme.git
      ref: main
    modes: [light, dark]
```

## Implementation tasks

### Task 1: Create the project skeleton

**Objective:** Create the standalone project directory, package metadata, empty source/test folders, and basic docs.

**Files:**
- Create: `/Users/pmusaraj/Projects/theme-screenshots/package.json`
- Create: `/Users/pmusaraj/Projects/theme-screenshots/README.md`
- Create: `/Users/pmusaraj/Projects/theme-screenshots/.gitignore`
- Create directories: `src/`, `tests/`, `config/`, `public/`, `public/data/`, `scripts/`

**Implementation notes:**
- Use ESM (`"type": "module"`).
- Use `pnpm` as package manager.
- Initial dependencies:
  - `playwright`
  - `sharp`
  - `yaml`
  - `execa`
  - `commander`
- Dev dependencies:
  - `vitest`
  - `prettier`

**Expected scripts in `package.json`:**

```json
{
  "scripts": {
    "screenshot-themes": "node src/cli.mjs",
    "build-gallery": "node src/gallery-builder.mjs",
    "verify-output": "node scripts/verify-output.mjs",
    "test": "vitest run",
    "format": "prettier --write .",
    "check": "pnpm test && node scripts/verify-output.mjs"
  }
}
```

**Verification:**

```bash
cd /Users/pmusaraj/Projects/theme-screenshots
pnpm install
pnpm test
```

Expected: install succeeds; tests command runs with no tests or placeholder passing test.

**Commit:**

```bash
git add .
git commit -m "chore: initialize theme screenshots project"
```

---

### Task 2: Add config loading and validation

**Objective:** Parse `config/themes.yml`, validate required fields, and normalize defaults.

**Files:**
- Create: `src/config.mjs`
- Create: `config/themes.example.yml`
- Create: `tests/config.test.mjs`

**Behavior:**
- Read YAML config from `--config` path.
- Validate:
  - `discourse.repo_path` exists.
  - `discourse.base_url` is a URL.
  - each theme has `id`, `name`, `source.type`, and source-specific fields.
  - `source.type` is one of `local`, `git`.
- Default screenshot options:
  - `width: 2560`
  - `height: 1440`
  - `format: webp`
  - `max_bytes: 1048576`
  - modes: `[light, dark]`

**Test cases:**
- loads valid example config
- rejects missing theme id
- rejects unknown source type
- applies default screenshot dimensions

**Verification:**

```bash
pnpm test tests/config.test.mjs
```

Expected: all config tests pass.

**Commit:**

```bash
git add src/config.mjs config/themes.example.yml tests/config.test.mjs
git commit -m "feat: add theme screenshot config loading"
```

---

### Task 3: Add CLI argument parsing and dry-run output

**Objective:** Provide a useful CLI entrypoint before doing Discourse/browser work.

**Files:**
- Create: `src/cli.mjs`
- Create: `src/logger.mjs`
- Create/modify: `tests/cli.test.mjs` if CLI tests are practical, otherwise test config functions only and smoke-test manually.

**Behavior:**
- Support:
  - `--config`
  - `--out`
  - `--discourse-url`
  - `--theme`
  - `--only light|dark`
  - `--skip-install`
  - `--dry-run`
- `--dry-run` prints selected themes, modes, target URL, viewport, and output paths without mutating anything.

**Verification:**

```bash
pnpm screenshot-themes -- --config config/themes.example.yml --dry-run
```

Expected: prints planned jobs and exits `0`.

**Commit:**

```bash
git add src/cli.mjs src/logger.mjs tests/cli.test.mjs
git commit -m "feat: add screenshot CLI dry run"
```

---

### Task 4: Implement theme source preparation

**Objective:** Convert local/git theme sources into local working directories for screenshot runs.

**Files:**
- Create: `src/theme-source.mjs`
- Create: `tests/theme-source.test.mjs`
- Update: `.gitignore` to ignore `.cache/` and generated outputs.

**Behavior:**
- `local` source returns the provided local path.
- `git` source clones/fetches into `.cache/themes/<theme-id>`.
- Support `ref` checkout for git themes.
- Do not modify the source theme repo in this task.

**Verification:**

```bash
pnpm test tests/theme-source.test.mjs
pnpm screenshot-themes -- --config config/themes.example.yml --dry-run
```

Expected: source paths resolve; git behavior covered by unit tests using a temporary local git repo if possible.

**Commit:**

```bash
git add src/theme-source.mjs tests/theme-source.test.mjs .gitignore
git commit -m "feat: prepare theme sources for screenshot runs"
```

---

### Task 5: Implement Discourse theme installation/activation adapter

**Objective:** Add an isolated adapter for installing a theme into the local Discourse instance and activating it for screenshot capture.

**Files:**
- Create: `src/discourse-client.mjs`
- Create: `src/theme-installer.mjs`
- Create: `tests/discourse-client.test.mjs` for request construction, not live network calls.

**Approach options to validate before implementation:**
1. Prefer Discourse admin/theme HTTP APIs if available for import/update/activate.
2. If API is awkward, run Rails/Rake commands against the local Docker-backed repo using `/Users/pmusaraj/Projects/discourse` as workdir.
3. Keep this behind an interface:

```js
await installTheme({ themeId, themePath, config });
await activateTheme({ themeId, mode, config });
await deactivateTheme({ themeId, config });
```

**Important:** This task needs a short discovery step during implementation to identify the correct Discourse theme import path/API in the current repo.

**Verification:**

```bash
pnpm test tests/discourse-client.test.mjs
pnpm screenshot-themes -- --config config/themes.yml --theme horizon --skip-screenshots
```

Expected: adapter can install/activate one known local theme, or dry-run reports exactly what would happen if live install is deferred.

**Commit:**

```bash
git add src/discourse-client.mjs src/theme-installer.mjs tests/discourse-client.test.mjs
git commit -m "feat: add Discourse theme installation adapter"
```

---

### Task 6: Implement Playwright screenshot capture

**Objective:** Capture 2560×1440 screenshots for each theme/mode from the target Discourse route.

**Files:**
- Create: `src/screenshot-runner.mjs`
- Create: `tests/screenshot-runner.test.mjs` for output path generation and mode planning.

**Behavior:**
- Launch Chromium via Playwright.
- Set viewport to `2560 × 1440`.
- Visit configured route, default `/latest`.
- Wait for network idle or a Discourse-ready selector.
- Capture full viewport screenshot for each mode:
  - `public/screenshots/<theme-id>/light.webp`
  - `public/screenshots/<theme-id>/dark.webp`
- If Discourse mode switching is via UI/localStorage/site setting, encapsulate it in one helper:

```js
await setColorMode(page, "light");
await setColorMode(page, "dark");
```

**Verification:**

```bash
pnpm screenshot-themes -- --config config/themes.yml --theme horizon --only light
```

Expected: creates one screenshot at the expected path, with dimensions `2560×1440`.

**Commit:**

```bash
git add src/screenshot-runner.mjs tests/screenshot-runner.test.mjs
git commit -m "feat: capture theme screenshots with Playwright"
```

---

### Task 7: Optimize images and enforce screenshot spec

**Objective:** Convert/compress screenshots to WebP and validate Discourse screenshot constraints.

**Files:**
- Create: `src/image-optimizer.mjs`
- Create: `tests/image-optimizer.test.mjs`

**Behavior:**
- Use Sharp to write WebP.
- Validate:
  - 16:9 ratio
  - dimensions match configured size
  - file size under configured max if achievable
- If over 1MB, reduce WebP quality incrementally down to a sensible floor (e.g. `quality: 60`) and report if still too large.

**Verification:**

```bash
pnpm test tests/image-optimizer.test.mjs
pnpm verify-output
```

Expected: generated screenshots pass dimensions and file-size checks or emit actionable warnings.

**Commit:**

```bash
git add src/image-optimizer.mjs tests/image-optimizer.test.mjs
git commit -m "feat: optimize screenshots for Discourse theme spec"
```

---

### Task 8: Write manifest output

**Objective:** Persist machine-readable metadata for the generated screenshots and gallery.

**Files:**
- Create: `src/manifest-writer.mjs`
- Create: `tests/manifest-writer.test.mjs`
- Generated: `public/data/manifest.json`

**Manifest shape:**

```json
{
  "generatedAt": "2026-05-05T00:00:00.000Z",
  "discourseUrl": "https://disco2021.musaraj.com",
  "screenshot": {
    "width": 2560,
    "height": 1440,
    "format": "webp"
  },
  "themes": [
    {
      "id": "horizon",
      "name": "Horizon",
      "source": "local:/Users/pmusaraj/Projects/discourse/themes/horizon",
      "status": "ok",
      "screenshots": {
        "light": "screenshots/horizon/light.webp",
        "dark": "screenshots/horizon/dark.webp"
      },
      "warnings": []
    }
  ]
}
```

**Verification:**

```bash
pnpm test tests/manifest-writer.test.mjs
node -e 'console.log(JSON.parse(require("fs").readFileSync("public/data/manifest.json", "utf8")).themes.length)'
```

Expected: manifest writes deterministic relative paths.

**Commit:**

```bash
git add src/manifest-writer.mjs tests/manifest-writer.test.mjs
git commit -m "feat: write screenshot manifest"
```

---

### Task 9: Build the static gallery page

**Objective:** Display screenshots in a good-looking HTML/JS interface.

**Files:**
- Create: `public/index.html`
- Create: `public/app.js`
- Create: `public/styles.css`
- Create: `src/gallery-builder.mjs` if templating/generation is needed.

**Gallery requirements:**
- Responsive grid of theme cards.
- Each card shows theme name, source, status, warnings, and light/dark screenshots.
- Toggle or side-by-side comparison for light/dark.
- Search/filter by theme name/status.
- Show generated timestamp.
- Graceful empty/error states if manifest is missing or a theme failed.
- Keep it static: open with local file server or deploy to Pages later.

**Verification:**

```bash
python3 -m http.server 8123 --directory public
open http://127.0.0.1:8123
```

Expected: gallery loads manifest and displays generated screenshot cards.

**Commit:**

```bash
git add public/index.html public/app.js public/styles.css src/gallery-builder.mjs
git commit -m "feat: add screenshot gallery"
```

---

### Task 10: Add output verification script

**Objective:** Provide one command that verifies screenshot outputs and gallery consistency.

**Files:**
- Create: `scripts/verify-output.mjs`

**Checks:**
- `public/data/manifest.json` exists and is valid JSON.
- Every screenshot path referenced by manifest exists.
- Every screenshot is 16:9.
- Every screenshot matches configured dimensions unless explicitly warned.
- Every screenshot is under 1MB unless explicitly warned.
- `public/index.html`, `public/app.js`, and `public/styles.css` exist.

**Verification:**

```bash
pnpm verify-output
```

Expected: exits `0` for a valid generated run; non-zero with clear messages for missing images.

**Commit:**

```bash
git add scripts/verify-output.mjs
git commit -m "test: verify generated screenshot output"
```

---

### Task 11: Add README usage docs

**Objective:** Document local setup, theme list format, run commands, and Discourse screenshot spec expectations.

**Files:**
- Modify: `README.md`

**Include:**
- Prerequisites:
  - local Discourse repo at `/Users/pmusaraj/Projects/discourse`
  - reachable Discourse instance at `https://disco2021.musaraj.com`
  - Node + pnpm
  - Playwright browser install
- Basic run:

```bash
pnpm install
pnpm exec playwright install chromium
cp config/themes.example.yml config/themes.yml
pnpm screenshot-themes -- --config config/themes.yml --out public
python3 -m http.server 8123 --directory public
```

- Generated screenshot output paths.
- How to copy screenshots back into a theme repo:

```text
theme-root/screenshots/light.webp
theme-root/screenshots/dark.webp
```

- How to update `about.json` with `screenshots` array.
- Troubleshooting:
  - Discourse not reachable
  - theme install failure
  - screenshot over 1MB
  - dark mode not applying

**Verification:**

```bash
pnpm check
```

Expected: tests and output checks pass.

**Commit:**

```bash
git add README.md
git commit -m "docs: document theme screenshot workflow"
```

---

### Task 12: End-to-end smoke test with one local theme

**Objective:** Prove the full workflow works against one known local Discourse theme.

**Files:**
- Modify: `config/themes.yml` locally only, or use a temporary config in `/tmp`.
- Generated: `public/screenshots/horizon/light.webp`, `public/screenshots/horizon/dark.webp`, `public/data/manifest.json`.

**Run:**

```bash
pnpm screenshot-themes -- --config config/themes.yml --theme horizon
pnpm verify-output
python3 -m http.server 8123 --directory public
```

**Manual browser verification:**
- Open `http://127.0.0.1:8123`.
- Confirm Horizon card appears.
- Confirm light and dark screenshots are visible.
- Confirm image dimensions and file sizes are shown or available in manifest.
- Confirm warnings are clear if any image exceeds target size.

**Commit decision:**
- Commit code/docs/config examples.
- Do **not** commit generated screenshots unless the project should publish a checked-in gallery.

---

## Files likely to change in Discourse

None initially. This project should consume the local Discourse repo/instance without changing Discourse.

Possible later Discourse changes, only if needed:
- Add or expose a stable local-only theme screenshot route/helper.
- Add documented API support for screenshot generation.
- Improve theme screenshot docs if the implementation uncovers missing details.

Any Discourse change must follow `/Users/pmusaraj/Projects/discourse/AGENTS.md` conventions and run `bin/lint` for changed files.

## Tests / validation summary

Automated:

```bash
pnpm test
pnpm verify-output
pnpm screenshot-themes -- --config config/themes.example.yml --dry-run
```

Manual/local E2E:

```bash
pnpm screenshot-themes -- --config config/themes.yml --theme horizon
pnpm verify-output
python3 -m http.server 8123 --directory public
```

Browser checks:
- Discourse route loads at `2560×1440` viewport.
- Light and dark modes are distinct where expected.
- `public/data/manifest.json` references existing images.
- Gallery displays all generated themes and warnings.

Image checks:
- 16:9 aspect ratio.
- Target dimensions `2560×1440`.
- WebP output.
- Under 1MB where possible.

## Risks, tradeoffs, and open questions

### Risks

- **Theme activation API uncertainty:** Need to discover the best current way to install/activate a theme in the local Discourse instance.
- **Dark mode switching:** Discourse may require user preference, color scheme, theme setting, or localStorage/session manipulation. Encapsulate and test this separately.
- **Theme side effects:** Installing many themes into the same local Discourse DB may leave state behind. Add cleanup or reuse/update behavior.
- **Screenshot stability:** Async page loading, fonts, images, and plugin content can create flaky screenshots. Use stable selectors and wait strategy.
- **File size under 1MB:** Some visually complex themes may need lower quality or slightly reduced dimensions to stay below 1MB.

### Tradeoffs

- **Standalone project vs Discourse script:** Standalone keeps experimentation isolated; a Discourse-native script might integrate better with internals but would add maintenance to the main repo.
- **HTTP API vs Rails command integration:** HTTP API is cleaner and closer to user behavior; Rails commands may be easier for local automation but more coupled to Discourse internals.
- **Generated static gallery vs app server:** Static gallery is simpler, portable, and easy to publish; an app server is unnecessary for the first version.

### Open questions for implementation

1. What should the initial theme list be?
   - Local Discourse bundled themes only?
   - A curated set of public Discourse theme repos?
   - Both?
2. Should generated screenshots be copied back into each theme repo automatically, or only stored in `theme-screenshots/public/screenshots/` for review?
3. Should the project commit generated screenshot artifacts, or keep them ignored?
4. Is `https://disco2021.musaraj.com` the preferred screenshot target, or should the runner use a direct local URL inside Docker/LAN for speed and stability?
5. Should the gallery be deployed somewhere later, or remain local-only for now?

## Recommended first implementation pass

Build the project in this order:

1. Project skeleton.
2. Config + dry-run CLI.
3. Static gallery with sample/mock manifest.
4. Screenshot capture against an already active theme.
5. Discourse theme install/activation integration.
6. Image optimization/spec verification.
7. End-to-end run over a small theme list.

This order gives a visible gallery early while deferring the riskiest Discourse integration until the project structure and output contract are stable.
