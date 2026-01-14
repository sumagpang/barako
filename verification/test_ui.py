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
                    withSuccessHandler: function(func) {
                        const runner = Object.create(this);
                        runner.successHandler = func;
                        return runner;
                    },
                    withFailureHandler: function(func) {
                        const runner = Object.create(this);
                        runner.failureHandler = func;
                        return runner;
                    },
                    getHousemates: function() {
                        const data = ['Alice', 'Bob'];
                        setTimeout(() => this.successHandler && this.successHandler(data), 100);
                    },
                    saveBill: function(data) {
                        setTimeout(() => this.successHandler && this.successHandler("Success"), 500);
                    },
                    getHistory: function() {
                        setTimeout(() => this.successHandler && this.successHandler([]), 100);
                    },
                    saveHousemates: function(list) {
                         setTimeout(() => this.successHandler && this.successHandler("Success"), 100);
                    },
                    deleteHistoryItem: function(date, month) {
                         setTimeout(() => this.successHandler && this.successHandler("Success"), 100);
                    }
                }
            }
        };
        """

        page.add_init_script(mock_script)
        page.reload()

        try:
            # Wait for header
            page.wait_for_selector("text=Bill Splitter")

            # Fill inputs
            # Kahramaa
            page.locator("#cost-kahramaa").fill("50")
            # Ooredoo
            page.locator("#cost-ooredoo").fill("100")

            # Verify Total (150) - display-total text contains "150.00"
            expect(page.locator("#display-total")).to_contain_text("150.00")

            # Wait for housemates (Alice and Bob)
            page.wait_for_selector("text=Alice", timeout=5000)

            # Verify split calculation
            # Total 150 / 2 = 75 per person
            # The share display is inside .share-display class
            # We have 2 rows.

            # Select first row's share
            first_share = page.locator(".share-display").first
            expect(first_share).to_have_text("75.00")

            # Take screenshot
            page.screenshot(path="verification/bill_splitter_vanilla.png")
            print("Verification successful, screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_bill_splitter()
