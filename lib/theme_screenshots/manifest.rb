# frozen_string_literal: true

require "fileutils"
require "json"
require "time"

module ThemeScreenshots
  class Manifest
    def self.build(config:, results:, generated_at: Time.now.utc.iso8601)
      by_theme = results.to_h { |result| [result[:theme_id], result] }
      {
        generatedAt: generated_at,
        discourseRepo: config.discourse["repo_path"],
        screenshot: {
          width: config.screenshot["width"],
          height: config.screenshot["height"],
          format: "png",
          subset: config.screenshot["subset"] || "topic"
        },
        themes: config.themes.map do |theme|
          result = by_theme[theme.id] || { screenshots: {}, warnings: ["No result recorded"] }
          {
            id: theme.id,
            name: theme.name,
            source: theme.source_label,
            status: result[:success] == false ? "error" : "ok",
            screenshots: result[:screenshots] || {},
            rawFiles: result[:files] || [],
            warnings: result[:warnings] || []
          }
        end
      }
    end

    def self.write(path, manifest)
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, JSON.pretty_generate(manifest) + "
")
      manifest
    end
  end
end
