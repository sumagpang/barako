# Bill Splitter Apps Script

This project is a Google Apps Script application to manage prorated bills for housemates.

## Setup

1.  Create a new Google Spreadsheet.
2.  Open **Extensions > Apps Script**.
3.  Copy the contents of `Code.gs` into the script editor.
4.  Copy the contents of `index.html` into a new HTML file named `index.html`.
5.  Run the `setupSheets()` function once to initialize the required sheets (`Housemates`, `BillTypes`, `Bills`, `Allocations`).
6.  Deploy as a Web App:
    *   Click **Deploy > New deployment**.
    *   Select type: **Web app**.
    *   Execute as: **Me**.
    *   Who has access: **Anyone** (or as needed).
7.  Open the Web App URL to use the application.

## Features

*   **Manage Housemates**: Add housemates with Move-in and Move-out dates.
*   **Manage Bill Types**: Customize bill categories (Electricity, Water, Internet, etc.).
*   **Prorated Calculation**: Automatically calculates each housemate's share based on their presence during the billing period.
*   **History**: View monthly summaries and detailed breakdowns per bill.
