# Setup Instructions for WiFi Hotspot System

This system automates the process of selling WiFi vouchers using **PayMongo** (GCash/PayMaya) and delivering passwords via **Semaphore** (SMS).

## Prerequisites

1.  **Google Account** (to host the backend script).
2.  **PayMongo Account**: Register at [paymongo.com](https://paymongo.com). Get your `Secret Key`.
3.  **Semaphore Account**: Register at [semaphore.co](https://semaphore.co). Get your `API Key`.
4.  **MikroTik Router**: Running RouterOS v7.10 or higher (for JSON support).

## Step 1: Deploy the Backend (Google Apps Script)

1.  Open the Google Sheet associated with this script (or create a new one).
2.  Go to **Extensions > Apps Script**.
3.  Copy the code from `Code.gs` into the editor.
4.  **Security Configuration**:
    *   In the script editor, look for `var MIKROTIK_TOKEN`. Change the string `'CHANGE_THIS_TO_A_LONG_RANDOM_STRING'` to a secure password of your choice. You will need this for the router.
    *   **Secrets**:
        *   Click **Project Settings (Gear Icon)** > **Script Properties**.
        *   Add `SEMAPHORE_API_KEY` and your key.
        *   Add `PAYMONGO_SECRET_KEY` and your key (if expanding functionality later).
5.  **Deploy as Web App**:
    *   Click **Deploy** > **New deployment**.
    *   Select type: **Web app**.
    *   Description: "Hotspot Backend".
    *   Execute as: **Me** (your email).
    *   Who has access: **Anyone** (This is required for PayMongo and MikroTik to reach it).
    *   Click **Deploy**.
    *   **COPY the Web App URL** (e.g., `https://script.google.com/macros/s/.../exec`).

## Step 2: Configure PayMongo

1.  You need to create a **Payment Intent** or **Checkout Session** in your frontend (captive portal page).
2.  When creating the payment link via PayMongo API, set the `redirect` success URL to your captive portal success page.
3.  **Crucial**: You must register a **Webhook** in PayMongo to notify your Google Script when a payment is paid.
    *   Go to PayMongo Dashboard > Developers > Webhooks.
    *   Add a webhook.
    *   URL: Paste your **Google Web App URL**.
    *   Events: Select `payment.paid` (or `source.chargeable` depending on your flow, but `payment.paid` is best for Checkout).

## Step 3: Configure MikroTik Router

1.  Log in to your MikroTik (WinBox or WebFig).
2.  **Create User Profiles**:
    *   Go to `IP > Hotspot > User Profiles`.
    *   Create profiles that match the names expected by `Code.gs` (e.g., `1hour_plan`, `1day_plan`).
    *   Set the Rate Limits (speed) for each profile.
3.  **Import the Script**:
    *   Go to `System > Scripts`.
    *   Add a new script named `FetchUsers`.
    *   Copy the content of `MikroTik_Script.rsc` into the source.
    *   **Edit the URL**:
        *   Find the line `:local url "..."`.
        *   Paste your Google Web App URL.
        *   **Important**: Append `?token=YOUR_CHOSEN_TOKEN` to the end of the URL.
        *   Example: `https://script.google.com/macros/s/.../exec?token=mySecretPassword123`
4.  **Schedule the Script**:
    *   Go to `System > Scheduler`.
    *   Add a new task.
    *   Interval: `00:01:00` (runs every minute).
    *   On Event: `FetchUsers`.

## Step 4: Testing

1.  Simulate a PayMongo Webhook (or make a real small payment).
2.  Check the Google Sheet: A new row should appear with `PENDING_SYNC`.
3.  Check your Phone: You should receive an SMS with the code (ensure you used a valid PH number).
4.  Wait 1 minute (or run the script manually on MikroTik).
5.  Check `IP > Hotspot > Users`: The new user should appear there.
6.  Check the Google Sheet again: Status should change to `SYNCED`.

## Troubleshooting

*   **SMS not sending?** Check the Semaphore API Key in Script Properties and ensure you have credit. Verify the phone number format.
*   **MikroTik not syncing?**
    *   Check the Log (`/log print`) on the router.
    *   Ensure the `token` in the MikroTik script matches the `MIKROTIK_TOKEN` in `Code.gs`.
    *   Ensure the router has internet access (DNS/Gateway configured).
    *   Ensure you are using RouterOS v7+ for `[:deserialize from=json]`.
