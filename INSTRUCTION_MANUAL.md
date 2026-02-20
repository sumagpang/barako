# WiFi sa Bukid - Setup Manual

This guide will walk you through setting up the WiFi sa Bukid Captive Portal system using a Mikrotik hEX S router, Paymongo for payments, Semaphore for SMS, and Google Sheets for the database.

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
   - **Plans**: `id`, `name`, `price`, `durationHours`, `speedLimit`, `status`
   - **Transactions**: `referenceId`, `mobileNumber`, `planId`, `amount`, `status`, `timestamp`
   - **Announcements**: `id`, `title`, `message`, `status`
   - **Settings**: `key`, `value`
3. Note the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

---

## Step 2: Google Apps Script Deployment
1. Open the Sheet -> Extensions -> Apps Script.
2. Copy all files from `src/backend/` into the script editor (maintain file names like `Code.gs`, `Database.gs`, `Services.gs`, etc.).
3. Copy all files from `src/frontend/admin/` into the script editor as **HTML** files.
   - **IMPORTANT:** Name the HTML files exactly as they are in the folder, but without the `.html` extension (e.g., `index.html` becomes `index`, `dashboard.html` becomes `dashboard`, `app-js.html` becomes `app-js`).
4. Go to **Project Settings** (gear icon) and add the following **Script Properties**:
   - `SPREADSHEET_ID`: (Your Spreadsheet ID)
   - `PAYMONGO_SECRET_KEY`: (From Paymongo Dashboard)
   - `SEMAPHORE_API_KEY`: (From Semaphore Dashboard)
   - `ADMIN_PASSWORD`: (Your desired admin portal password)
   - `MIKROTIK_TOKEN`: (A self-generated secret key. You create this yourself, e.g., `MySecret123`. It ensures only your router can fetch users from your script.)
   - `WEB_APP_URL`: (You will get this in the next step. After deploying, come back here and paste the URL.)
5. Click **Deploy** -> **New Deployment**.
   - Select **Web App**.
   - Set "Execute as" to **Me**.
   - Set "Who has access" to **Anyone**.
6. Copy the **Web App URL**. This is your `API_URL`.

---

## Step 3: Hotspot Page Upload
1. Open `src/hotspot/login.html`.
2. Update the `API_URL` variable with your **FULL Web App URL** (e.g., `https://script.google.com/macros/s/ABC...XYZ/exec`).
   - **DO NOT** use just the ID. It must be the complete URL.
3. Access your Mikrotik via Winbox.
4. Go to **Files**.
5. Find the `hotspot` folder. Replace the existing `login.html` with your edited one.

---

## Step 4: Mikrotik Reset & Setup Walkthrough
Follow these steps to ensure a clean installation on your Mikrotik hEX S:

### 4.1 Reset to Clean State
1. Connect your PC to **ether2** of the Mikrotik.
2. Open **Winbox** and connect to your router.
3. Go to **System** -> **Reset Configuration**.
4. Check the following boxes:
   - **[x] No Default Configuration**
   - **[x] Do Not Backup**
5. Click **Reset Configuration**. The router will reboot and be completely empty (no IP, no password).

### 4.2 Apply New Configuration
1. After the reboot, connect via Winbox again (use the **MAC Address** in the Neighbors tab, username `admin`, no password).
2. Open `mikrotik_complete.rsc` from this project on your computer.
3. **IMPORTANT**: Look at the top of the file (**Section 0**). Update the `apiUrl` and `apiToken` with your own values from Step 2.
4. In Winbox, open a **New Terminal**.
5. Copy the entire content of your updated `mikrotik_complete.rsc` and **Paste** it into the terminal.
6. The router will automatically configure:
   - **ether1**: ISP Internet (Connect your ISP Modem here)
   - **ether2 & ether3**: Direct Internet (No login required. Connect PCs or non-hotspot devices here)
   - **ether4 & ether5**: Hotspot (Requires Mobile & Passcode. **Connect your WiFi Access Point here**)
7. Your PC might lose connection temporarily. Reconnect to ether2 or ether3 to continue.

---

## Step 5: Paymongo Webhook
1. Go to Paymongo Dashboard -> Developers -> Webhooks.
2. Register a new webhook pointing to your **Web App URL**.
3. Enable the event: `link.payment.paid`.

---

## Troubleshooting
- **Auto-Popup not showing?**
  - Ensure the **Walled Garden** is not too open. Broad wildcards like `*.google.com` or `*.gstatic.com` can trick mobile phones into thinking they have full internet, preventing the "Sign in to network" popup.
  - Test by visiting an **HTTP** site (e.g., `http://fixme.it`) in your browser; it should redirect to the login page.
  - **HTTPS Redirection:** Modern browsers block redirection of HTTPS sites (like Facebook or YouTube) to prevent security attacks. The system relies on the phone's built-in detection (CPD) which uses HTTP.
- **Login fails?** Check if the user exists in the `Users` tab and if `syncStatus` is `Synced`.
- **Payment not recording?** Check the Web App's execution logs in Google Apps Script.
- **SMS not sending?** Ensure your Semaphore account has balance and the API key is correct.
- **Payment initialization failed?**
  - Ensure `PAYMONGO_SECRET_KEY` is correct.
  - Check if the selected payment method is enabled in your Paymongo Dashboard.
  - Verify that `WEB_APP_URL` is correctly set in Script Properties.
- **Admin Page shows ERR_CONNECTION_CLOSED?**
  - This usually means the Mikrotik is blocking the connection to Google. Ensure the **Walled Garden** in Step 4 is fully applied.
  - Verify that your `API_URL` in `login.html` starts with `https://`.
  - Try clearing your browser cache or opening in Incognito.
