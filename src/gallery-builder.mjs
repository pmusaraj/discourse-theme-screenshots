import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';

export const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Discourse Theme Screenshots</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="hero">
    <div>
      <p class="eyebrow">Discourse</p>
      <h1>Discourse Theme Screenshots</h1>
      <p id="summary">Loading manifest…</p>
    </div>
    <label class="search"><span>Filter</span><input id="filter" type="search" placeholder="theme name or status"></label>
  </header>
  <main id="gallery" class="grid" aria-live="polite"></main>
  <template id="empty"><section class="empty">No themes match the current filter.</section></template>
  <script type="module" src="app.js"></script>
</body>
</html>
`;

export const APP_JS = `const gallery = document.querySelector('#gallery');
const summary = document.querySelector('#summary');
const filter = document.querySelector('#filter');
let manifest = null;

async function loadManifest() {
  const response = await fetch('data/manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load data/manifest.json');
  return response.json();
}

function render() {
  const q = filter.value.trim().toLowerCase();
  const themes = (manifest?.themes ?? []).filter((theme) => [theme.name, theme.id, theme.status, theme.source].join(' ').toLowerCase().includes(q));
  gallery.innerHTML = '';
  summary.textContent = manifest ? (themes.length + ' of ' + manifest.themes.length + ' themes · generated ' + manifest.generatedAt + ' · ' + manifest.screenshot?.width + '×' + manifest.screenshot?.height) : 'No manifest loaded';
  if (!themes.length) {
    gallery.append(document.querySelector('#empty').content.cloneNode(true));
    return;
  }
  for (const theme of themes) {
    const card = document.createElement('article');
    card.className = 'card status-' + theme.status;
    const shots = Object.entries(theme.screenshots ?? {}).map(([mode, src]) => '<figure><img src="' + src + '" alt="' + escapeHtml(theme.name) + ' ' + mode + ' screenshot" loading="lazy"><figcaption>' + mode + '</figcaption></figure>').join('');
    const warnings = (theme.warnings ?? []).length ? '<ul class="warnings">' + theme.warnings.map((w) => '<li>' + escapeHtml(w) + '</li>').join('') + '</ul>' : '<p class="ok">No warnings</p>';
    card.innerHTML = '<div class="card-head"><div><h2>' + escapeHtml(theme.name) + '</h2><p>' + escapeHtml(theme.id) + '</p></div><span>' + escapeHtml(theme.status) + '</span></div><p class="source">' + escapeHtml(theme.source) + '</p><div class="shots">' + shots + '</div>' + warnings;
    gallery.append(card);
  }
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

filter.addEventListener('input', render);
loadManifest().then((data) => { manifest = data; render(); }).catch((error) => { summary.textContent = error.message; gallery.innerHTML = '<section class="empty">Run the CLI to generate screenshots and manifest data.</section>'; });
`;

export const STYLES_CSS = `:root { color-scheme: light dark; --bg: #0f172a; --panel: #111827; --text: #e5e7eb; --muted: #94a3b8; --accent: #60a5fa; --ok: #34d399; --warn: #fbbf24; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top left, #1e3a8a55, transparent 36rem), var(--bg); color: var(--text); }
.hero { display: flex; justify-content: space-between; gap: 2rem; align-items: end; padding: 3rem clamp(1rem, 4vw, 4rem) 2rem; }
h1 { margin: .2rem 0; font-size: clamp(2rem, 4vw, 4.5rem); letter-spacing: -.04em; }
.eyebrow, #summary, .card p { color: var(--muted); }
.search { display: grid; gap: .4rem; min-width: min(22rem, 100%); color: var(--muted); }
.search input { border: 1px solid #334155; border-radius: 999px; background: #020617aa; color: var(--text); padding: .9rem 1rem; font: inherit; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(34rem, 100%), 1fr)); gap: 1.5rem; padding: 0 clamp(1rem, 4vw, 4rem) 4rem; }
.card { border: 1px solid #334155; border-radius: 1.5rem; background: color-mix(in srgb, var(--panel), transparent 8%); box-shadow: 0 24px 80px #0006; padding: 1rem; overflow: hidden; }
.card-head { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
.card h2 { margin: 0; font-size: 1.5rem; }
.card-head span { border: 1px solid #334155; border-radius: 999px; padding: .3rem .7rem; color: var(--ok); text-transform: uppercase; font-size: .75rem; letter-spacing: .08em; }
.source { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }
figure { margin: 0; }
img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 1rem; border: 1px solid #334155; background: #020617; }
figcaption { margin-top: .5rem; color: var(--muted); text-transform: capitalize; }
.warnings { color: var(--warn); }
.ok { color: var(--ok); }
.empty { border: 1px dashed #475569; border-radius: 1rem; padding: 2rem; color: var(--muted); }
@media (max-width: 760px) { .hero { display: grid; } }
`;

export async function buildGallery({ outDir = 'public' } = {}) {
  await mkdir(path.join(outDir, 'data'), { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), INDEX_HTML);
  await writeFile(path.join(outDir, 'app.js'), APP_JS);
  await writeFile(path.join(outDir, 'styles.css'), STYLES_CSS);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const program = new Command().option('--out <dir>', 'output directory', 'public');
  program.parse();
  buildGallery({ outDir: program.opts().out }).then(() => console.log(`Gallery written to ${program.opts().out}`));
}
