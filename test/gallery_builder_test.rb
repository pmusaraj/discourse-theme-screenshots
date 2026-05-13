# frozen_string_literal: true

require "minitest/autorun"
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
end
