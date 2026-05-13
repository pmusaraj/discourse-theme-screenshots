# frozen_string_literal: true

require "fileutils"

module ThemeScreenshots
  class GalleryBuilder
    INDEX_HTML = <<~HTML
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Discourse Theme Screenshots</title>
        <link rel="stylesheet" href="styles.css?v=source-ratio-carousel-20260513">
      </head>
      <body>
        <header class="site-header">
          <p class="eyebrow">Discourse theme screenshots</p>
          <h1>Theme screenshots</h1>
          <p id="summary">Loading manifest…</p>
        </header>
        <main id="app" aria-live="polite"></main>
        <script src="app.js?v=source-ratio-carousel-20260513"></script>
      </body>
      </html>

    HTML

    APP_JS = <<~JS

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

        return files.reduce((groups, src) => {

          const name = src.split('/').pop() || src;

          const device = name.startsWith('mobile-') ? 'mobile' : 'desktop';

          groups[device].push(src);

          return groups;

        }, { desktop: [], mobile: [] });

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


    JS

    STYLES_CSS = <<~CSS

      :root {

        color-scheme: dark;

        --bg: #070707;

        --panel: #0e0e0e;

        --panel-alt: #111;

        --line: #2a2a2a;

        --text: #d8d8d8;

        --muted: #858585;

        --accent: #f2f2f2;

        --warn: #c9a227;

      }

      

      * { box-sizing: border-box; }

      

      html { background: var(--bg); }

      

      body {

        margin: 0;

        padding: 24px;

        background: var(--bg);

        color: var(--text);

        font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

      }

      

      .site-header {

        border-bottom: 1px solid var(--line);

        margin-bottom: 20px;

        padding-bottom: 14px;

      }

      

      .eyebrow, #summary, .theme-id, .source, figcaption { color: var(--muted); }

      

      .eyebrow {

        margin: 0 0 6px;

        text-transform: uppercase;

        letter-spacing: .08em;

        font-size: 11px;

      }

      

      h1, h2, h3 {

        margin: 0;

        color: var(--accent);

        font-weight: 500;

        letter-spacing: -.02em;

      }

      

      h1 { font-size: 18px; }

      h2 { font-size: 15px; }

      h3 {

        font-size: 13px;

        text-transform: uppercase;

        letter-spacing: .08em;

      }

      

      #summary { margin: 8px 0 0; font-size: 12px; }

      

      a { color: inherit; text-decoration: none; }

      a:hover { color: #fff; text-decoration: underline; text-underline-offset: 3px; }

      

      .theme-grid {

        display: grid;

        grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr));

        gap: 14px;

      }

      

      .theme-card, .detail-head, .empty {

        background: var(--panel);

        border: 1px solid var(--line);

      }

      

      .card-link { display: block; padding: 12px; }

      

      .card-head, .detail-head {

        display: flex;

        justify-content: space-between;

        gap: 12px;

        align-items: baseline;

      }

      

      .card-head span, .status, .device-head span {

        color: var(--muted);

        font-size: 11px;

        text-transform: uppercase;

        letter-spacing: .08em;

      }

      

      .theme-id { margin: 3px 0 12px; font-size: 12px; }

      

      .theme-preview {

        display: block;

      }

      

      figure { margin: 0; }

      

      img {

        display: block;

        width: 100%;

        height: auto;

        border: 1px solid var(--line);

        background: #000;

      }

      

      .theme-preview img {

        aspect-ratio: 16 / 9;

        object-fit: cover;

      }

      

      figcaption { margin-top: 6px; font-size: 11px; }

      

      .back { margin-bottom: 14px; color: var(--muted); }

      

      .theme-detail { max-width: none; }

      

      .detail-head { padding: 12px; margin-bottom: 10px; }

      

      .source {

        margin: 0 0 14px;

        overflow-wrap: anywhere;

        font-size: 12px;

      }

      

      .warnings {

        margin: 0 0 14px;

        padding-left: 18px;

        color: var(--warn);

      }

      

      .device-section {

        margin-top: 18px;

      }

      

      .device-head {

        align-items: baseline;

        border-bottom: 1px solid var(--line);

        display: flex;

        gap: 12px;

        justify-content: space-between;

        margin-bottom: 12px;

        padding-bottom: 8px;

      }

      

      .screenshot-carousel {

        display: flex;

        gap: 2em;

        list-style: none;

        margin: 0;

        overflow-x: auto;

        overscroll-behavior-x: contain;

        padding: 0 0 12px;

        scroll-snap-type: x proximity;

      }

      

      .shot-row {

        flex: 0 0 min(62vw, 672px);

        padding: 0;

        scroll-snap-align: start;

      }

      

      .shot-row img {

        aspect-ratio: 7 / 6;

        object-fit: cover;

      }

      

      .device-section--mobile .shot-row {

        flex-basis: min(56vw, 195px);

      }

      

      .device-section--mobile .shot-row img {

        aspect-ratio: 13 / 40;

        max-height: 600px;

      }

      

      .shot-link {

        cursor: zoom-in;

        display: block;

      }

      

      body.has-lightbox { overflow: hidden; }

      

      .lightbox {

        align-items: center;

        background: rgba(0, 0, 0, .88);

        display: none;

        gap: 18px;

        inset: 0;

        justify-content: center;

        padding: 28px 70px;

        position: fixed;

        z-index: 1000;

      }

      

      .lightbox.is-open { display: flex; }

      

      .lightbox-figure {

        display: grid;

        gap: 10px;

        max-height: 100%;

        max-width: 100%;

      }

      

      .lightbox-image {

        border-color: #444;

        height: auto;

        max-height: calc(100vh - 110px);

        max-width: calc(100vw - 180px);

        object-fit: contain;

        width: auto;

      }

      

      .lightbox-caption {

        color: #c8c8c8;

        font-size: 12px;

        margin: 0;

        text-align: center;

      }

      

      .lightbox-close,

      .lightbox-nav {

        appearance: none;

        background: rgba(20, 20, 20, .9);

        border: 1px solid #444;

        color: #f2f2f2;

        cursor: pointer;

        font: inherit;

        line-height: 1;

      }

      

      .lightbox-close:hover,

      .lightbox-nav:hover,

      .lightbox-close:focus,

      .lightbox-nav:focus {

        background: #222;

        outline: 2px solid #eee;

        outline-offset: 2px;

      }

      

      .lightbox-close {

        font-size: 28px;

        height: 44px;

        position: fixed;

        right: 20px;

        top: 20px;

        width: 44px;

      }

      

      .lightbox-nav {

        border-radius: 999px;

        font-size: 42px;

        height: 54px;

        position: fixed;

        top: 50%;

        transform: translateY(-50%);

        width: 54px;

      }

      

      .lightbox-prev { left: 20px; }

      .lightbox-next { right: 20px; }

      

      .missing {

        border: 1px solid var(--line);

        color: var(--muted);

        min-height: 160px;

        display: grid;

        place-items: center;

      }

      

      @media (max-width: 760px) {

        body { padding: 14px; }

        .lightbox { padding: 56px 14px 22px; }

        .lightbox-image { max-height: calc(100vh - 130px); max-width: 100%; }

        .lightbox-nav { height: 44px; width: 44px; font-size: 34px; }

        .lightbox-prev { left: 10px; }

        .lightbox-next { right: 10px; }

        .lightbox-close { right: 10px; top: 10px; }

      }


    CSS

    def initialize(out_dir: "public")
      @out_dir = out_dir
    end

    def build
      FileUtils.mkdir_p(File.join(@out_dir, "data"))
      File.write(File.join(@out_dir, "index.html"), INDEX_HTML)
      File.write(File.join(@out_dir, "app.js"), APP_JS)
      File.write(File.join(@out_dir, "styles.css"), STYLES_CSS)
    end
  end
end

