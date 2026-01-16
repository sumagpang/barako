# FairShare - Bill Splitter

FairShare is a Google Apps Script web application designed to help housemates calculate and record shared bills (Kahramaa, Ooredoo, etc.). It supports prorated splitting based on days stayed and maintains a history of bills in a Google Sheet.

## Features

*   **Prorated Calculator:** Split bills based on the number of days each housemate stayed during the billing month.
*   **Google Sheets Integration:** Automatically saves bill history and housemate lists to Google Sheets ("History" and "Housemates" tabs).
*   **History & Analytics:** View past records and visualize spending trends with built-in charts.
*   **Housemate Management:** Easily add or remove housemates via the Settings interface.
*   **Mobile-Friendly UI:** Built with Tailwind CSS for a responsive experience on desktop and mobile.

## Project Structure

*   `code.gs`: The backend logic running on Google Apps Script. Handles sheet operations (read/write) and serves the HTML.
*   `index.html`: The frontend user interface. Contains the HTML, CSS (Tailwind), and Client-side JavaScript.

## Setup Instructions

1.  **Create a Google Sheet:**
    *   Go to Google Sheets and create a new spreadsheet.
    *   Extensions > Apps Script.

2.  **Add Files:**
    *   Copy the content of `code.gs` into the `Code.gs` file in the Apps Script editor.
    *   Create a new HTML file named `index` (or `index.html`) and copy the content of `index.html` into it.

3.  **Deploy:**
    *   Click on **Deploy** > **New deployment**.
    *   Select type: **Web app**.
    *   Description: "Initial version".
    *   Execute as: **Me**.
    *   Who has access: **Anyone with Google Account** (or as preferred).
    *   Click **Deploy**.

4.  **Authorize:**
    *   Grant the necessary permissions for the script to access your spreadsheet.

5.  **Run:**
    *   Open the "Web app URL" provided after deployment to start using FairShare.

## Usage

### 1. Settings (Housemates)
*   On first load, go to the **People** tab (Settings).
*   Add the names of all housemates.
*   Click **Save Changes** to create the "Housemates" sheet in your spreadsheet.

### 2. Calculator
*   Go to the **Split** tab.
*   Select the **Billing Period** (Month/Year).
*   Enter the amounts for **Kahramaa**, **Ooredoo**, and **Other**.
*   In the list below, uncheck anyone who wasn't present, or adjust their **Days Stayed** if they were away for part of the month.
*   The share is calculated automatically.
*   Click **Save Entry** to record the bill in the "History" sheet.

### 3. History
*   Go to the **History** tab to view saved bills.
*   Toggle between **Records** (list view) and **Analytics** (charts/stats).
*   You can delete entries if needed.

## Development (Local)

The `index.html` file includes a **Mock Mode**. If you open `index.html` directly in a browser (without the Google Apps Script environment), it detects that `google.script.run` is missing and uses local storage to simulate backend operations. This allows for rapid UI development and testing.
