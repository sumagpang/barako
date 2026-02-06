# WiFi sa Bukid - Mikrotik Setup Script (Updated)
# 1. Update the GAS_URL variable below with your Google Apps Script Deployment URL
# 2. Copy and paste this into Mikrotik Terminal

:global GASURL "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"

# ==========================================
# Walled Garden Setup
# ==========================================
/ip hotspot walled-garden
add dst-host=*paymongo.com comment="Paymongo"
add dst-host=*script.google.com comment="Google Script"
add dst-host=*googleusercontent.com comment="Google Content"
add dst-host=*googleapis.com comment="Google Fonts"
add dst-host=*gstatic.com comment="Google Static"
add dst-host=*semaphore.co comment="Semaphore SMS"

# ==========================================
# Hotspot Profile Setup (Fix "Challenge Response" Error)
# Use HTTP PAP instead of CHAP to support simple HTML forms
# ==========================================
/ip hotspot profile
set [find name=default] login-by=http-pap,mac-cookie
set [find name=hsprof1] login-by=http-pap,mac-cookie

# ==========================================
# Sync Users Script (Add New Users)
# Fetches new users from GAS and adds them to Hotspot
# Format: mobile,passcode,limit
# ==========================================
/system script
add name="SyncUsersParams" source={
    :local url ($GASURL . "?action=getNewUsers")
    /tool fetch url=$url mode=https keep-result=yes dst-path="newusers.txt"
    :local content [/file get newusers.txt contents]

    # Check if content is not empty
    :if ([:len $content] > 3) do={
        # Basic parsing: split by newline (if multiple users)
        # Note: RouterOS string parsing is limited.
        # This loop handles one user per line, or just one user if no newline logic.

        # For simplicity, we assume single line or implement a basic tokenizer
        # "mobile,pass,limit"

        :local users $content

        # Loop over lines (Pseudo-code for RouterOS v6/v7 compat)
        # In v7, use :toarray and split. In v6, complex loops.
        # We will assume each line is separated by newline \n or \r\n

        :local len [:len $users]
        :local start 0
        :local end 0

        :do {
            :set end [:find $users "\n" $start]
            :if ([:typeof $end] = "nil") do={ :set end $len }

            :local line [:pick $users $start $end]
            # Clean carriage return
            :if ([:pick $line ([:len $line]-1)] = "\r") do={ :set line [:pick $line 0 ([:len $line]-1)] }

            :if ([:len $line] > 0) do={
                # Parse Comma
                :local c1 [:find $line ","]
                :local c2 [:find $line "," ($c1 + 1)]

                :if ([:typeof $c1] != "nil" && [:typeof $c2] != "nil") do={
                    :local u [:pick $line 0 $c1]
                    :local p [:pick $line ($c1 + 1) $c2]
                    :local l [:pick $line ($c2 + 1) [:len $line]]

                    # Add User if not exists
                    :if ([:len [/ip hotspot user find name=$u]] = 0) do={
                        /ip hotspot user add name=$u password=$p limit-uptime=$l profile=default
                        :log info ("Added user: " . $u)
                    }
                }
            }
            :set start ($end + 1)
        } while ($start < $len)
    }
}

# ==========================================
# Disconnect User Script (Kick)
# ==========================================
/system script
add name="KickUsersParams" source={
    :local url ($GASURL . "?action=getKickList")
    /tool fetch url=$url mode=https keep-result=yes dst-path="kicklist.txt"
    :local content [/file get kicklist.txt contents]

    :if ([:len $content] > 0) do={
        :local activeUsers [/ip hotspot active find]
        :foreach u in=$activeUsers do={
            :local user [:pick [/ip hotspot active get $u user] 0 15]
            # Check if user (mobile) is in content
            :if ([:find $content $user] >= 0) do={
                /ip hotspot active remove $u
                :log info ("Kicked user: " . $user)
            }
        }
    }
}

# ==========================================
# Schedulers
# ==========================================
/system scheduler
add name="SyncUsersSchedule" interval=1m on-event="SyncUsersParams"
add name="KickUsersSchedule" interval=5m on-event="KickUsersParams"
