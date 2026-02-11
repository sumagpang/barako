# ==========================================
# WiFi sa Mayapyap - COMPLETE SYSTEM SETUP
# Hardware: Mikrotik hEX S
# Topology:
#   - Port 1: WAN (Internet)
#   - Ports 2-3: Direct Internet (Automatic, No Login)
#   - Ports 4-5: Hotspot (Captive Portal)
# ==========================================

# 1. Update GASURL with your Google Web App URL
:global GASURL "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"

# ==========================================
# 1. Interfaces & Bridges
# ==========================================
# Rename Interfaces
/interface ethernet set [ find default-name=ether1 ] name=ether1-WAN
/interface ethernet set [ find default-name=ether2 ] name=ether2-Direct
/interface ethernet set [ find default-name=ether3 ] name=ether3-Direct
/interface ethernet set [ find default-name=ether4 ] name=ether4-Hotspot
/interface ethernet set [ find default-name=ether5 ] name=ether5-Hotspot

# Create Bridges
/interface bridge add name=bridge-Direct
/interface bridge add name=bridge-Hotspot

# Assign Ports to Bridges
/interface bridge port
add bridge=bridge-Direct interface=ether2-Direct
add bridge=bridge-Direct interface=ether3-Direct
add bridge=bridge-Hotspot interface=ether4-Hotspot
add bridge=bridge-Hotspot interface=ether5-Hotspot

# ==========================================
# 2. IP Addresses & Networking
# ==========================================
# WAN Setup (DHCP Client)
/ip dhcp-client add interface=ether1-WAN disabled=no

# Local IPs
/ip address
add address=192.168.55.1/24 interface=bridge-Direct network=192.168.55.0 comment="Direct Network"
add address=10.0.0.1/24 interface=bridge-Hotspot network=10.0.0.0 comment="Hotspot Network"

# DHCP Server (Direct)
/ip pool add name=pool-Direct ranges=192.168.55.10-192.168.55.254
/ip dhcp-server network add address=192.168.55.0/24 gateway=192.168.55.1 dns-server=8.8.8.8,8.8.4.4
/ip dhcp-server add name=dhcp-Direct interface=bridge-Direct address-pool=pool-Direct disabled=no

# DNS
/ip dns set allow-remote-requests=yes servers=8.8.8.8,8.8.4.4

# ==========================================
# 3. Firewall & NAT (Crucial for Internet)
# ==========================================
/ip firewall nat
# Masquerade (Internet Sharing)
add chain=srcnat out-interface=ether1-WAN action=masquerade comment="WAN Masquerade"

# Force DNS Redirect (For Walled Garden Reliability)
add chain=dstnat protocol=udp dst-port=53 action=redirect to-ports=53 comment="Force DNS UDP"
add chain=dstnat protocol=tcp dst-port=53 action=redirect to-ports=53 comment="Force DNS TCP"

/ip firewall filter
# Basic Security + Allow Direct Internet
add chain=input action=accept protocol=icmp comment="Allow Ping"
add chain=input action=accept connection-state=established,related comment="Accept Established"
add chain=forward action=accept connection-state=established,related comment="Accept Established Forward"
# Explicitly Allow Direct Network Internet
add chain=forward action=accept src-address=192.168.55.0/24 out-interface=ether1-WAN comment="Allow Direct Internet"
add chain=forward action=accept dst-address=192.168.55.0/24 in-interface=ether1-WAN comment="Allow Direct Internet Return"

# ==========================================
# 4. Hotspot Setup
# ==========================================
# Create Hotspot Profile
/ip hotspot profile
add name=hsprof1 login-by=http-pap,mac-cookie dns-name="wifi.mayapyap" hotspot-address=10.0.0.1 html-directory=hotspot

# Create Hotspot Server
/ip pool add name=pool-Hotspot ranges=10.0.0.10-10.0.0.254
/ip dhcp-server network add address=10.0.0.0/24 gateway=10.0.0.1 dns-server=10.0.0.1
/ip dhcp-server add name=dhcp-Hotspot interface=bridge-Hotspot address-pool=pool-Hotspot disabled=no
/ip hotspot add name=hotspot1 interface=bridge-Hotspot profile=hsprof1 disabled=no

# User Profile with Sync Scripts
/ip hotspot user profile
set [ find default=yes ] \
    on-login=":local mac \$(\"mac-address\"); :local user \$username; :local url (\"$GASURL?action=updateConnection&mac=\" . \$mac . \"&status=ONLINE&mobile=\" . \$user); /tool fetch url=\$url mode=https keep-result=no check-certificate=no" \
    on-logout=":local mac \$(\"mac-address\"); :local url (\"$GASURL?action=updateConnection&mac=\" . \$mac . \"&status=OFFLINE\"); /tool fetch url=\$url mode=https keep-result=no check-certificate=no"

# ==========================================
# 5. Walled Garden (Ports 80/443 Explicit)
# ==========================================
/ip hotspot walled-garden
add dst-host=*script.google.com dst-port=443 comment="Google Script"
add dst-host=*script.google.com dst-port=80
add dst-host=*googleusercontent.com dst-port=443
add dst-host=*accounts.google.com dst-port=443
add dst-host=*google.com dst-port=443
add dst-host=*paymongo.com
add dst-host=*cdn.tailwindcss.com
add dst-host=*cdnjs.cloudflare.com
add dst-host=*images.unsplash.com
add dst-host=*semaphore.co

# ==========================================
# 6. Sync Scripts
# ==========================================
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

/system scheduler remove [find name="SyncUsersSchedule"]
/system scheduler remove [find name="KickUsersSchedule"]
/system scheduler
add name="SyncUsersSchedule" interval=10s on-event="SyncUsersParams"
add name="KickUsersSchedule" interval=1m on-event="KickUsersParams"

:log info "WiFi sa Mayapyap Setup Complete!"
