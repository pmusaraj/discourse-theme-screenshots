# frozen_string_literal: true

require "fileutils"
require "pathname"

module ThemeScreenshots
  class OutputCollector
    def initialize(discourse_repo:, out_dir:, screenshots_dir: nil)
      @discourse_repo = File.expand_path(discourse_repo)
      @out_dir = File.expand_path(out_dir)
      @screenshots_dir = screenshots_dir && File.expand_path(screenshots_dir)
    end

    def collect(theme:, since:)
      raw_dir = File.join(@out_dir, "themes", theme.id, "raw")
      FileUtils.rm_rf(raw_dir)
      FileUtils.mkdir_p(raw_dir)

      files = screenshot_dir_pngs(theme)
      files = recent_pngs(since).select { |path| File.basename(path).include?(theme.id) } if files.empty?
      files = recent_pngs(since).select { |path| likely_theme_output?(path) } if files.empty?
      copied = files.uniq.sort.map do |path|
        destination = File.join(raw_dir, File.basename(path))
        FileUtils.cp(path, destination)
        relative_path(destination)
      end

      screenshots = representative_screenshots(copied, theme)
      warnings = []
      warnings << "No screenshots copied from Discourse output" if copied.empty?
      { theme_id: theme.id, screenshots: screenshots, files: copied, warnings: warnings }
    end

    private

    def screenshot_dir_pngs(theme)
      return [] unless @screenshots_dir

      Dir.glob(File.join(@screenshots_dir, theme.id, "raw", "*.png"))
    end

    def recent_pngs(since)
      pattern = File.join(@discourse_repo, "**", "*.png")
      Dir.glob(pattern).select { |path| File.file?(path) && File.mtime(path) >= since }
    end

    def likely_theme_output?(path)
      path.include?("screenshot") || path.include?("theme")
    end

    def representative_screenshots(files, theme)
      by_mode = {}
      theme.modes.each do |mode|
        selected = files.find { |path| basename(path).match?(/desktop.*#{Regexp.escape(mode)}.*topic-list/i) } ||
          files.find { |path| basename(path).match?(/#{Regexp.escape(mode)}.*topic-list/i) } ||
          files.find { |path| basename(path).match?(/#{Regexp.escape(mode)}/i) }
        by_mode[mode] = selected if selected
      end
      by_mode
    end

    def basename(path)
      File.basename(path)
    end

    def relative_path(path)
      Pathname(path).relative_path_from(Pathname(@out_dir)).to_s
    end
  end
end
