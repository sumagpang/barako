# WiFi sa Bukid - Mikrotik Setup Script (Updated)
# 1. Update the local GASURL variable below with your Google Apps Script Deployment URL
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

# Allow CDNs for UI
add dst-host=*cdn.tailwindcss.com comment="Tailwind CSS"
add dst-host=*cdnjs.cloudflare.com comment="Cloudflare CDN"
add dst-host=*images.unsplash.com comment="Unsplash Images"

# ==========================================
# Hotspot Profile Setup (Fix "Challenge Response" Error)
# Use HTTP PAP instead of CHAP to support simple HTML forms
# ==========================================
/ip hotspot profile
set [find name=default] login-by=http-pap,mac-cookie
set [find name=hsprof1] login-by=http-pap,mac-cookie

# ==========================================
# User Profile Setup (Connection Tracking)
# ==========================================
/ip hotspot user profile
set [ find default=yes ] \
    on-login=":local mac \$(\"mac-address\"); :local user \$username; :local url (\"$GASURL?action=updateConnection&mac=\" . \$mac . \"&status=ONLINE&mobile=\" . \$user); /tool fetch url=\$url mode=https keep-result=no check-certificate=no" \
    on-logout=":local mac \$(\"mac-address\"); :local url (\"$GASURL?action=updateConnection&mac=\" . \$mac . \"&status=OFFLINE\"); /tool fetch url=\$url mode=https keep-result=no check-certificate=no"

# ==========================================
# Create Sync Scripts with Dynamic URL
# ==========================================

# 1. Sync Users Script
/system script remove [find name="SyncUsersParams"]
/system script
add name="SyncUsersParams" source=( \
    ":local url (\"" . $GASURL . "?action=getNewUsers\")\r\n" . \
    "/tool fetch url=\$url mode=https keep-result=yes dst-path=\"newusers.txt\" check-certificate=no\r\n" . \
    ":local content [/file get newusers.txt contents]\r\n" . \
    ":if ([:len \$content] > 3) do={\r\n" . \
    "    :local users \$content\r\n" . \
    "    :local len [:len \$users]\r\n" . \
    "    :local start 0\r\n" . \
    "    :local end 0\r\n" . \
    "    :do {\r\n" . \
    "        :set end [:find \$users \"\\n\" \$start]\r\n" . \
    "        :if ([:typeof \$end] = \"nil\") do={ :set end \$len }\r\n" . \
    "        :local line [:pick \$users \$start \$end]\r\n" . \
    "        :if ([:pick \$line ([:len \$line]-1)] = \"\\r\") do={ :set line [:pick \$line 0 ([:len \$line]-1)] }\r\n" . \
    "        :if ([:len \$line] > 0) do={\r\n" . \
    "            :local c1 [:find \$line \",\"]\r\n" . \
    "            :local c2 [:find \$line \",\" (\$c1 + 1)]\r\n" . \
    "            :if ([:typeof \$c1] != \"nil\" && [:typeof \$c2] != \"nil\") do={\r\n" . \
    "                :local u [:pick \$line 0 \$c1]\r\n" . \
    "                :local p [:pick \$line (\$c1 + 1) \$c2]\r\n" . \
    "                :local l [:pick \$line (\$c2 + 1) [:len \$line]]\r\n" . \
    "                :if ([:len [/ip hotspot user find name=\$u]] = 0) do={\r\n" . \
    "                    /ip hotspot user add name=\$u password=\$p limit-uptime=\$l profile=default\r\n" . \
    "                    :log info (\"Added user: \" . \$u)\r\n" . \
    "                }\r\n" . \
    "            }\r\n" . \
    "        }\r\n" . \
    "        :set start (\$end + 1)\r\n" . \
    "    } while (\$start < \$len)\r\n" . \
    "}" \
)

# 2. Kick Users Script
/system script remove [find name="KickUsersParams"]
/system script
add name="KickUsersParams" source=( \
    ":local url (\"" . $GASURL . "?action=getKickList\")\r\n" . \
    "/tool fetch url=\$url mode=https keep-result=yes dst-path=\"kicklist.txt\" check-certificate=no\r\n" . \
    ":local content [/file get kicklist.txt contents]\r\n" . \
    ":if ([:len \$content] > 0) do={\r\n" . \
    "    :local activeUsers [/ip hotspot active find]\r\n" . \
    "    :foreach u in=\$activeUsers do={\r\n" . \
    "        :local user [:pick [/ip hotspot active get \$u user] 0 15]\r\n" . \
    "        :if ([:find \$content \$user] >= 0) do={\r\n" . \
    "            /ip hotspot active remove \$u\r\n" . \
    "            :log info (\"Kicked user: \" . \$user)\r\n" . \
    "        }\r\n" . \
    "    }\r\n" . \
    "}" \
)

# ==========================================
# Schedulers
# ==========================================
/system scheduler remove [find name="SyncUsersSchedule"]
/system scheduler remove [find name="KickUsersSchedule"]
/system scheduler
add name="SyncUsersSchedule" interval=10s on-event="SyncUsersParams"
add name="KickUsersSchedule" interval=1m on-event="KickUsersParams"
