# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "open3"
require "tmpdir"
require_relative "../lib/theme_screenshots/gallery_builder"

class GalleryBuilderTest < Minitest::Test
  def test_homepage_renders_only_light_preview
    Dir.mktmpdir do |dir|
      ThemeScreenshots::GalleryBuilder.new(out_dir: dir).build
      app_js = File.read(File.join(dir, "app.js"))
      styles = File.read(File.join(dir, "styles.css"))
      index = File.read(File.join(dir, "index.html"))

      assert_includes app_js, "const preview = theme.screenshots?.light;"
      refute_includes app_js, "const dark = theme.screenshots?.dark;"
      refute_includes app_js, "preview-pair"
      refute_includes styles, "preview-pair"
      refute_includes index, "regex-fix-20260507"
    end
  end

  def test_theme_detail_renders_desktop_and_mobile_carousels
    Dir.mktmpdir do |dir|
      ThemeScreenshots::GalleryBuilder.new(out_dir: dir).build
      app_js = File.read(File.join(dir, "app.js"))
      styles = File.read(File.join(dir, "styles.css"))

      assert_includes app_js, "renderCarouselSection(device, grouped[device], cacheBust)"
      assert_includes styles, ".screenshot-carousel"
      assert_includes styles, "gap: 2em"
      assert_includes styles, "overflow-x: auto"
      assert_includes styles, ".shot-row {"
      assert_includes styles, "flex: 0 0 min(62vw, 672px)"
      assert_includes styles, "padding: 0"
      refute_includes styles, ".theme-card, .detail-head, .shot-row, .empty"
      assert_includes styles, ".shot-row img"
      assert_includes styles, "aspect-ratio: 7 / 6"
      assert_includes styles, "object-fit: cover"
      assert_includes styles, ".device-section--mobile .shot-row {"
      assert_includes styles, "flex-basis: min(56vw, 195px)"
      assert_includes styles, ".device-section--mobile .shot-row img"
      assert_includes styles, "aspect-ratio: 13 / 40"
      assert_includes styles, "max-height: 600px"
    end
  end

  def test_group_screenshots_prioritizes_topic_review_order_then_alphabetical
    Dir.mktmpdir do |dir|
      ThemeScreenshots::GalleryBuilder.new(out_dir: dir).build
      app_js_path = File.join(dir, "app.js")
      runner_path = File.join(dir, "order-test.js")
      files = [
        "themes/acme/raw/desktop-acme-light-wizard.png",
        "themes/acme/raw/desktop-acme-light-topic-rich-content.png",
        "themes/acme/raw/desktop-acme-light-admin-themes.png",
        "themes/acme/raw/desktop-acme-light-composer-new-topic.png",
        "themes/acme/raw/desktop-acme-light-topic-list.png",
        "themes/acme/raw/desktop-acme-dark-topic-list.png",
        "themes/acme/raw/desktop-acme-dark-composer-new-topic.png",
        "themes/acme/raw/desktop-acme-dark-topic-rich-content.png",
        "themes/acme/raw/desktop-acme-light-categories.png",
        "themes/acme/raw/mobile-acme-light-wizard.png",
        "themes/acme/raw/mobile-acme-light-topic-rich-content.png",
        "themes/acme/raw/mobile-acme-light-composer-new-topic.png",
        "themes/acme/raw/mobile-acme-light-categories.png"
      ]

      File.write(runner_path, <<~JS)
        const fs = require('fs');
        const vm = require('vm');
        const appNode = { addEventListener() {}, className: '', innerHTML: '', textContent: '' };
        const context = {
          document: {
            querySelector: () => appNode,
            createElement: () => ({ setAttribute() {}, addEventListener() {}, querySelector() { return null; } }),
            body: { appendChild() {}, classList: { add() {}, remove() {} } }
          },
          window: { addEventListener() {} },
          location: { hash: '' },
          fetch: () => new Promise(() => {})
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(#{app_js_path.to_json}, 'utf8'), context);
        const grouped = context.groupScreenshots(#{files.to_json});
        console.log(JSON.stringify({ desktop: grouped.desktop, mobile: grouped.mobile }));
      JS

      stdout, stderr, status = Open3.capture3("node", runner_path)
      assert status.success?, stderr

      grouped = JSON.parse(stdout)
      assert_equal [
        "desktop-acme-dark-topic-list.png",
        "desktop-acme-dark-composer-new-topic.png",
        "desktop-acme-dark-topic-rich-content.png",
        "desktop-acme-light-admin-themes.png",
        "desktop-acme-light-categories.png",
        "desktop-acme-light-composer-new-topic.png",
        "desktop-acme-light-topic-list.png",
        "desktop-acme-light-topic-rich-content.png",
        "desktop-acme-light-wizard.png"
      ], grouped.fetch("desktop").map { |src| File.basename(src) }
      assert_equal [
        "mobile-acme-light-composer-new-topic.png",
        "mobile-acme-light-topic-rich-content.png",
        "mobile-acme-light-categories.png",
        "mobile-acme-light-wizard.png"
      ], grouped.fetch("mobile").map { |src| File.basename(src) }
    end
  end
end
