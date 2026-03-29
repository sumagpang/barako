# WiFi sa Bukid - Mikrotik Setup Script (Updated)
# 1. Update the local GASURL variable below with your Google Apps Script Deployment URL
# 2. Copy and paste this into Mikrotik Terminal

:global GASURL "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"

# ==========================================
# Force DNS & Walled Garden Setup
# ==========================================

# Ensure Basic Connectivity (DNS/NAT)
/ip dns set allow-remote-requests=yes
:if ([:len [/ip firewall nat find action=masquerade]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=ether1-WAN action=masquerade comment="Default Masquerade"
}

# Ensure Bridges are in LAN list (if default firewall exists)
:if ([:len [/interface list find name=LAN]] > 0) do={
    :do { /interface list member add list=LAN interface=bridge-Direct } on-error={}
    :do { /interface list member add list=LAN interface=bridge-LAN } on-error={}
}

# Force users to use Router DNS (Critical for Walled Garden)
/ip firewall nat
add chain=dstnat protocol=udp dst-port=53 action=redirect to-ports=53 comment="Force DNS UDP"
add chain=dstnat protocol=tcp dst-port=53 action=redirect to-ports=53 comment="Force DNS TCP"

/ip hotspot walled-garden
# Allow Google Script Execution (Ports 80/443 explicitly)
add dst-host=*script.google.com dst-port=443 comment="Google Script HTTPS"
add dst-host=*script.google.com dst-port=80 comment="Google Script HTTP"
add dst-host=*googleusercontent.com dst-port=443 comment="Google Content HTTPS"
add dst-host=*accounts.google.com dst-port=443 comment="Google Auth"
add dst-host=*google.com dst-port=443 comment="Google General"

# Other Services
add dst-host=*paymongo.com comment="Paymongo"
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
    ":do {\r\n" . \
    "    /tool fetch url=\$url mode=https keep-result=yes dst-path=\"newusers.txt\" check-certificate=no\r\n" . \
    "    :if ([:len [/file find name=\"newusers.txt\"]] > 0) do={\r\n" . \
    "        :local content [/file get newusers.txt contents]\r\n" . \
    "        :if ([:len \$content] > 3) do={\r\n" . \
    "            :local users \$content\r\n" . \
    "            :local len [:len \$users]\r\n" . \
    "            :local start 0\r\n" . \
    "            :local end 0\r\n" . \
    "            :do {\r\n" . \
    "                :set end [:find \$users \"\\n\" \$start]\r\n" . \
    "                :if ([:typeof \$end] = \"nil\") do={ :set end \$len }\r\n" . \
    "                :local line [:pick \$users \$start \$end]\r\n" . \
    "                :if ([:pick \$line ([:len \$line]-1)] = \"\\r\") do={ :set line [:pick \$line 0 ([:len \$line]-1)] }\r\n" . \
    "                :if ([:len \$line] > 0) do={\r\n" . \
    "                    :local c1 [:find \$line \",\"]\r\n" . \
    "                    :local c2 [:find \$line \",\" (\$c1 + 1)]\r\n" . \
    "                    :if ([:typeof \$c1] != \"nil\" && [:typeof \$c2] != \"nil\") do={\r\n" . \
    "                        :local u [:pick \$line 0 \$c1]\r\n" . \
    "                        :local p [:pick \$line (\$c1 + 1) \$c2]\r\n" . \
    "                        :local l [:pick \$line (\$c2 + 1) [:len \$line]]\r\n" . \
    "                        :if ([:len [/ip hotspot user find name=\$u]] = 0) do={\r\n" . \
    "                            /ip hotspot user add name=\$u password=\$p limit-uptime=\$l profile=default\r\n" . \
    "                            :log info (\"Added user: \" . \$u)\r\n" . \
    "                        }\r\n" . \
    "                    }\r\n" . \
    "                }\r\n" . \
    "                :set start (\$end + 1)\r\n" . \
    "            } while (\$start < \$len)\r\n" . \
    "        }\r\n" . \
    "        /file remove \"newusers.txt\"\r\n" . \
    "    }\r\n" . \
    "} on-error={ :log warning \"SyncUsers failed to fetch from GAS\" }" \
)

# 2. Kick Users Script
/system script remove [find name="KickUsersParams"]
/system script
add name="KickUsersParams" source=( \
    ":local url (\"" . $GASURL . "?action=getKickList\")\r\n" . \
    ":do {\r\n" . \
    "    /tool fetch url=\$url mode=https keep-result=yes dst-path=\"kicklist.txt\" check-certificate=no\r\n" . \
    "    :if ([:len [/file find name=\"kicklist.txt\"]] > 0) do={\r\n" . \
    "        :local content [/file get kicklist.txt contents]\r\n" . \
    "        :if ([:len \$content] > 0) do={\r\n" . \
    "            :local activeUsers [/ip hotspot active find]\r\n" . \
    "            :foreach u in=\$activeUsers do={\r\n" . \
    "                :local user [:pick [/ip hotspot active get \$u user] 0 15]\r\n" . \
    "                :if ([:find \$content \$user] >= 0) do={\r\n" . \
    "                    /ip hotspot active remove \$u\r\n" . \
    "                    :log info (\"Kicked user: \" . \$user)\r\n" . \
    "                }\r\n" . \
    "            }\r\n" . \
    "        }\r\n" . \
    "        /file remove \"kicklist.txt\"\r\n" . \
    "    }\r\n" . \
    "} on-error={ :log warning \"KickUsers failed to fetch from GAS\" }" \
)

# ==========================================
# Schedulers
# ==========================================
/system scheduler remove [find name="SyncUsersSchedule"]
/system scheduler remove [find name="KickUsersSchedule"]
/system scheduler
add name="SyncUsersSchedule" interval=10s on-event="SyncUsersParams"
add name="KickUsersSchedule" interval=1m on-event="KickUsersParams"

# ==========================================
# Network Setup: Swap Ports
# Hotspot: Ports 4 & 5 (bridge-LAN)
# Direct: Ports 2 & 3 (bridge-Direct)
# ==========================================

# 1. Clear old port assignments
/interface bridge port remove [find interface=ether2]
/interface bridge port remove [find interface=ether3]
/interface bridge port remove [find interface=ether4]
/interface bridge port remove [find interface=ether5]

# 2. Ensure Bridges Exist
:if ([:len [/interface bridge find name=bridge-LAN]] = 0) do={ /interface bridge add name=bridge-LAN }
:if ([:len [/interface bridge find name=bridge-Direct]] = 0) do={ /interface bridge add name=bridge-Direct }

# 3. Assign Ports
/interface bridge port add bridge=bridge-Direct interface=ether2
/interface bridge port add bridge=bridge-Direct interface=ether3
/interface bridge port add bridge=bridge-LAN interface=ether4
/interface bridge port add bridge=bridge-LAN interface=ether5

# 4. Configure Direct Network (IP & DHCP)
# Note: bridge-LAN IP (10.0.0.1) is assumed to be set manually or via QuickSet, but we can ensure Direct IP.
:if ([:len [/ip address find interface=bridge-Direct]] = 0) do={
    /ip address add address=192.168.55.1/24 interface=bridge-Direct
}

:if ([:len [/ip dhcp-server find name=dhcp-Direct]] = 0) do={
    /ip pool add name=pool-Direct ranges=192.168.55.10-192.168.55.254
    /ip dhcp-server network add address=192.168.55.0/24 gateway=192.168.55.1 dns-server=8.8.8.8,8.8.4.4
    /ip dhcp-server add name=dhcp-Direct interface=bridge-Direct address-pool=pool-Direct disabled=no
}
