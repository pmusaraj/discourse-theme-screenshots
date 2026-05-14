
const app = document.querySelector('#app');

const summary = document.querySelector('#summary');

let manifest = null;

let lightboxItems = [];

let lightboxIndex = 0;



async function loadManifest() {

  const response = await fetch('data/manifest.json', { cache: 'no-store' });

  if (!response.ok) throw new Error('Unable to load data/manifest.json');

  return response.json();

}



function render() {

  closeLightbox();

  const themeId = location.hash.startsWith('#/theme/') ? decodeURIComponent(location.hash.slice(8)) : '';

  const theme = themeId && themeId !== location.hash ? (manifest?.themes ?? []).find((item) => item.id === themeId) : null;

  if (theme) {

    renderTheme(theme);

  } else {

    renderIndex();

  }

}



function renderIndex() {

  lightboxItems = [];

  const themes = manifest?.themes ?? [];

  const cacheBust = encodeURIComponent(manifest?.generatedAt ?? Date.now());

  summary.textContent = manifest ? themes.length + ' themes · subset ' + manifest.screenshot?.subset + ' · generated ' + manifest.generatedAt : 'No manifest loaded';

  app.className = 'theme-grid';

  app.innerHTML = themes.map((theme) => {

    const preview = theme.screenshots?.light;

    return '<article class="theme-card">' +

      '<a class="card-link" href="#/theme/' + encodeURIComponent(theme.id) + '">' +

        '<div class="card-head"><h2>' + escapeHtml(theme.name) + '</h2><span>' + escapeHtml(theme.status) + '</span></div>' +

        '<p class="theme-id">' + escapeHtml(theme.id) + '</p>' +

        '<div class="theme-preview">' + previewImage(preview, theme.name, cacheBust) + '</div>' +

      '</a>' +

    '</article>';

  }).join('');

}



function renderTheme(theme) {

  const cacheBust = encodeURIComponent(manifest?.generatedAt ?? Date.now());

  const rawFiles = theme.rawFiles ?? [];

  summary.textContent = theme.name + ' · ' + rawFiles.length + ' screenshots';

  app.className = 'theme-detail';

  const warnings = (theme.warnings ?? []).length ? '<ul class="warnings">' + theme.warnings.map((warning) => '<li>' + escapeHtml(warning) + '</li>').join('') + '</ul>' : '';

  const grouped = groupScreenshots(rawFiles);

  lightboxItems = ['desktop', 'mobile'].flatMap((device) => grouped[device].map((src) => ({ device, src, name: src.split('/').pop() || src, url: src + '?v=' + cacheBust })));

  const sections = ['desktop', 'mobile'].map((device) => renderCarouselSection(device, grouped[device], cacheBust)).join('');

  app.innerHTML = '<nav class="back"><a href="#/">← all themes</a></nav>' +

    '<section class="detail-head"><div><h2>' + escapeHtml(theme.name) + '</h2><p class="theme-id">' + escapeHtml(theme.id) + '</p></div><span class="status">' + escapeHtml(theme.status) + '</span></section>' +

    '<p class="source">' + escapeHtml(theme.source) + '</p>' + warnings + sections;

}



function groupScreenshots(files) {

  const groups = files.reduce((groups, src) => {

    const name = src.split('/').pop() || src;

    const device = name.startsWith('mobile-') ? 'mobile' : 'desktop';

    groups[device].push(src);

    return groups;

  }, { desktop: [], mobile: [] });

  groups.desktop = sortScreenshotFiles(groups.desktop);

  groups.mobile = sortScreenshotFiles(groups.mobile);

  return groups;

}

function sortScreenshotFiles(files) {

  const remaining = [...files].sort(compareScreenshotNames);

  const prioritized = ['topic-list', 'composer-new-topic', 'topic-rich-content'].flatMap((suffix) => {

    const index = remaining.findIndex((src) => screenshotBaseName(src).endsWith(suffix));

    if (index === -1) return [];

    return remaining.splice(index, 1);

  });

  return prioritized.concat(remaining);

}

function compareScreenshotNames(left, right) {

  return screenshotFileName(left).localeCompare(screenshotFileName(right));

}

function screenshotBaseName(src) {

  return screenshotFileName(src).replace(/.png$/, '');

}

function screenshotFileName(src) {

  return src.split('/').pop() || src;

}



