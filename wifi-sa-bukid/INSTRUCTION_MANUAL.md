# WiFi sa Bukid - Instruction Manual

This manual guides you through setting up the "WiFi sa Bukid" captive portal system using a Mikrotik hEX S, Google Apps Script, and Google Sheets.

## 1. Prerequisites

*   **Hardware:** Mikrotik hEX S (or any Mikrotik RouterOS device with Hotspot support).
*   **Google Account:** For Google Sheets and Apps Script.
*   **Paymongo Account:** For accepting payments (GCash/GrabPay). Get your Public and Secret keys.
*   **Semaphore Account:** For sending SMS passcodes. Get your API Key.
*   **Software:** WinBox (Windows/Wine) to manage Mikrotik.

---

## 2. Mikrotik hEX S Initial Configuration (From Scratch)

**Goal:** Configure the router from a blank slate to have Internet access on port 1 (WAN) and a Bridge LAN on ports 2-5, ready for the Hotspot.

### Step 2.1: Factory Reset (No Default Configuration)
1.  Connect your PC to **Port 2** of the Mikrotik.
2.  Open **WinBox**. It should detect the router via MAC address in the "Neighbors" tab. Click the MAC address and connect (User: `admin`, Password: empty).
3.  Go to **System** > **Reset Configuration**.
4.  Check **No Default Configuration**.
5.  Check **Do Not Backup**.
6.  Click **Reset Configuration** and confirm with **Yes**.
7.  The router will reboot. You will be disconnected.
8.  Wait ~30 seconds, then reconnect via WinBox using the MAC address again.

### Step 2.2: Basic Interface Setup
1.  Go to **Interfaces**.
2.  Double-click `ether1`. Rename it to `ether1-WAN`. Click OK.
3.  Double-click `ether2`. Rename it to `ether2-LAN`. Click OK.
    *   (Optional: Rename ether3-5 if desired, but not strictly necessary).

### Step 2.3: WAN Setup (Internet Source)
*If your ISP provides IP automatically (DHCP):*
1.  Go to **IP** > **DHCP Client**.
2.  Click **+**.
3.  Interface: `ether1-WAN`.
4.  Check **Use Peer DNS** and **Use Peer NTP**.
5.  Add Default Route: **yes**.
6.  Click **OK**. Wait until Status becomes `bound`.

*If you need a Static IP (e.g., from main ISP router):*
1.  Go to **IP** > **Addresses**.
2.  Click **+**.
3.  Address: `192.168.1.50/24` (Example IP from your ISP modem).
4.  Interface: `ether1-WAN`.
5.  Go to **IP** > **Routes**.
6.  Click **+**.
7.  Gateway: `192.168.1.1` (Your ISP modem IP).

### Step 2.4: LAN Bridge Setup (Split Network)
**Goal:** Create two networks.
*   **Hotspot Network:** Ports 4 & 5 (Requires Login).
*   **Direct Network:** Ports 2 & 3 (Automatic Internet).

1.  Go to **Bridge**.
2.  **Create Hotspot Bridge:**
    *   Tab **Bridge**: Click **+**. Name: `bridge-LAN`. Click **OK**.
3.  **Create Direct Bridge:**
    *   Click **+**. Name: `bridge-Direct`. Click **OK**.
4.  **Assign Ports:**
    *   Go to **Ports** Tab.
    *   Click **+**. Interface: `ether2-LAN`. Bridge: `bridge-Direct`. Click **OK**.
    *   Click **+**. Interface: `ether3`. Bridge: `bridge-Direct`. Click **OK**.
    *   Click **+**. Interface: `ether4`. Bridge: `bridge-LAN`. Click **OK**.
    *   Click **+**. Interface: `ether5`. Bridge: `bridge-LAN`. Click **OK**.

### Step 2.5: LAN IP Addresses
1.  Go to **IP** > **Addresses**.
2.  **Hotspot IP:**
    *   Click **+**. Address: `10.0.0.1/24`. Interface: `bridge-LAN`. Click **OK**.
3.  **Direct IP:**
    *   Click **+**. Address: `192.168.55.1/24`. Interface: `bridge-Direct`. Click **OK**.

### Step 2.5b: DHCP for Direct Network (Automatic Internet)
1.  Go to **IP** > **DHCP Server**.
2.  Click **DHCP Setup**.
3.  Select Interface: `bridge-Direct` (Ports 2 & 3).
4.  Click **Next** until completed (Accept defaults).
    *   *Now devices on Port 2 & 3 will get IP 192.168.55.x and have direct internet.*

### Step 2.6: DNS & NAT
1.  Go to **IP** > **DNS**.
2.  Servers: `8.8.8.8`, `8.8.4.4`.
3.  Check **Allow Remote Requests**.
4.  Click **OK**.
5.  Go to **IP** > **Firewall** > **NAT**.
6.  Click **+**.
    *   **Chain:** `srcnat`.
    *   **Out. Interface:** `ether1-WAN`.
    *   **Action:** `masquerade`.
7.  Click **OK**.

