# frozen_string_literal: true

require "minitest/autorun"
require_relative "../lib/theme_screenshots/config"
require_relative "../lib/theme_screenshots/manifest"

class ManifestTest < Minitest::Test
  def test_manifest_includes_raw_files_and_representative_screenshots
    theme = ThemeScreenshots::Theme.new(id: "minima", name: "Minima", source: { "type" => "git", "url" => "https://example.com/minima.git" }, modes: %w[light dark])
    config = ThemeScreenshots::Config.new(path: "config.yml", discourse: { "repo_path" => "/tmp/discourse" }, screenshot: { "subset" => "topic" }, themes: [theme])

    manifest = ThemeScreenshots::Manifest.build(config: config, generated_at: "2026-01-01T00:00:00Z", results: [{ theme_id: "minima", screenshots: { "light" => "themes/minima/raw/desktop-minima-light-topic-list.png" }, files: ["themes/minima/raw/desktop-minima-light-topic-list.png"], warnings: [] }])

    assert_equal "topic", manifest[:screenshot][:subset]
    assert_equal "themes/minima/raw/desktop-minima-light-topic-list.png", manifest[:themes].first[:screenshots]["light"]
    assert_equal ["themes/minima/raw/desktop-minima-light-topic-list.png"], manifest[:themes].first[:rawFiles]
  end
end
