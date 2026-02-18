# ARASU WiFi sa Bukid - Setup Manual

This guide will walk you through setting up the ARASU WiFi Captive Portal system using a Mikrotik hEX S router, Paymongo for payments, Semaphore for SMS, and Google Sheets for the database.

## Prerequisites
1. **Mikrotik hEX S Router**
2. **Google Account** (for Google Sheets and Apps Script)
3. **Paymongo Account** (for GCash/Maya payments)
4. **Semaphore Account** (for SMS notifications)

---

## Step 1: Google Sheets Setup
1. Create a new Google Sheet.
2. Create 5 tabs with the following headers (Row 1):
   - **Users**: `username`, `passcode`, `planId`, `mobileNumber`, `referenceId`, `syncStatus`, `expirationDate`, `connectionStatus`
   - **Plans**: `id`, `name`, `price`, `durationHours`, `status`
   - **Transactions**: `referenceId`, `mobileNumber`, `planId`, `amount`, `status`, `timestamp`
   - **Announcements**: `id`, `title`, `message`, `status`
   - **Settings**: `key`, `value`
3. Note the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

---

## Step 2: Google Apps Script Deployment
1. Open the Sheet -> Extensions -> Apps Script.
2. Copy all files from `src/backend/` into the script editor (maintain file names).
3. Copy all files from `src/frontend/admin/` into the script editor (as HTML files).
4. Go to **Project Settings** (gear icon) and add the following **Script Properties**:
   - `SPREADSHEET_ID`: (Your Spreadsheet ID)
   - `PAYMONGO_SECRET_KEY`: (From Paymongo Dashboard)
   - `SEMAPHORE_API_KEY`: (From Semaphore Dashboard)
   - `ADMIN_PASSWORD`: (Your desired admin portal password)
   - `MIKROTIK_TOKEN`: (A random string for router security)
5. Click **Deploy** -> **New Deployment**.
   - Select **Web App**.
   - Set "Execute as" to **Me**.
   - Set "Who has access" to **Anyone**.
6. Copy the **Web App URL**. This is your `API_URL`.

---

## Step 3: Hotspot Page Upload
1. Open `src/hotspot/login.html`.
2. Update the `API_URL` variable with your Web App URL.
3. Access your Mikrotik via Winbox.
4. Go to **Files**.
5. Find the `hotspot` folder. Replace the existing `login.html` with your edited one.

---

## Step 4: Mikrotik Configuration
1. Open `mikrotik_complete.rsc`.
2. Update the `apiUrl` and `token` in the `SyncUsers` script section.
3. Connect to your Mikrotik via Winbox.
4. Open **New Terminal**.
5. Copy and paste the contents of `mikrotik_complete.rsc` into the terminal.
   - **ether1** should be connected to your ISP.
   - **ether2/3** are for Direct LAN.
   - **ether4/5** are for the Hotspot.

---

## Step 5: Paymongo Webhook
1. Go to Paymongo Dashboard -> Developers -> Webhooks.
2. Register a new webhook pointing to your **Web App URL**.
3. Enable the event: `link.payment.paid`.

---

## Troubleshooting
- **Login fails?** Check if the user exists in the `Users` tab and if `syncStatus` is `Synced`.
- **Payment not recording?** Check the Web App's execution logs in Google Apps Script.
- **SMS not sending?** Ensure your Semaphore account has balance and the API key is correct.
