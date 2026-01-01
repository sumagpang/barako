# Setup Instructions for WiFi Hotspot System

This system automates the process of selling WiFi vouchers using **PayMongo** (GCash/PayMaya) and delivering passwords via **Semaphore** (SMS).

## Prerequisites

1.  **Google Account** (to host the backend script).
2.  **PayMongo Account**: Register at [paymongo.com](https://paymongo.com). Get your `Secret Key`.
3.  **Semaphore Account**: Register at [semaphore.co](https://semaphore.co). Get your `API Key`.
4.  **MikroTik Router**: Running RouterOS v7.10 or higher.

## Step 1: Deploy the Backend (Google Apps Script)

1.  Open the Google Sheet associated with this script.
2.  Go to **Extensions > Apps Script**.
3.  **Security Configuration**:
    *   Change `MIKROTIK_TOKEN` in `Code.gs` to a secure password.
    *   **Secrets**: Go to **Project Settings** > **Script Properties**.
        *   Add `SEMAPHORE_API_KEY`: Your Semaphore API Key.
        *   Add `PAYMONGO_SECRET_KEY`: Your PayMongo Secret Key (sk_...).
4.  **Deploy as Web App**:
    *   Click **Deploy** > **New deployment**.
    *   Select type: **Web app**.
    *   Description: "Hotspot Store".
    *   Execute as: **Me**.
    *   Who has access: **Anyone**.
    *   Click **Deploy** and **COPY the Web App URL**.

## Step 2: Configure PayMongo

1.  Go to PayMongo Dashboard > Developers > Webhooks.
2.  Add a webhook.
3.  URL: Paste your **Google Web App URL**.
4.  Events: Select `checkout_session.payment.paid`.

## Step 3: Configure MikroTik Router

1.  **Create User Profiles (CRITICAL)**:
    *   You MUST create these specific profiles in your MikroTik for the system to work.
    *   Go to `IP > Hotspot > User Profiles` and add:
        *   Name: `1hour_plan` (Set Rate Limit, e.g., "5M/5M")
        *   Name: `1day_plan`
        *   Name: `1week_plan`
    *   *Note: If these profiles are missing, the router script will fail to add users.*

2.  **Sync Script**:
    *   Create a script `FetchUsers` (see `MikroTik_Script.rsc`).
    *   Update the URL to your Web App URL + `?token=YOUR_TOKEN`.
    *   Schedule it to run every minute.
3.  **Captive Portal (Login Page)**:
    *   To allow users to buy vouchers, you need to edit the `login.html` file on your MikroTik (in Files).
    *   Add a link to your Google Web App URL.
    *   Example HTML code to add to `login.html`:
        ```html
        <div style="text-align: center; margin-top: 20px;">
          <p>Don't have a voucher?</p>
          <a href="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" target="_blank"
             style="background: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
             Buy WiFi Access
          </a>
        </div>
        ```
    *   **Walled Garden**: You must allow access to Google and PayMongo for unauthorized users.
    *   Go to `IP > Hotspot > Walled Garden`.
    *   Add Allow rules for:
        *   `*.google.com`
        *   `*.googleapis.com`
        *   `*.gstatic.com`
        *   `*.paymongo.com`
        *   `*.paymongo.io`

## Step 4: Testing

1.  Connect to the WiFi.
2.  Click the "Buy WiFi Access" link on the login page.
3.  Select "1 Hour Pass" on the store page.
4.  Pay using Test GCash (if in PayMongo Test Mode).
5.  Wait for the SMS with the code.
6.  Login with the code.

## Troubleshooting

*   **"Unauthorized" on Store Page**: Ensure you are NOT passing `?token=...` when accessing the store URL.
*   **No SMS**: Check PayMongo Webhook logs (did it fire?) and Google Script Executions (did it error?).
*   **Payment Link Error**: Check `PAYMONGO_SECRET_KEY` in Script Properties.
