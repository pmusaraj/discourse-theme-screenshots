# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "json"
require "open3"
require "rbconfig"
require_relative "../lib/theme_screenshots/config"
require_relative "../lib/theme_screenshots/gallery_preset"

class GalleryRolloutTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  CONFIG = File.join(ROOT, "config/github.yml")
  PRESET = ThemeScreenshots::GalleryPreset

  def test_desktop_only_shots_are_not_required_on_mobile
    mobile = PRESET::COMMON.map { |label| "mobile-example-light-#{label}.png" }
    assert_empty PRESET.missing(mobile, devices: ["mobile"], modes: ["light"])
    assert_includes PRESET.missing(mobile, devices: ["desktop"], modes: ["light"]), "desktop/light/admin-dashboard"
  end

  def test_three_shards_cover_all_themes_and_incomplete_gallery_is_rejected
    theme_ids = ThemeScreenshots::ConfigLoader.load(CONFIG).themes.map(&:id)
    Dir.mktmpdir do |dir|
      shards = File.join(dir, "shards")
      out = File.join(dir, "out")
      manifests = (0..2).map do |index|
        root = File.join(shards, "shard-#{index}")
        entries = theme_ids.select.with_index { |_id, i| i % 3 == index }.map do |id|
          files = %w[desktop mobile].flat_map do |device|
            labels = device == "desktop" ? PRESET::LABELS : PRESET::COMMON
            labels.map do |label|
              file = "themes/#{id}/raw/#{device}-#{id}-light-#{label}.png"
              FileUtils.mkdir_p(File.dirname(File.join(root, file)))
              File.write(File.join(root, file), "test")
              file
            end
          end
          { id: id, status: "ok", warnings: [], rawFiles: files, screenshots: { light: files.first } }
        end
        FileUtils.mkdir_p(File.join(root, "data"))
        path = File.join(root, "data", "manifest.json")
        File.write(path, JSON.generate(screenshot: { subset: "gallery", devices: "desktop,mobile" }, themes: entries))
        path
      end

      command = [RbConfig.ruby, File.join(ROOT, "bin/merge-gallery"), CONFIG, shards, out]
      output, status = Open3.capture2e(*command)
      assert status.success?, output
      manifest = JSON.parse(File.read(File.join(out, "data", "manifest.json")))
      assert_equal theme_ids, manifest.fetch("themes").map { |entry| entry.fetch("id") }
      assert_equal theme_ids.size * 12, Dir.glob(File.join(out, "themes", "*", "raw", "*.png")).size

      broken = JSON.parse(File.read(manifests.first))
      broken.fetch("themes").first.fetch("rawFiles").reject! { |file| file.end_with?("-admin-dashboard.png") }
      File.write(manifests.first, JSON.generate(broken))
      output, status = Open3.capture2e(*command)
      refute status.success?
      assert_includes output, "desktop/light/admin-dashboard"
    end
  end
end
