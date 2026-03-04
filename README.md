# ARASU WiFi sa Bukid - Captive Portal System

A complete captive portal solution for Mikrotik hEX S, integrated with Google Sheets, Paymongo (GCash, Maya), and Semaphore SMS.

## Physical Setup (Mikrotik hEX S)
*   **Port 1 (ether1):** Internet Source (ISP WAN)
*   **Port 2 & 3 (ether2, ether3):** Direct Internet Access (No password required)
*   **Port 4 & 5 (ether4, ether5):** Hotspot Access (Captive portal required). Connect your WiFi Access Points here.

---

## Step 1: Google Sheets & Apps Script Setup

1.  **Create a Google Sheet** with the following tabs (names must match exactly):
    *   `Users`: Columns: `id`, `username`, `password`, `expirationDate`, `status`, `syncStatus`, `mobile`, `planId`, `duration`, `balance`, `macAddress`
    *   `Plans`: Columns: `id`, `name`, `price`, `duration`, `speedLimit`
    *   `Transactions`: Columns: `id`, `userId`, `amount`, `type`, `status`, `date`, `refId`
    *   `Announcements`: Columns: `id`, `content`, `enabled`, `date`
    *   `Settings`: Columns: `key`, `value`
2.  **Open Apps Script:** From your Google Sheet, go to `Extensions` > `Apps Script`.
3.  **Copy Files:** Copy the contents of all `.js` and `.html` files from the `src/backend` and `src/frontend/admin` directories into the Apps Script editor.
    *   Note: In GAS, keep all files in the root folder.
4.  **Authorize & Setup:** Refresh your Google Sheet. Go to the new menu `ARASU WiFi Settings` > `Perform Initial Setup`. Click **"Authorize"** and **"Allow"** on the popup. This will automatically create all required tabs and set permissions.
5.  **Set Script Properties:** Go to `Project Settings` (gear icon) > `Script Properties` and add:
    *   `SPREADSHEET_ID`: (The ID of your Google Sheet)
    *   `PAYMONGO_SECRET_KEY`: (From your Paymongo Dashboard)
    *   `SEMAPHORE_API_KEY`: (From your Semaphore Dashboard)
    *   `ADMIN_PASSWORD`: (Your desired password for the Admin Portal)
    *   `MIKROTIK_TOKEN`: (A secret random string to authorize your router)
    *   `WEB_APP_URL`: (You will get this after deployment)
    *   `PAYMONGO_WEBHOOK_SECRET`: (From Paymongo > Developers > Webhooks after creating one pointing to your WEB_APP_URL)
5.  **Deploy:** Click `Deploy` > `New Deployment`. Select `Web App`.
    *   `Execute as`: Me
    *   `Who has access`: Anyone
6.  **Copy the Web App URL** and update the `WEB_APP_URL` script property.

> **CRITICAL SETUP WARNING:**
> 1. **DO NOT** use the Mikrotik "Auto-Popup" window to set up your Admin page. It will fail with a blank page.
> 2. **USE A STANDARD BROWSER:** Open Chrome or Safari on a laptop or phone while connected to regular internet/data.
> 3. **INCOGNITO MODE RECOMMENDED:** If you are logged into multiple Gmail accounts, Google Script will show a blank page. Use **Incognito Mode**.
> 4. **ENABLE COOKIES:** Ensure "Block third-party cookies" is turned **OFF**.

---

## Step 1.5: Paymongo Webhook Setup (MANDATORY)
For payments to record in your Google Sheet, you **MUST** create a webhook:
1. Log in to your **Paymongo Dashboard**.
2. Go to **Developers** > **Webhooks**.
3. Click **Add Webhook**.
4. **URL:** Paste your Google Web App URL.
5. **Events:** Select `checkout_session.payment.paid` and `link.payment.paid`.
6. Click **Save**.
7. Copy the **Webhook Signing Secret** and add it to your GAS **Script Properties** as `PAYMONGO_WEBHOOK_SECRET`.

---

