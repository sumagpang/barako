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
   - **Users**: `username`, `passcode`, `planId`, `mobileNumber`, `referenceId`, `syncStatus`, `expirationDate`, `connectionStatus`, `balance`
   - **Plans**: `id`, `name`, `price`, `durationHours`, `speedLimit`, `status`
   - **Transactions**: `referenceId`, `mobileNumber`, `planId`, `amount`, `status`, `timestamp`
   - **Announcements**: `id`, `title`, `message`, `status`
   - **Settings**: `key`, `value`
3. Note the **Spreadsheet ID** from the URL.

---

## Step 2: Google Apps Script Deployment
1. Open the Sheet -> Extensions -> Apps Script.
2. Copy all files from `src/backend/` into the script editor.
3. Copy all files from `src/frontend/admin/` into the script editor as **HTML** files.
4. Add the following **Script Properties**:
   - `SPREADSHEET_ID`: (Your Spreadsheet ID)
   - `PAYMONGO_SECRET_KEY`: (From Paymongo Dashboard)
   - `SEMAPHORE_API_KEY`: (From Semaphore Dashboard)
   - `ADMIN_PASSWORD`: (Your desired admin portal password)
   - `MIKROTIK_TOKEN`: (A self-generated secret key)
   - `WEB_APP_URL`: (The URL you get after deploying)
5. Click **Deploy** -> **New Deployment** (Web App, Execute as Me, Access Anyone).

---

## The Wallet System (Small Plan Support)
Paymongo enforces a **PHP 100.00 minimum** for GCash/Maya. To support smaller plans (₱1, ₱5, ₱10), this system uses a **Wallet/Credit** mechanism:
1. **Direct Purchase**: If a plan costs ₱100 or more, the user can pay directly via Paymongo.
2. **Top Up**: Users can Top Up their balance with ₱100 (via Paymongo).
3. **Wallet Purchase**: Once a user has balance, they can purchase any small plan instantly. The cost is deducted from their wallet.

Admins can also manually add balance to users via the **Admin Portal** if they pay in cash.

---

## Step 3: Accessing the Admin Portal
Visit your **Web App URL** and add `?page=admin` to the end. Enter your password.

---

## Step 4: Hotspot Page Upload
1. Open `src/hotspot/login.html`.
2. Update the `API_URL` variable with your **FULL Web App URL**.
3. Upload to Mikrotik `hotspot` folder.

---

## Step 5: Mikrotik Setup
1. Reset Mikrotik (No Default, Do Not Backup).
2. Open `mikrotik_complete.rsc`, update `apiUrl` and `apiToken` at the top.
3. Paste content into Mikrotik **New Terminal**.

---

## Step 6: Webhook Configuration
1. Go to Paymongo Dashboard -> Developers -> Webhooks.
2. Register your **Web App URL**.
3. Enable event: `checkout_session.payment.paid`.

---

## Troubleshooting
- **Payment Error 100 PHP?** Ensure the user is topping up or buying a plan >= 100. Small plans must use the wallet balance.
- **SMS not sending?** Check Semaphore balance.
