# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require_relative "../lib/theme_screenshots/config"

class ConfigTest < Minitest::Test
  def test_loads_theme_urls_without_requiring_local_clones
    Dir.mktmpdir do |dir|
      path = File.join(dir, "themes.yml")
      File.write(path, <<~YAML)
        discourse:
          repo_path: /tmp/discourse
        themes:
          - id: minima
            name: Minima
            source:
              type: git
              url: https://github.com/Discourse/minima.git
      YAML

      config = ThemeScreenshots::ConfigLoader.load(path)
      assert_equal "/tmp/discourse", config.discourse["repo_path"]
      assert_equal "https://github.com/Discourse/minima.git", config.themes.first.theme_url
      assert_equal %w[light], config.themes.first.modes
      assert_equal "topic", config.screenshot["subset"]
    end
  end

  def test_loads_local_theme_paths
    Dir.mktmpdir do |dir|
      path = File.join(dir, "themes.yml")
      File.write(path, <<~YAML)
        discourse:
          repo_path: /tmp/discourse
        themes:
          - id: zleek
            name: zleek
            source:
              type: local
              path: /tmp/discourse-zleek
      YAML

      config = ThemeScreenshots::ConfigLoader.load(path)
      assert_equal "local", config.themes.first.source["type"]
      assert_equal "/tmp/discourse-zleek", config.themes.first.theme_url
      assert_equal "local:/tmp/discourse-zleek", config.themes.first.source_label
    end
  end

  def test_loads_core_theme_entries_for_github_actions
    Dir.mktmpdir do |dir|
      path = File.join(dir, "themes.yml")
      File.write(path, <<~YAML)
        discourse:
          repo_path: ../discourse
        themes:
          - id: foundation
            name: Foundation
            source:
              type: core
      YAML

      config = ThemeScreenshots::ConfigLoader.load(path)
      assert_equal "core", config.themes.first.source["type"]
      assert_equal "foundation", config.themes.first.theme_url
      assert_equal "core:foundation", config.themes.first.source_label
    end
  end
end
