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
            # Wait for main content to appear (FairShare title)
            page.wait_for_selector("text=FairShare")

            # Verify inputs exist (Ooredoo, Kahramaa, Others)
            expect(page.locator("label", has_text="Ooredoo (Internet)")).to_be_visible()

            # Fill Ooredoo amount
            page.locator("input[placeholder='0']").first.fill("100")

            # Wait for reactivity (Vue updates DOM)
            # Total should be 100
            expect(page.locator("text=QR 100.00")).to_be_visible()

            # Wait for housemates to load and display (Alice and Bob)
            page.wait_for_selector("text=Alice", timeout=5000)

            # Verify amounts (50 each)
            # "TO PAY" is QR 50.00
            expect(page.locator("text=QR 50.00").first).to_be_visible()

            # Take screenshot
            page.screenshot(path="verification/bill_splitter_simplified.png")
            print("Verification successful, screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_bill_splitter()
