# frozen_string_literal: true

require "optparse"
require_relative "config"
require_relative "discourse_runner"
require_relative "gallery_builder"
require_relative "gallery_preset"
require_relative "manifest"
require_relative "output_collector"

module ThemeScreenshots
  class CLI
    def initialize(argv)
      @argv = argv.dup
      @options = { config: "config/themes.yml", out: "public", dry_run: false, subset: nil, devices: nil, theme: nil, shard: nil }
    end

    def run
      parse!
      config = ConfigLoader.load(@options[:config])
      config.screenshot["subset"] = @options[:subset] if @options[:subset]
      config.screenshot["devices"] = @options[:devices] if @options[:devices]
      themes = config.themes.select { |theme| @options[:theme].nil? || theme.id == @options[:theme] }
      if (shard = @options[:shard])
        raise ArgumentError, "--shard must be 0, 1, or 2 and cannot be combined with --theme" unless (0..2).cover?(shard) && !@options[:theme]
        themes = themes.select.with_index { |_theme, index| index % 3 == shard }
      end
      raise ArgumentError, "No themes selected#{@options[:theme] ? " for #{@options[:theme]}" : ""}" if themes.empty?

      screenshots_dir = config.screenshot["dir"] || File.join(".cache", "discourse-screenshots")
      runner = DiscourseRunner.new(
        repo_path: config.discourse.fetch("repo_path"),
        subset: config.screenshot["subset"],
        devices: config.screenshot["devices"],
        container: config.discourse["container"],
        container_repo_path: config.discourse["container_repo_path"] || "/var/discourse",
        screenshots_dir: screenshots_dir
      )

      if @options[:dry_run]
        puts "Theme screenshot dry run"
        puts "Discourse repo: #{config.discourse.fetch("repo_path")}"
        puts "Output: #{File.expand_path(@options[:out])}"
        puts "Subset: #{config.screenshot["subset"].to_s.empty? ? "all" : config.screenshot["subset"]}"
        puts "Devices: #{config.screenshot["devices"]}"
        themes.each { |theme| puts "Command: #{runner.command_for(theme)}" }
        return
      end

      collector = OutputCollector.new(discourse_repo: config.discourse.fetch("repo_path"), out_dir: @options[:out], screenshots_dir: screenshots_dir)
      results = []
      themes.each do |theme|
        puts "Capturing #{theme.id} from #{theme.theme_url}"
        result = runner.run(theme)
        puts "Finished #{theme.id} in #{(result.finished_at - result.started_at).round(1)}s"
        collected = collector.collect(theme: theme, since: result.started_at)
        collected[:success] = result.success
        collected[:warnings] += ["RSpec exited with status #{result.status}"] unless result.success
        if config.screenshot["subset"] == GalleryPreset::NAME
          missing = GalleryPreset.missing(collected.fetch(:files), devices: config.screenshot.fetch("devices").split(",").map(&:strip), modes: theme.modes)
          unless missing.empty?
            collected[:success] = false
            collected[:warnings] << "Missing gallery screenshots: #{missing.join(', ')}"
          end
        end
        results << collected
      end

      manifest = Manifest.build(config: Config.new(path: config.path, discourse: config.discourse, screenshot: config.screenshot, themes: themes), results: results)
      Manifest.write(File.join(@options[:out], "data", "manifest.json"), manifest)
      GalleryBuilder.new(out_dir: @options[:out]).build
      puts "Wrote #{themes.length} theme(s) to #{@options[:out]}"
      if config.screenshot["subset"] == GalleryPreset::NAME
        failures = results.reject { |result| result[:success] }
        raise failures.map { |result| "#{result[:theme_id]}: #{result[:warnings].join('; ')}" }.join("\n") unless failures.empty?
      end
    rescue StandardError => e
      warn e.message
      exit 1
    end

    private

    def parse!
      @argv.shift if @argv.first == "--"
      OptionParser.new do |opts|
        opts.banner = "Usage: bin/screenshot-themes [options]"
        opts.on("--config PATH", "YAML config path") { |value| @options[:config] = value }
        opts.on("--out DIR", "output directory") { |value| @options[:out] = value }
        opts.on("--theme ID", "only run one theme id") { |value| @options[:theme] = value }
        opts.on("--shard INDEX", Integer, "run shard 0, 1, or 2") { |value| @options[:shard] = value }
        opts.on("--subset LABEL", "SCREENSHOTS_SUBSET value") { |value| @options[:subset] = value }
        opts.on("--devices LIST", "SCREENSHOTS_DEVICES value") { |value| @options[:devices] = value }
        opts.on("--dry-run", "print commands without running rspec") { @options[:dry_run] = true }
      end.parse!(@argv)
    end
  end
end
