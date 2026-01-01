# MikroTik RouterOS Script for Hotspot Sync
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
    # SECURITY: Append ?token=YOUR_SECRET_TOKEN to the URL
    :local url "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?token=YOUR_SECRET_TOKEN";

    # Wrap the fetch in a do-on-error block to catch network failures
    :do {
        # Fetch data from Google Cloud
        :local result ([/tool fetch url=$url output=user as-value]);
        :local status ($result->"status");
        :local data ($result->"data");

        if ($status = "finished") do={

            # RouterOS doesn't have a native JSON parser in older versions (v6).
            # This script assumes RouterOS v7.10+ with :deserialize support.

            :local usersArray [:deserialize from=json $data];

            :foreach user in=$usersArray do={
                :local uName ($user->"username");
                :local uPass ($user->"password");
                :local uProfile ($user->"profile");
                :local uLimit ($user->"limitUptime");

                # Check if user already exists to avoid errors
                :if ([:len [/ip hotspot user find name=$uName]] = 0) do={
                    :log info ("Adding Hotspot User: " . $uName);

                    # Add the user to Hotspot
                    # Ensure the 'profile' exists in /ip hotspot user profile
                    /ip hotspot user add name=$uName password=$uPass profile=$uProfile limit-uptime=$uLimit;
                }
            }
        }
    } on-error={
        :log warning "Failed to fetch users from Google Script";
    }
}
