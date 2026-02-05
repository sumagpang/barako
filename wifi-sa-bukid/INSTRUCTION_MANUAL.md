# WiFi sa Bukid - Instruction Manual

This manual guides you through setting up the "WiFi sa Bukid" captive portal system using a Mikrotik hEX S, Google Apps Script, and Google Sheets.

## 1. Prerequisites

*   **Hardware:** Mikrotik hEX S (or any Mikrotik RouterOS device with Hotspot support).
*   **Google Account:** For Google Sheets and Apps Script.
*   **Paymongo Account:** For accepting payments (GCash/GrabPay). Get your Public and Secret keys.
*   **Semaphore Account:** For sending SMS passcodes. Get your API Key.

## 2. Google Sheets Setup (Database)

1.  Create a new Google Sheet.
2.  Rename the Sheet to `WiFi Database`.
3.  Create the following Tabs (Sheets) with the exact names and header rows:

    *   **Tab Name:** `Users`
        *   Row 1: `Mobile`, `Passcode`, `MAC`, `PlanID`, `Expiry`, `Status`, `Synced`

    *   **Tab Name:** `Plans`
        *   Row 1: `ID`, `Name`, `Price`, `DurationMinutes`, `SpeedLimit`
        *   *Example Data (Row 2):* `PLAN1`, `1 Hour`, `10`, `60`, `5M/5M`

    *   **Tab Name:** `Transactions`
        *   Row 1: `RefID`, `Mobile`, `PlanID`, `Amount`, `Status`, `Date`

    *   **Tab Name:** `Announcements`
        *   Row 1: `Message`, `Active`
        *   *Example Data (Row 2):* `Welcome to WiFi sa Bukid!`, `TRUE`

    *   **Tab Name:** `Settings`
        *   Row 1: `Key`, `Value`
        *   *Example Data (Row 2):* `adminPassword`, `admin123`

4.  Copy the **Spreadsheet ID** from the URL (the long string between `/d/` and `/edit`). You will need this later.

## 3. Google Apps Script Setup (Backend)

1.  Open your Google Sheet.
2.  Go to **Extensions** > **Apps Script**.
3.  Delete any existing code in `Code.gs`.
4.  Copy the contents of the files from the `src/backend/` folder of this project into the script editor.
    *   Create `Code.gs` and paste content from `src/backend/Code.js`.
    *   Create `Database.gs` and paste content from `src/backend/Database.js`.
    *   Create `Services.gs` and paste content from `src/backend/Services.js`.
    *   Create `AdminController.gs` and paste content from `src/backend/AdminController.js`.
    *   **Important:** In `Database.gs`, find `var SS_ID = "YOUR_SPREADSHEET_ID_HERE";` and replace it with your actual Spreadsheet ID.
5.  Create HTML files for the Admin Portal:
    *   Create `index.html` and paste content from `src/frontend/admin/index.html`.
    *   Create `src/frontend/admin/js/app.html` (name it `src/frontend/admin/js/app` in Apps Script, or adjust the include call in Code.gs if you prefer flat naming. The provided code assumes the path `src/frontend/admin/js/app`). *Tip: Apps Script doesn't support real folders, just slashes in names.*

6.  **Set Script Properties (Secrets):**
    *   In the Apps Script Editor, go to **Project Settings** (Gear icon).
    *   Scroll to **Script Properties**.
    *   Add the following properties:
        *   `PAYMONGO_SECRET_KEY`: Your Paymongo Secret Key.
        *   `SEMAPHORE_API_KEY`: Your Semaphore API Key.
        *   `SEMAPHORE_SENDER_NAME`: (Optional) Your SMS Sender Name.

7.  **Deploy as Web App:**
    *   Click **Deploy** > **New deployment**.
    *   Select type: **Web app**.
    *   Description: `v1`.
    *   Execute as: **Me**.
    *   Who has access: **Anyone** (Required for Mikrotik and Users to access).
    *   Click **Deploy**.
    *   **Copy the Web App URL** (ends in `/exec`).

## 4. Frontend & Hotspot Setup

1.  **Update Login Page:**
    *   Open `src/hotspot/login.html`.
    *   Find `const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";`
    *   Replace the URL with your **Web App URL** from Step 3.

2.  **Upload to Mikrotik:**
    *   Connect to your Mikrotik using WinBox or WebFig.
    *   Go to **Files**.
    *   Locate your Hotspot directory (usually `flash/hotspot` or just `hotspot`).
    *   Upload the modified `login.html`, plus `status.html` and `logout.html` from `src/hotspot/` to this directory, overwriting existing files.

## 5. Mikrotik Configuration (RouterOS)

1.  **Open the Setup Script:**
    *   Open `mikrotik_setup.rsc`.
    *   Update the line `:global GASURL "..."` with your **Web App URL**.

2.  **Run the Script:**
    *   Copy the entire content of the updated `mikrotik_setup.rsc`.
    *   In WinBox, open **New Terminal**.
    *   Paste the script and press Enter.

3.  **Verify:**
    *   Check **IP > Hotspot > Walled Garden**. You should see entries for Paymongo and Google.
    *   Check **System > Scripts**. You should see `SyncUsersParams` and `KickUsersParams`.
    *   Check **System > Scheduler**. You should see schedules running every 1m and 5m.

## 6. Testing

1.  Connect a mobile phone to the WiFi hotspot.
2.  The captive portal should open.
3.  Select a Plan and click "Pay".
4.  Complete the payment (in Test Mode if configured).
5.  Wait for the SMS or the screen to display the passcode.
6.  The system should auto-login.
7.  **Admin Check:**
    *   Go to your Web App URL with `?page=admin` appended (e.g., `.../exec?page=admin`).
    *   Enter password (default: `admin123` or what you set in Settings sheet).
    *   Verify the sale and user appear in the Dashboard.

## Troubleshooting

*   **Payment Stuck:** Ensure Paymongo Webhooks or Polling is working. The login page polls `checkPayment` every 3 seconds.
*   **Users not connecting after payment:**
    *   Check Mikrotik Logs (`/log print`). Look for "script error" or "fetch" errors.
    *   Ensure the Mikrotik has internet access to reach Google Servers.
    *   Check if `getNewUsers` endpoint on your Script is returning data.
