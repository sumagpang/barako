# WiFi sa Bukid - Mikrotik hEX S Complete Configuration
# ISP: ether1
# Direct LAN: ether2, ether3 (Bridge-Direct)
# Hotspot: ether4, ether5 (Bridge-Hotspot)

/system identity set name="WiFi-sa-Bukid"

# 0. CONFIGURATION - CHANGE THESE VALUES
:global apiUrl "YOUR_API_URL"
:global apiToken "YOUR_MIKROTIK_TOKEN"

# 1. Bridges
/interface bridge
add name=bridge-Direct comment="Direct Internet (No Hotspot)"
add name=bridge-Hotspot comment="Hotspot Required"

/interface bridge port
add bridge=bridge-Direct interface=ether2
add bridge=bridge-Direct interface=ether3
add bridge=bridge-Hotspot interface=ether4
add bridge=bridge-Hotspot interface=ether5

# 2. IP Addresses
/ip address
add address=192.168.88.1/24 interface=bridge-Direct network=192.168.88.0
add address=10.0.0.1/24 interface=bridge-Hotspot network=10.0.0.0

# 3. WAN Configuration (ether1)
/ip dhcp-client
add disabled=no interface=ether1

# 4. Pools and DHCP Servers
/ip pool
add name=pool-Direct ranges=192.168.88.10-192.168.88.254
add name=pool-Hotspot ranges=10.0.0.10-10.0.0.254

/ip dhcp-server
add address-pool=pool-Direct disabled=no interface=bridge-Direct name=dhcp-Direct
add address-pool=pool-Hotspot disabled=no interface=bridge-Hotspot name=dhcp-Hotspot

/ip dhcp-server network
add address=192.168.88.0/24 dns-server=1.1.1.1,8.8.8.8 gateway=192.168.88.1
add address=10.0.0.0/24 dns-server=10.0.0.1 gateway=10.0.0.1

# 5. DNS and NAT
/ip dns
set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8

/ip firewall nat
add action=masquerade chain=srcnat out-interface=ether1
# Force DNS for Hotspot
add action=redirect chain=dstnat dst-port=53 protocol=udp to-ports=53
add action=redirect chain=dstnat dst-port=53 protocol=tcp to-ports=53

# 6. Hotspot Configuration
/ip hotspot profile
add dns-name=hotspot.bukid.net hotspot-address=10.0.0.1 login-by=http-pap name=hsprof1

/ip hotspot
add address-pool=pool-Hotspot disabled=no interface=bridge-Hotspot name=hotspot1 profile=hsprof1

/ip hotspot user profile
set [ find default=yes ] shared-users=1

# 7. Walled Garden (Allow Paymongo, Semaphore, and Google Apps Script)
# We avoid broad *.google.com to ensure "Captive Portal Detection" (auto-popup) works.
/ip hotspot walled-garden
add dst-host=*.paymongo.com
add dst-host=*.semaphore.co
add dst-host=script.google.com
add dst-host=script.googleusercontent.com
add dst-host=accounts.google.com comment="Required for Google Script redirects"
add dst-host=ssl.gstatic.com comment="Required for Google Script UI"
add dst-host=fonts.googleapis.com
add dst-host=fonts.gstatic.com
add dst-host=cdn.jsdelivr.net comment="Required for Tailwind/Vue/CDNs"

# 8. Sync Scripts
/system script
add name=SyncUsers source=":global apiUrl\r\n:global apiToken\r\n:local syncedUsers \"\"\r\n:do {\r\n  /tool fetch url=(\$apiUrl . \"?action=getNewUsers&token=\" . \$apiToken) mode=http check-certificate=no keep-result=yes dst-path=users.txt\r\n  :local content [/file get users.txt contents]\r\n  :if ([:len \$content] > 0) do={\r\n    :foreach entry in=[:toarray \$content] do={\r\n      :local comma1 [:find \$entry \",\"]\r\n      :if ([:len \$comma1] > 0) do={\r\n        :local user [:pick \$entry 0 \$comma1]\r\n        :local rest [:pick \$entry (\$comma1 + 1) [:len \$entry]]\r\n        :local comma2 [:find \$rest \",\"]\r\n        :local pass [:pick \$rest 0 \$comma2]\r\n        :local duration [:pick \$rest (\$comma2 + 1) [:len \$rest]]\r\n        :local uptime (\$duration . \"h\")\r\n        :if ([:len [/ip hotspot user find name=\$user]] = 0) do={\r\n          /ip hotspot user add name=\$user password=\$pass limit-uptime=\$uptime comment=\"Synced\"\r\n          :log info \"Added user: \$user\"\r\n        } else={\r\n          /ip hotspot user set [find name=\$user] password=\$pass limit-uptime=\$uptime\r\n        }\r\n        :set \$syncedUsers (\$syncedUsers . \$user . \",\")\r\n      }\r\n    }\r\n    :if ([:len \$syncedUsers] > 0) do={\r\n       /tool fetch url=(\$apiUrl . \"?action=markSynced&token=\" . \$apiToken . \"&usernames=\" . \$syncedUsers) check-certificate=no keep-result=no\r\n    }\r\n  }\r\n} on-error={ :log error \"Sync failed\" }"

add name=KickUsers source=":global apiUrl\r\n:global apiToken\r\n:do {\r\n  /tool fetch url=(\$apiUrl . \"?action=getKickList&token=\" . \$apiToken) mode=http check-certificate=no keep-result=yes dst-path=kick.txt\r\n  :local content [/file get kick.txt contents]\r\n  :if ([:len \$content] > 0) do={\r\n    :foreach user in=[:toarray \$content] do={\r\n      :if ([:len [/ip hotspot user find name=\$user]] > 0) do={\r\n        /ip hotspot user remove [find name=\$user]\r\n        :log info \"Removed user: \$user (Expired/Disabled)\"\r\n      }\r\n      /ip hotspot active remove [find user=\$user]\r\n    }\r\n  }\r\n} on-error={ :log error \"Kick failed\" }"

# 9. Real-time Status Sync (on-login/on-logout)
/ip hotspot user profile
set [ find default=yes ] on-login=":global apiUrl\r\n:global apiToken\r\n/tool fetch url=(\$apiUrl . \"?rpc=true\") check-certificate=no http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"\$apiToken\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Online\\\"}]}\" keep-result=no" \
    on-logout=":global apiUrl\r\n:global apiToken\r\n/tool fetch url=(\$apiUrl . \"?rpc=true\") check-certificate=no http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"\$apiToken\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Offline\\\"}]}\" keep-result=no"

/system scheduler
add interval=1m name=SyncTask on-event=SyncUsers start-time=startup
add interval=1m name=KickTask on-event=KickUsers start-time=startup
