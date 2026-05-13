# frozen_string_literal: true

require "json"

module ThemeScreenshots
  class OutputVerifier
    def initialize(out_dir: "public")
      @out_dir = out_dir
    end

    def verify
      errors = []
      warnings = []
      %w[index.html app.js styles.css].each do |asset|
        errors << "Missing gallery asset: #{asset}" unless File.exist?(File.join(@out_dir, asset))
      end

      manifest_path = File.join(@out_dir, "data", "manifest.json")
      manifest = nil
      if File.exist?(manifest_path)
        manifest = JSON.parse(File.read(manifest_path))
      else
        errors << "Missing public/data/manifest.json"
      end

      Array(manifest && manifest["themes"]).each do |theme|
        theme.fetch("screenshots", {}).each do |mode, relative_path|
          path = File.join(@out_dir, relative_path)
          errors << "Missing screenshot for #{theme["id"]} #{mode}: #{relative_path}" unless File.exist?(path)
        end
        warnings.concat(Array(theme["warnings"]).map { |warning| "#{theme["id"]}: #{warning}" })
      end

      { ok: errors.empty?, errors: errors, warnings: warnings }
    rescue JSON::ParserError => e
      { ok: false, errors: ["Invalid manifest JSON: #{e.message}"], warnings: warnings }
    end
  end
end