*(At this point, your router has internet. Verify by opening Terminal and pinging google.com)*

### Step 2.7: Hotspot Setup Wizard
1.  Go to **IP** > **Hotspot**.
2.  Click **Hotspot Setup** button.
3.  **Hotspot Interface:** `bridge-LAN` (Important: Do not select bridge-Direct). Click **Next**.
4.  **Local Address of Network:** `10.0.0.1/24` (Default). **Masquerade Network:** Checked. Click **Next**.
5.  **Address Pool of Network:** `10.0.0.2-10.0.0.254` (Default). Click **Next**.
6.  **Select Certificate:** `none`. Click **Next**.
7.  **IP Address of SMTP Server:** `0.0.0.0` (Default). Click **Next**.
8.  **DNS Servers:** `8.8.8.8`, `8.8.4.4`. Click **Next**.
9.  **DNS Name:** `hotspot.mikrotik.com` (Or your preferred local domain). Click **Next**.
10. **Name of Local Hotspot User:** `admin` (Create a temp admin). **Password:** (Set a password). Click **Next**.
11. Setup completed successfully.

### Step 2.8: Configure Login Method
1.  Go to **IP > Hotspot > Server Profiles**.
2.  Double-click the profile name (e.g., `hsprof1` or `default`).
3.  Go to the **Login** tab.
4.  **Uncheck** `HTTP CHAP` and `Cookie`.
5.  **Check** `HTTP PAP` and `MAC Cookie` (optional).
    *   *Why?* The custom login page uses a simple form. If CHAP is on, Mikrotik expects an MD5 challenge response, which causes errors like "browser did not send challenge response" if the JS script is missing.
6.  Click **OK**.

---

## 3. Google Sheets Setup (Database)

1.  Create a new Google Sheet.
2.  Rename the Sheet to `WiFi Database`.
3.  Create the following Tabs (Sheets) with the exact names and header rows:

    *   **Tab Name:** `Users`
        *   Row 1: `Mobile`, `Passcode`, `MAC`, `PlanID`, `Expiry`, `Status`, `Synced`

    *   **Tab Name:** `Plans`
        *   Row 1: `ID`, `Name`, `Price`, `DurationMinutes`, `SpeedLimit`
        *   *Example Data (Row 2):* `PLAN1`, `1 Hour`, `20`, `60`, `5M/5M`

    *   **Tab Name:** `Transactions`
        *   Row 1: `RefID`, `Mobile`, `PlanID`, `Amount`, `Status`, `Date`

    *   **Tab Name:** `Announcements`
        *   Row 1: `Message`, `Active`
        *   *Example Data (Row 2):* `Welcome to WiFi sa Bukid!`, `TRUE`

    *   **Tab Name:** `Settings`
        *   Row 1: `Key`, `Value`
        *   *Example Data (Row 2):* `adminPassword`, `admin123`

4.  Copy the **Spreadsheet ID** from the URL (the long string between `/d/` and `/edit`). You will need this later.

---

## 4. Google Apps Script Setup (Backend)

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
    *   Create `app-js.html` (Enter `app-js` as the file name). Paste content from `src/frontend/admin/app-js.html`.
    *   *Note: In Apps Script, do not add folders. Just create the files in the root.*

6.  **Set Script Properties (Secrets):**
    *   In the Apps Script Editor, go to **Project Settings** (Gear icon).
    *   Scroll to **Script Properties**.
    *   Add the following properties:
        *   `SPREADSHEET_ID`: The ID of your Google Sheet (from Step 3.4).
        *   `PAYMONGO_SECRET_KEY`: Your Paymongo Secret Key.
        *   `SEMAPHORE_API_KEY`: Your Semaphore API Key.
        *   `SEMAPHORE_SENDER_NAME`: (Optional) Your SMS Sender Name.

7.  **Authorize the Script (Crucial Step):**
    *   Before deploying, you must run a function to trigger the permission popup.
    *   In the editor toolbar, select `doGet` from the dropdown.
    *   Click **Run**.
    *   A "Review Permissions" dialog will appear. Click **Review Permissions**.
    *   Choose your Google Account.
    *   If you see "Google hasn't verified this app", click **Advanced** -> **Go to (Script Name) (unsafe)**.
    *   Click **Allow**.
    *   This ensures the script can access your Sheets and external APIs (Paymongo).

8.  **Deploy as Web App:**
    *   Click **Deploy** > **New deployment**.
    *   Select type: **Web app**.
    *   Description: `v1`.
    *   Execute as: **Me**.
    *   Who has access: **Anyone** (Required for Mikrotik and Users to access).
    *   Click **Deploy**.
    *   **Copy the Web App URL** (ends in `/exec`).

9.  **Setup Paymongo Webhook (Automatic Connection):**
    *   After deploying and logging into the **Admin Portal** (`.../exec?page=admin`).
    *   Go to the **Settings** tab.
    *   Click the **"Register Paymongo Webhook"** button.
    *   A confirmation popup will appear with the Webhook ID.
    *   This ensures that even if the user closes the browser after payment, the system will still process the transaction and send the SMS passcode.