## Step 2: Mikrotik Hex S Configuration

1.  **Reset Router:** Connect to your Mikrotik via Winbox. Go to `System` > `Reset Configuration`. Check **"No Default Configuration"** and **"Do Not Backup"**. Click Reset.
2.  **Open Terminal:** Once the router reboots, open a New Terminal.
3.  **Configure Script:** Open `src/mikrotik/mikrotik_complete.rsc` and replace:
    *   `YOUR_FULL_WEB_APP_URL` with your Google Apps Script URL.
    *   `YOUR_MIKROTIK_TOKEN` with the token you set in Script Properties.
4.  **Apply Configuration:** Copy the entire content of the script and paste it into the Mikrotik Terminal.
5.  **Upload Login Page:**
    *   Edit `src/frontend/hotspot/login.html` and replace `YOUR_FULL_WEB_APP_URL`.
    *   Rename the file to `login.html`.
    *   Using Winbox, go to `Files`. Open the `hotspot` folder (created by the script) and upload your `login.html` there.

---

## Step 3: Admin Portal Usage

1.  Access the Admin Portal via your `WEB_APP_URL`.
2.  Log in using your `ADMIN_PASSWORD`.
3.  **Add Plans:** Go to the `Plans` tab and add your offerings (e.g., 5 Pesos for 1 Hour).
    *   *Duration format:* `1h` (1 hour), `1d` (1 day), `30m` (30 minutes).
4.  **View Sales:** Check the `Sales Reports` tab for real-time transaction tracking.

---

## Features
*   **Automatic Provisioning:** Once a user pays via GCash or Maya, the system automatically generates a username/password.
*   **SMS Notification:** The credentials are sent instantly to the user's mobile number via Semaphore.
*   **Auto-Expiration:** Mikrotik and the Backend work together to kick users once their time limit is reached.
*   **Direct Access Ports:** Ports 2 and 3 provide bypass access for owner devices or stationary PCs.
*   **Sales Tracking:** Monthly and daily sales reports per plan and user.

## Troubleshooting

### BLANK PAGE / REDIRECT LOOP / PERMISSION DENIED
If the Admin Page or Hotspot login shows a blank white page, or redirects to a long "googleusercontent" URL:

**Solution 1: Manual Authorization (FORCED)**
1.  In your Google Sheet, go to **Extensions** > **Apps Script**.
2.  At the top, look for the function dropdown (next to "Run" and "Debug"). Select **`initialSetup`**.
3.  Click the **Run** button.
4.  If a popup appears, click **Review Permissions**, choose your account, click **Advanced** > **Go to ARASU WiFi (unsafe)**, and then **Allow**.
5.  After it finishes, you MUST **Redeploy**: Click **Deploy** > **Manage Deployments** > **Edit (Pencil Icon)** > Change version to **New Version** > **Deploy**.

**Solution 2: Use Incognito Mode**
Google Apps Script often breaks if you are logged into multiple Google accounts. Use **Private/Incognito Mode** in Chrome to open your Admin link.

### ERR_CONNECTION_CLOSED
If you see this error when accessing the Admin Portal or Hotspot:
1.  **Check Internet:** Ensure your Mikrotik actually has internet on `ether1`.
2.  **DNS Check:** Ensure `allow-remote-requests` is set to `yes` in Mikrotik DNS settings.
3.  **Walled Garden:** Ensure you have applied the Walled Garden rules in Step 2.
4.  **Test Link:** Try opening your Google Web App URL in a browser on your phone/PC while **NOT** connected to the hotspot (use mobile data) to verify the script is online.

### failure: not allowed by device-mode
If you see this error in your Mikrotik Log when scripts try to run:
1.  Open the **Terminal** in Winbox.
2.  Run this command: `/system device-mode update allow-http-fetch=yes`
3.  The router will ask you to confirm by pressing a physical button on the router or by rebooting. Follow the on-screen instructions.

## Support
Branded as **ARASU WiFi sa Bukid**. Designed for ease of use and maximum performance on Mikrotik hardware.
