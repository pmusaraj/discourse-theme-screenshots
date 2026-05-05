const gallery = document.querySelector('#gallery');
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
