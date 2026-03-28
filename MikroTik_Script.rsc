# MikroTik RouterOS Script for Hotspot Sync & Reporting
#
# Instructions:
# 1. System > Scripts > Add New
# 2. Name: "FetchUsers"
# 3. Policy: read, write, policy, test, api (check all generally safe ones)
# 4. Source: Paste the code below
# 5. Modify the 'url' variable with your Google Apps Script Web App URL.
# 6. System > Scheduler > Add New
# 7. Name: "SyncUsersSchedule", Interval: "00:01:00" (Run every minute), On Event: "FetchUsers"

{
    # REPLACE THIS URL with your actual Google Apps Script Web App URL (must end with /exec)
    # SECURITY: Ensure the token matches the MIKROTIK_TOKEN in Code.gs
    :local baseUrl "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
    :local token "CHANGE_THIS_TO_A_LONG_RANDOM_STRING";

    # ---------------------------------------------------
    # PART 1: FETCH NEW USERS (GET Request)
    # ---------------------------------------------------
    :local fetchUrl ($baseUrl . "?token=" . $token);

    :do {
        :local result ([/tool fetch url=$fetchUrl output=user as-value]);
        :local status ($result->"status");
        :local data ($result->"data");

        if ($status = "finished") do={
            # RouterOS v7.10+ required for :deserialize
            :local usersArray [:deserialize from=json $data];

            :foreach user in=$usersArray do={
                :local uName ($user->"username");
                :local uPass ($user->"password");
                :local uProfile ($user->"profile");
                :local uLimit ($user->"limitUptime");

                :if ([:len [/ip hotspot user find name=$uName]] = 0) do={
                    :log info ("Adding Hotspot User: " . $uName);
                    /ip hotspot user add name=$uName password=$uPass profile=$uProfile limit-uptime=$uLimit;
                }
            }
        }
    } on-error={
        :log warning "Failed to fetch users from Google Script";
    }

    # ---------------------------------------------------
    # PART 2: REPORT ACTIVE USERS (POST Request)
    # ---------------------------------------------------
    :do {
        # Construct JSON for active users
        :local activeUsers [/ip hotspot active print as-value];
        :local userList [:toarray ""];

        :foreach u in=$activeUsers do={
            :local mac ($u->"mac-address");
            :local bytesIn ($u->"bytes-in");
            :local bytesOut ($u->"bytes-out");
            :local uptime ($u->"uptime");

            # Create a dictionary for this user
            :local userObj { "mac"=$mac; "bytes-in"=$bytesIn; "bytes-out"=$bytesOut; "uptime"=$uptime };
            :set userList ($userList, $userObj);
        }

        :if ([:len $userList] > 0) do={
             # Build the final payload
             :local payload { "action"="router_stats"; "token"=$token; "users"=$userList };
             :local jsonPayload [:serialize to=json $payload];

             # Post to Google Script
             /tool fetch url=$baseUrl http-method=post http-header-field="Content-Type: application/json" http-data=$jsonPayload output=none;

             :log info ("Reported " . [:len $userList] . " active users to cloud.");
        }

    } on-error={
        :log warning "Failed to report router stats";
    }
}
