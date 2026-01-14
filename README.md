# Bill Splitter Apps Script

This project is a Google Apps Script application to manage and split bills for housemates.

## Setup

1.  Create a new Google Spreadsheet.
2.  Open **Extensions > Apps Script**.
3.  Copy the contents of `Code.gs` into the script editor.
4.  Copy the contents of `index.html` into a new HTML file named `index.html`.
5.  Deploy as a Web App:
    *   Click **Deploy > New deployment**.
    *   Select type: **Web app**.
    *   Execute as: **Me**.
    *   Who has access: **Anyone** (or as needed).
6.  Open the Web App URL to use the application.

## Features

*   **Manage Housemates**: Maintain a list of housemates in the 'Housemates' sheet.
*   **Split Calculator**: Enter costs for Kahramaa, Ooredoo, and Other expenses. Split the total equally among active housemates.
*   **History Tracking**: Save calculations to the 'History' sheet and view past records with analytics.
*   **Analytics**: View monthly trends and averages directly in the app.

## Sheets Structure

The application automatically creates the following sheets when you save data:

*   **Housemates**: Stores the list of housemate names.
*   **History**: Stores bill records including Date, Month, Cost Breakdown, Total, and Per-Person Share.