function renderCarouselSection(device, files, cacheBust) {

  if (!files.length) return '';

  const shots = files.map((src) => {

    const name = src.split('/').pop() || src;

    const lightboxIndex = lightboxItems.findIndex((item) => item.src === src);

    const url = src + '?v=' + cacheBust;

    return '<li class="shot-row"><figure><a class="shot-link" href="' + escapeHtml(url) + '" data-lightbox-index="' + lightboxIndex + '" aria-label="Open ' + escapeHtml(name) + ' full size"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name) + '" loading="lazy"></a><figcaption>' + escapeHtml(name) + '</figcaption></figure></li>';

  }).join('');

  return '<section class="device-section device-section--' + escapeHtml(device) + '">' +

    '<div class="device-head"><h3>' + escapeHtml(device) + '</h3><span>' + files.length + ' screenshots</span></div>' +

    '<ol class="screenshot-carousel">' + shots + '</ol>' +

  '</section>';

}



function previewImage(src, themeName, cacheBust) {

  if (!src) return '<div class="missing">missing screenshot</div>';

  return '<figure><img src="' + escapeHtml(src) + '?v=' + cacheBust + '" alt="' + escapeHtml(themeName) + ' topic list" loading="lazy"></figure>';

}



function ensureLightbox() {

  let lightbox = document.querySelector('#lightbox');

  if (lightbox) return lightbox;

  lightbox = document.createElement('div');

  lightbox.id = 'lightbox';

  lightbox.className = 'lightbox';

  lightbox.setAttribute('aria-hidden', 'true');

  lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close full-size screenshot">×</button>' +

    '<button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous screenshot">‹</button>' +

    '<figure class="lightbox-figure"><img class="lightbox-image" alt=""><figcaption class="lightbox-caption"></figcaption></figure>' +

    '<button class="lightbox-nav lightbox-next" type="button" aria-label="Next screenshot">›</button>';

  document.body.appendChild(lightbox);

  lightbox.addEventListener('click', (event) => {

    if (event.target === lightbox || event.target.closest('.lightbox-close')) closeLightbox();

    if (event.target.closest('.lightbox-prev')) showLightboxItem(lightboxIndex - 1);

    if (event.target.closest('.lightbox-next')) showLightboxItem(lightboxIndex + 1);

  });

  return lightbox;

}



function openLightbox(index) {

  if (!lightboxItems.length || index < 0) return;

  const lightbox = ensureLightbox();

  lightbox.classList.add('is-open');

  lightbox.setAttribute('aria-hidden', 'false');

  document.body.classList.add('has-lightbox');

  showLightboxItem(index);

}



function closeLightbox() {

  const lightbox = document.querySelector('#lightbox');

  if (!lightbox) return;

  lightbox.classList.remove('is-open');

  lightbox.setAttribute('aria-hidden', 'true');

  document.body.classList.remove('has-lightbox');

}



function showLightboxItem(index) {

  if (!lightboxItems.length) return;

  lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;

  const item = lightboxItems[lightboxIndex];

  const lightbox = ensureLightbox();

  const image = lightbox.querySelector('.lightbox-image');

  const caption = lightbox.querySelector('.lightbox-caption');

  image.src = item.url;

  image.alt = item.name;

  caption.textContent = item.device + ' · ' + item.name + ' · ' + (lightboxIndex + 1) + ' / ' + lightboxItems.length;

}



function escapeHtml(value) {

  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

}



app.addEventListener('click', (event) => {

  const link = event.target.closest('.shot-link');

  if (!link) return;

  event.preventDefault();

  openLightbox(Number(link.dataset.lightboxIndex));

});



window.addEventListener('keydown', (event) => {

  const lightbox = document.querySelector('#lightbox.is-open');

  if (!lightbox) return;

  if (event.key === 'Escape') closeLightbox();

  if (event.key === 'ArrowLeft') showLightboxItem(lightboxIndex - 1);

  if (event.key === 'ArrowRight') showLightboxItem(lightboxIndex + 1);

});



window.addEventListener('hashchange', render);

loadManifest().then((data) => { manifest = data; render(); }).catch((error) => {

  summary.textContent = error.message;

  app.className = 'empty';

  app.textContent = 'Run bin/screenshot-themes to generate screenshots and manifest data.';

});