---

## 5. Frontend & Hotspot Setup

1.  **Update Login Page:**
    *   Open `src/hotspot/login.html`.
    *   Find `const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";`
    *   Replace the URL with your **Web App URL** from Step 4.

2.  **Upload to Mikrotik:**
    *   Connect to your Mikrotik using WinBox.
    *   Go to **Files**.
    *   Locate your Hotspot directory (usually `hotspot` or `flash/hotspot`).
    *   Select `login.html`, `status.html`, `logout.html` from the `src/hotspot/` folder on your PC.
    *   Drag and drop them into the Mikrotik Files window, inside the hotspot folder, overwriting existing files.

---

## 6. Mikrotik Configuration Script (Automation)

1.  **Open the Setup Script:**
    *   Open `mikrotik_setup.rsc`.
    *   Update the line `:global GASURL "..."` with your **Web App URL**.

2.  **Run the Script:**
    *   Copy the entire content of the updated `mikrotik_setup.rsc`.
    *   In WinBox, open **New Terminal**.
    *   Paste the script and press Enter.

3.  **Verify:**
    *   Check **IP > Hotspot > Walled Garden**. You should see entries for Paymongo and Google.
    *   Check **IP > Hotspot > Server Profiles > Login**. Ensure `HTTP PAP` is checked.
    *   Check **System > Scripts**. You should see `SyncUsersParams` and `KickUsersParams`.
    *   Check **System > Scheduler**. You should see schedules running every 10s and 1m.

---

## 7. Testing

1.  Connect a mobile phone to the WiFi hotspot (e.g., connect to `bridge-LAN` via an Access Point connected to Port 2, or if testing via ethernet). *Note: hEX S does not have built-in WiFi. You need an Access Point connected to Port 2-5.*
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

*   **Admin Page shows "createOAuthDialog":**
    *   This happens if you are accessing the `/dev` URL or haven't authorized the script.
    *   **Fix:** Ensure you are using the **Web App URL** ending in `/exec`.
    *   **Fix:** In the Script Editor, manually Run the `doGet` function once to trigger the permission popup (Step 4.7).
*   **Error: "web browser did not send challenge response":**
    *   This means the Router is trying to use CHAP authentication, but the login page doesn't have the necessary MD5 script.
    *   **Fix:** Go to **IP > Hotspot > Server Profiles**. Open your profile, go to the **Login** tab, uncheck **HTTP CHAP** and check **HTTP PAP**.
*   **Hotspot Server is Red:**
    *   This usually means the Hotspot is **Invalid** or **Not Running**.
    *   Check **IP > Hotspot > Servers**. If the row is Red:
        1.  Ensure the **Interface** assigned (e.g., `bridge-LAN`) is active and running (has an `R` flag in Interfaces list).
        2.  If using a Bridge, ensure at least one port (ether2-5) is connected to a device (PC or Access Point) and active. If no device is plugged in, the Bridge goes down, and the Hotspot stops.
        3.  Check **IP > Addresses** to ensure `10.0.0.1/24` is assigned to `bridge-LAN` (the same interface as the Hotspot).
*   **Payment Stuck:** Ensure Paymongo Webhooks or Polling is working. The login page polls `checkPayment` every 3 seconds.
*   **Users not connecting after payment:**
    *   Check Mikrotik Logs (`/log print`). Look for "script error" or "fetch" errors.
    *   Ensure the Mikrotik has internet access to reach Google Servers.
    *   Check if `getNewUsers` endpoint on your Script is returning data.
*   **Walled Garden issues:**
    *   If the payment page doesn't load, ensure `paymongo.com` and `mag1.shopper-exchange.com` (and other Paymongo domains) are in Walled Garden.

## 8. Payment Flow & Troubleshooting

### Understanding the "After Payment" URL
When a user pays, Paymongo redirects them to a special **Payment Success Page** hosted on your Google Script.
*   **URL Structure:** `https://script.google.com/.../exec?page=payment_success&mobile=...&planId=...`
*   **Purpose:** This page polls your database to confirm the payment and then **automatically redirects** the user back to the Router (`http://hotspot.mikrotik.com/login`) to log them in.
*   **Requirement:** Since this page is hosted on Google, **`script.google.com` MUST be in the Walled Garden**. If the user sees "Web page not available" after payment, it means the router blocked access to this Google page.

### Webhook Endpoint
If you need to manually configure the Webhook in Paymongo (instead of using the Admin Portal button), the Endpoint URL is simply your **Web App URL** (ending in `/exec`).

## 9. Troubleshooting & Diagnostics

**Issue: "SyncUsers failed" or "Records not adding"**
*   **Cause:** Often due to missing or incorrect `SPREADSHEET_ID` in Script Properties.
*   **Diagnosis:** Visit this URL in your browser:
    `https://script.google.com/.../exec?action=testConfig`
*   **Expected Result:** `{"status":"ok", "details": {"db": "Connected: WiFi Database", "keys": "Present"}}`
*   **If it says "Failed" or "Error":** Check your Script Properties in the Google Apps Script editor.
