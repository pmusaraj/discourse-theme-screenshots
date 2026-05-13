# frozen_string_literal: true

require "minitest/autorun"
require_relative "../lib/theme_screenshots/config"
require_relative "../lib/theme_screenshots/discourse_runner"

class DiscourseRunnerTest < Minitest::Test
  def test_command_matches_remote_theme_core_spec_contract
    theme = ThemeScreenshots::Theme.new(
      id: "minima",
      name: "Minima",
      source: { "type" => "git", "url" => "https://github.com/Discourse/minima.git" },
      modes: %w[light dark]
    )
    runner = ThemeScreenshots::DiscourseRunner.new(repo_path: "/tmp/discourse", subset: "topic")

    assert_equal "LOAD_PLUGINS=1 TAKE_SCREENSHOTS=1 SCREENSHOTS_SUBSET=\"topic\" SCREENSHOTS_THEMES=__remote_theme_only__ SCREENSHOTS_MODES=light,dark SCREENSHOTS_THEME_URL=https://github.com/Discourse/minima.git bin/rspec spec/system/theme_screenshots_spec.rb", runner.command_for(theme)
  end

  def test_command_supports_core_themes_and_explicit_screenshots_dir
    theme = ThemeScreenshots::Theme.new(
      id: "foundation",
      name: "Foundation",
      source: { "type" => "core", "theme" => "foundation" },
      modes: %w[light]
    )
    runner = ThemeScreenshots::DiscourseRunner.new(
      repo_path: "/tmp/discourse",
      subset: "topic",
      screenshots_dir: "/tmp/theme-output"
    )

    assert_equal "LOAD_PLUGINS=1 TAKE_SCREENSHOTS=1 SCREENSHOTS_SUBSET=\"topic\" SCREENSHOTS_THEMES=foundation SCREENSHOTS_MODES=light SCREENSHOTS_DIR=/tmp/theme-output/foundation bin/rspec spec/system/theme_screenshots_spec.rb", runner.command_for(theme)
  end
end
