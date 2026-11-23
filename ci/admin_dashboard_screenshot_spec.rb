# frozen_string_literal: true

RSpec.describe "Gallery admin dashboard" do
  fab!(:admin)

  it "shows the dashboard" do
    sign_in(admin)
    visit "/admin"
    expect(page).to have_css(".db-main [data-section-id], .db-main__empty, .nav-pills")
    screenshot_marker(label: "admin-dashboard", only: :desktop)
  end
end
