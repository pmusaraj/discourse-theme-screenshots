# frozen_string_literal: true

require "fileutils"
require "open3"
require "shellwords"
require "time"

module ThemeScreenshots
  class DiscourseRunner
    SPEC_PATH = "spec/system/theme_screenshots_spec.rb"

    Result = Struct.new(:theme, :success, :status, :output, :started_at, :finished_at, keyword_init: true)

    def initialize(repo_path:, subset: nil, devices: nil, env: {}, io: $stdout, container: nil, container_repo_path: "/var/discourse", screenshots_dir: nil)
      @repo_path = File.expand_path(repo_path)
      @subset = subset
      @devices = devices
      @env = env
      @io = io
      @container = container
      @container_repo_path = container_repo_path
      @screenshots_dir = screenshots_dir && File.expand_path(screenshots_dir)
    end

    def command_for(theme)
      env = env_for(theme)
      parts = [
        "LOAD_PLUGINS=#{env.fetch("LOAD_PLUGINS")}",
        "TAKE_SCREENSHOTS=#{env.fetch("TAKE_SCREENSHOTS")}",
        "SCREENSHOTS_THEMES=#{Shellwords.escape(env.fetch("SCREENSHOTS_THEMES"))}",
        "SCREENSHOTS_MODES=#{Shellwords.escape(env.fetch("SCREENSHOTS_MODES"))}"
      ]
      parts << "SCREENSHOTS_SUBSET=#{Shellwords.escape(env.fetch("SCREENSHOTS_SUBSET"))}" if env["SCREENSHOTS_SUBSET"]
      parts << "SCREENSHOTS_DEVICES=#{Shellwords.escape(env.fetch("SCREENSHOTS_DEVICES"))}" if env["SCREENSHOTS_DEVICES"]
      parts << "SCREENSHOTS_THEME_URL=#{Shellwords.escape(env.fetch("SCREENSHOTS_THEME_URL"))}" if env["SCREENSHOTS_THEME_URL"]
      parts << "SCREENSHOTS_DIR=#{Shellwords.escape(env.fetch("SCREENSHOTS_DIR"))}" if env["SCREENSHOTS_DIR"]
      "#{parts.join(" ")} bin/rspec #{SPEC_PATH}"
    end

    def run(theme)
      theme = prepare_local_theme(theme)
      started_at = Time.now
      output = +""
      status = nil
      if @container
        Open3.popen2e(*docker_command(theme)) do |_stdin, stdout_err, wait_thr|
          stdout_err.each do |line|
            output << line
            @io.print line
          end
          status = wait_thr.value
        end
      else
        Dir.chdir(@repo_path) do
          Open3.popen2e(env_for(theme), "bin/rspec", SPEC_PATH) do |_stdin, stdout_err, wait_thr|
            stdout_err.each do |line|
              output << line
              @io.print line
            end
            status = wait_thr.value
          end
        end
      end
      Result.new(theme: theme, success: status.success?, status: status.exitstatus, output: output, started_at: started_at, finished_at: Time.now)
    end

    private

    def prepare_local_theme(theme)
      return theme unless theme.source["type"] == "local"

      source_path = File.expand_path(theme.source.fetch("path"))
      snapshot_path = File.expand_path(File.join(".cache", "local-theme-repos", theme.id))
      FileUtils.rm_rf(snapshot_path)
      FileUtils.mkdir_p(snapshot_path)

      Dir.children(source_path).each do |entry|
        next if entry == ".git"

        FileUtils.cp_r(File.join(source_path, entry), snapshot_path)
      end

      init_snapshot_repo(snapshot_path)
      Theme.new(
        id: theme.id,
        name: theme.name,
        source: theme.source.merge("type" => "git", "url" => snapshot_path, "local_path" => source_path),
        modes: theme.modes
      )
    end

    def init_snapshot_repo(path)
      env = {
        "GIT_AUTHOR_NAME" => "Theme Screenshots",
        "GIT_AUTHOR_EMAIL" => "theme-screenshots@example.invalid",
        "GIT_COMMITTER_NAME" => "Theme Screenshots",
        "GIT_COMMITTER_EMAIL" => "theme-screenshots@example.invalid"
      }
      Dir.chdir(path) do
        run_git!(env, "git", "init", "--quiet")
        run_git!(env, "git", "add", ".")
        run_git!(env, "git", "commit", "--quiet", "--message", "Snapshot local theme")
      end
    end

    def run_git!(env, *command)
      _output, status = Open3.capture2e(env, *command)
      raise "Failed to prepare local theme snapshot: #{command.join(" ")}" unless status.success?
    end

    def env_for(theme)
      env = @env.merge(
        "LOAD_PLUGINS" => "1",
        "TAKE_SCREENSHOTS" => "1",
        "SCREENSHOTS_THEMES" => theme.core? ? (theme.source["theme"] || theme.id) : "__remote_theme_only__",
        "SCREENSHOTS_MODES" => Array(theme.modes).join(",")
      )
      env["SCREENSHOTS_SUBSET"] = @subset.to_s unless @subset.to_s.empty?
      env["SCREENSHOTS_DEVICES"] = @devices.to_s unless @devices.to_s.empty?
      env["SCREENSHOTS_THEME_URL"] = theme.theme_url unless theme.core?
      env["SCREENSHOTS_DIR"] = File.join(@screenshots_dir, theme.id) if @screenshots_dir
      env
    end

    def docker_command(theme)
      command = ["docker", "exec", "-w", @container_repo_path]
      env_for(theme).each do |key, value|
        command.push("-e", "#{key}=#{value}")
      end
      command.push(@container, "bin/rspec", SPEC_PATH)
    end
  end
end
