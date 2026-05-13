# frozen_string_literal: true

require "pathname"
require "yaml"

module ThemeScreenshots
  Theme = Struct.new(:id, :name, :source, :modes, keyword_init: true) do
    def theme_url
      source["url"] || source["path"] || source["theme"]
    end

    def core?
      source["type"] == "core"
    end

    def source_label
      case source["type"]
      when "git" then "git:#{source["url"]}#{source["ref"] ? "##{source["ref"]}" : ""}"
      when "local" then "local:#{source["path"]}"
      when "core" then "core:#{source["theme"] || id}"
      else source["type"].to_s
      end
    end
  end

  Config = Struct.new(:path, :discourse, :screenshot, :themes, keyword_init: true)

  class ConfigLoader
    DEFAULT_SCREENSHOT = {
      "width" => 2560,
      "height" => 1440,
      "format" => "png",
      "max_bytes" => 1_048_576,
      "subset" => "topic"
    }.freeze

    def self.load(path = "config/themes.yml")
      new(path).load
    end

    def initialize(path)
      @path = Pathname(path).expand_path
    end

    def load
      raw = YAML.safe_load(File.read(@path)) || {}
      errors = []
      discourse = raw["discourse"] || {}
      errors << "discourse.repo_path is required" if blank?(discourse["repo_path"])
      screenshot = DEFAULT_SCREENSHOT.merge(raw["screenshot"] || {})
      themes = Array(raw["themes"]).map.with_index { |theme, index| normalize_theme(theme || {}, index, errors) }
      errors << "themes must be a non-empty array" if themes.empty?
      raise ArgumentError, "Invalid config: #{errors.join("; ")}" if errors.any?

      Config.new(path: @path.to_s, discourse: discourse, screenshot: screenshot, themes: themes)
    end

    private

    def normalize_theme(theme, index, errors)
      label = "theme #{index + 1}"
      errors << "#{label} id is required" if blank?(theme["id"])
      errors << "#{label} name is required" if blank?(theme["name"])
      source = theme["source"] || {}
      source_type = source["type"] || "git"
      case source_type
      when "git"
        errors << "#{label} source.url is required" if blank?(source["url"])
      when "local"
        errors << "#{label} source.path is required" if blank?(source["path"])
      when "core"
        source["theme"] ||= theme["id"]
      else
        errors << "#{label} source.type must be git, local, or core"
      end
      Theme.new(
        id: theme["id"],
        name: theme["name"],
        source: source.merge("type" => source_type),
        modes: Array(theme["modes"] || %w[light])
      )
    end

    def blank?(value)
      value.nil? || value.to_s.strip.empty?
    end
  end
end
