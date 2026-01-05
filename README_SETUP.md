# Setup Instructions for WIFI sa BUKID Hotspot System

This guide provides a detailed, step-by-step walkthrough to configure **PayMongo** (Payment Gateway) and **Semaphore** (SMS Gateway) for your hotspot system.

---

## Part 1: Semaphore Configuration (SMS)

**Goal:** Get an API Key to send SMS messages to your customers.

1.  **Register Account**
    *   Go to [semaphore.co](https://semaphore.co).
    *   Sign up for an account.

2.  **Get API Key**
    *   Log in to your Semaphore Dashboard.
    *   Navigate to **Account** or **API** settings.
    *   Copy your **API Key**. You will need this later for the Google Apps Script.

3.  **Register Sender Name (Optional but Recommended)**
    *   By default, messages come from "SEMAPHORE".
    *   To use a custom name like "WIFI-BUKID", go to **Sender Names** and request one.
    *   *Note: If you change this, you must update `SENDER_NAME` in `Code.gs`.*

---

## Part 2: PayMongo Configuration (Payments)

**Goal:** Get API Keys to accept GCash, PayMaya, and Coins.ph payments.

1.  **Register Account**
    *   Go to [paymongo.com](https://paymongo.com).
    *   Sign up as a Business or Individual.

2.  **Activate Account**
    *   Follow the verification steps to activate your account for live payments.
    *   *Note: You can use "Test Mode" initially to test without real money.*

3.  **Get API Keys**
    *   Log in to PayMongo Dashboard.
    *   Go to **Developers** on the sidebar.
    *   Ensure the toggle (Test Mode / Live Mode) is set to the mode you are working in.
    *   Copy the **Secret Key** (starts with `sk_test_...` or `sk_live_...`).
    *   *Important: Do not share this key publicly.*

---

## Part 3: Deploying the Backend Code

**Goal:** Upload the code to Google Apps Script and connect your keys.

1.  **Open Google Sheets**
    *   Create a new Google Sheet named `WIFI Transactions`.
    *   Go to **Extensions** > **Apps Script**.

2.  **Upload Code**
    *   Copy the content of `Code.gs` into the script editor.
    *   Copy the content of `index.html` into a new HTML file named `index` in the editor.
    *   Copy the content of `admin.html` into a new HTML file named `admin` in the editor.

3.  **Set Script Properties (Securely Store Keys)**
    *   In the Apps Script editor, click the **Project Settings** (Gear icon) on the left sidebar.
    *   Scroll down to **Script Properties**.
    *   Click **Add script property**.
        *   Property: `SEMAPHORE_API_KEY`
        *   Value: *(Paste your Semaphore API Key from Part 1)*
    *   Click **Add script property**.
        *   Property: `PAYMONGO_SECRET_KEY`
        *   Value: *(Paste your PayMongo Secret Key from Part 2)*
    *   Click **Save script properties**.

4.  **Configure Router Token and Admin Password**
    *   Open `Code.gs`.
    *   Find `var MIKROTIK_TOKEN = ...`. Change it to a secure token.
    *   Find `var ADMIN_PASSWORD = 'admin123';`. Change this to your preferred admin password.
    *   Save the file.

5.  **Deploy as Web App**
    *   Click the blue **Deploy** button > **New deployment**.
    *   **Select type**: Click the gear icon > **Web app**.
    *   **Description**: "v1 Init".
    *   **Execute as**: `Me (your_email@gmail.com)`.
    *   **Who has access**: `Anyone` (Crucial: Select "Anyone" so the router and customers can access it).
    *   Click **Deploy**.
    *   **Authorize Access**: Google will ask for permission. Click "Review permissions", choose your account, click "Advanced" > "Go to (Project Name) (unsafe)" > "Allow".
    *   **Copy the Web App URL**. (e.g., `https://script.google.com/macros/s/.../exec`)

---

## Part 4: Connecting PayMongo Webhooks

**Goal:** Tell PayMongo to notify your Google Script when a customer pays.

1.  Go back to the **PayMongo Dashboard**.
2.  Go to **Developers** > **Webhooks**.
3.  Click **Create Webhook** (or "Add Webhook").
4.  **Webhook URL**: Paste the **Web App URL** you copied in Part 3.
5.  **Events**: Select `checkout_session.payment.paid`.
6.  Click **Add Webhook**.
    *   *Note: If you are in Test Mode, this will only fire for test transactions.*

---

## Part 5: MikroTik Router Setup

**Goal:** Allow the router to sync paid users from Google Sheets.

1.  **Walled Garden (Allow Access before Login)**
    *   Open WinBox or WebFig.
    *   Go to `IP` > `Hotspot` > `Walled Garden`.
    *   Add rules to allow traffic to these domains (Dst. Host):
        *   `script.google.com`
        *   `sheets.googleapis.com`
        *   `api.paymongo.com`
        *   `*.paymongo.com`
        *   `checkout.paymongo.com`
        *   `fonts.googleapis.com` (for styling)
        *   `cdn.tailwindcss.com` (for styling)
        *   `unpkg.com` (for icons)

2.  **Create Hotspot Profiles**
    *   Go to `IP` > `Hotspot` > `User Profiles`.
    *   Create the following profiles exactly as named:
        *   `1hour_plan`
        *   `3hours_plan`
        *   `1day_plan`
        *   `1week_plan`
    *   *Tip: Set "Shared Users" to 1 and configure Rate Limits (e.g. 5M/5M) for each.*

3.  **Import Sync Script**
    *   Open `System` > `Scripts`.
    *   Add a new script named `FetchUsers`.
    *   Copy the content of `MikroTik_Script.rsc`.
    *   **Update the URL**: Find the line `local url "https://script.google.com/..."` and replace it with your Web App URL.
    *   **Update the Token**: Find `?token=...` in the URL and ensure it matches the `MIKROTIK_TOKEN` you set in Part 3.

4.  **Schedule Sync**
    *   Go to `System` > `Scheduler`.
    *   Add a new schedule.
    *   Name: `SyncWifiUsers`.
    *   Interval: `00:01:00` (Every 1 minute).
    *   On Event: `FetchUsers` (The name of the script you created).

5.  **Add "Buy Now" Link to Login Page**
    *   Go to `Files`.
    *   Download your `hotspot/login.html`.
    *   Edit it to include a button linking to your Web App URL.
    *   Upload it back to the router.

---

## Part 6: Verification

1.  **Test Payment**: Open your Web App URL on your phone.
2.  **Buy a Plan**: Select a cheap plan (or use test mode).
3.  **Check SMS**: You should receive an SMS with your username/password.
4.  **Check Router**: The user should appear in `IP` > `Hotspot` > `Users` within 1 minute.

---

## Part 7: Accessing the Admin Dashboard

**Goal:** View sales reports and transaction logs.

1.  **Get your Web App URL** (the same one used for the store).
2.  **Add `?page=admin` to the end of the URL.**
    *   Example: `https://script.google.com/macros/s/.../exec?page=admin`
3.  **Log In**:
    *   Enter the password you configured in `Code.gs` (Default: `admin123`).
