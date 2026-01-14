from playwright.sync_api import sync_playwright, expect
import os

def test_bill_splitter():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"PAGE CONSOLE: {msg.text}"))

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        mock_script = """
        window.google = {
            script: {
                run: {
                    successHandler: null,
                    failureHandler: null,
                    withSuccessHandler: function(func) {
                        this.successHandler = func;
                        return this;
                    },
                    withFailureHandler: function(func) {
                        this.failureHandler = func;
                        return this;
                    },
                    getInitialData: function() {
                        const data = {
                            housemates: [
                                { id: '1', name: 'Alice', moveIn: '2023-01-01', moveOut: null },
                                { id: '2', name: 'Bob', moveIn: '2023-02-01', moveOut: null }
                            ],
                            billTypes: ['Electricity', 'Water']
                        };
                        setTimeout(() => this.successHandler(data), 100);
                    },
                    calculatePreview: function(bill) {
                        const res = {
                           totalDays: 30,
                           allocations: [
                               { housemateId: '1', name: 'Alice', daysActive: 30, amount: 50 },
                               { housemateId: '2', name: 'Bob', daysActive: 30, amount: 50 }
                           ],
                           totalAllocated: 100
                        };
                        setTimeout(() => this.successHandler(res), 500);
                    },
                    saveBill: function(bill, preview) {
                        setTimeout(() => this.successHandler(true), 500);
                    },
                    getHistory: function() {
                        setTimeout(() => this.successHandler({}), 100);
                    },
                    saveHousemate: function(form, id) {
                         setTimeout(() => this.successHandler(true), 100);
                    },
                    addBillType: function(type) {
                         setTimeout(() => this.successHandler(true), 100);
                    }
                }
            }
        };
        """

        page.add_init_script(mock_script)
        page.reload()

        try:
            # Wait for data to load
            # The spinner should disappear
            page.wait_for_selector(".ph-spinner", state="detached")

            # Verify Bill Types loaded by checking the select options
            # "Electricity" is the first option
            expect(page.locator("select")).to_have_value("Electricity")

            # Fill out form
            page.fill("input[type='number']", "100")

            # Date inputs
            page.locator("input[type='date']").nth(0).fill("2023-03-01")
            page.locator("input[type='date']").nth(1).fill("2023-03-30")

            # Click Calculate
            page.click("text=Calculate Allocation")

            # Wait for preview
            page.wait_for_selector("text=Allocation Preview", timeout=5000)

            # Now Alice should be visible in the preview list
            expect(page.locator("text=Alice")).to_be_visible()
            expect(page.locator("text=₱50.00").first).to_be_visible()

            # Take screenshot
            page.screenshot(path="verification/bill_splitter_preview.png")
            print("Verification successful, screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_bill_splitter()
