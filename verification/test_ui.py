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
                    getInitialData: function() {
                        const data = {
                            housemates: [
                                { id: '1', name: 'Alice', moveIn: '2023-01-01', moveOut: null },
                                { id: '2', name: 'Bob', moveIn: '2023-02-01', moveOut: null }
                            ],
                            billTypes: []
                        };
                        setTimeout(() => this.successHandler && this.successHandler(data), 100);
                    },
                    calculatePreview: function(month, amount) {
                        console.log('Mock: Calculating preview for ' + month + ' amount ' + amount);
                        const res = {
                           totalDays: 30,
                           allocations: [
                               { housemateId: '1', name: 'Alice', daysActive: 30, amount: 50 },
                               { housemateId: '2', name: 'Bob', daysActive: 30, amount: 50 }
                           ],
                           totalAllocated: 100,
                           startDate: '2023-03-01',
                           endDate: '2023-03-31'
                        };
                        setTimeout(() => {
                           console.log('Mock: Returning preview result');
                           this.successHandler && this.successHandler(res);
                        }, 500);
                    },
                    saveBill: function(month, items, preview) {
                        setTimeout(() => this.successHandler && this.successHandler(true), 500);
                    },
                    getHistory: function() {
                        setTimeout(() => this.successHandler && this.successHandler({}), 100);
                    },
                    saveHousemate: function(form, id) {
                         setTimeout(() => this.successHandler && this.successHandler(true), 100);
                    },
                    addBillType: function(type) {
                         setTimeout(() => this.successHandler && this.successHandler(true), 100);
                    },
                    deleteBillGroup: function(id) {
                         setTimeout(() => this.successHandler && this.successHandler(true), 100);
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
            # Use specific locator for the label to avoid matching the button
            expect(page.locator("label", has_text="Ooredoo (Internet)")).to_be_visible()

            # Fill inputs
            # The input is inside the same container as the label.
            # We can just target the first number input since we know Ooredoo is first.
            page.locator("input[type='number']").first.fill("100")

            # Wait for calculation (triggered by watch)
            # We should see housemates appear in the preview list
            # Note: The mock delay is 500ms
            page.wait_for_selector("text=Alice", timeout=5000)

            # Verify amounts
            expect(page.locator("text=QR 50.00").first).to_be_visible()

            # Take screenshot
            page.screenshot(path="verification/bill_splitter_redesign.png")
            print("Verification successful, screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_bill_splitter()
