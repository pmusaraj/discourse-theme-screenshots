# frozen_string_literal: true

module ThemeScreenshots
  module GalleryPreset
    NAME = "gallery"
    COMMON = %w[topic-list categories topic-rich-content composer-new-topic login-form].freeze
    DESKTOP_ONLY = %w[chat-reply admin-dashboard].freeze
    LABELS = (COMMON + DESKTOP_ONLY).freeze

    def self.missing(files, devices:, modes:)
      devices.flat_map do |device|
        labels = device == "desktop" ? LABELS : COMMON
        modes.flat_map do |mode|
          labels.filter_map do |label|
            next if files.any? do |file|
              name = File.basename(file)
              name.start_with?("#{device}-") && name.end_with?("-#{mode}-#{label}.png")
            end

            "#{device}/#{mode}/#{label}"
          end
        end
      end
    end
  end
end
