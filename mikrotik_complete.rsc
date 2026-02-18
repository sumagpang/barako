# ARASU WiFi sa Bukid - Mikrotik hEX S Complete Configuration
# ISP: ether1
# Direct LAN: ether2, ether3 (Bridge-Direct)
# Hotspot: ether4, ether5 (Bridge-Hotspot)

/system identity set name="ARASU-WiFi"

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
add dns-name=hotspot.arasu.net hotspot-address=10.0.0.1 login-by=http-pap name=hsprof1

/ip hotspot
add address-pool=pool-Hotspot disabled=no interface=bridge-Hotspot name=hotspot1 profile=hsprof1

/ip hotspot user profile
set [ find default=yes ] shared-users=1

# 7. Walled Garden (Allow Paymongo, Semaphore, and Google)
/ip hotspot walled-garden
add dst-host=*.paymongo.com
add dst-host=*.semaphore.co
add dst-host=*.google.com
add dst-host=*.googleapis.com
add dst-host=*.googleusercontent.com
add dst-host=*.gstatic.com
add dst-host=script.google.com

# 8. Sync Scripts
/system script
add name=SyncUsers source=":local apiUrl \"YOUR_API_URL\"\r\n:local token \"YOUR_TOKEN\"\r\n:do {\r\n  /tool fetch url=(\$apiUrl . \"?action=getNewUsers&token=\" . \$token) mode=http keep-result=yes dst-path=users.txt\r\n  :local content [/file get users.txt contents]\r\n  # Minimal JSON parser for the expected user format\r\n  :if ([:len \$content] > 2) do={\r\n    :local pos 0\r\n    :while (\$pos < [:len \$content]) do={\r\n      :local userStart [:find \$content \"{\" \$pos]\r\n      :if ([:len \$userStart] = 0) do={ :set \$pos [:len \$content] } else={\r\n        :local userEnd [:find \$content \"}\" \$userStart]\r\n        :local userStr [:pick \$content \$userStart (\$userEnd + 1)]\r\n        \r\n        :local uStart ([:find \$userStr \"\\\"username\\\":\\\"\"] + 12)\r\n        :local uEnd [:find \$userStr \"\\\"\" \$uStart]\r\n        :local user [:pick \$userStr \$uStart \$uEnd]\r\n        \r\n        :local pStart ([:find \$userStr \"\\\"passcode\\\":\\\"\"] + 12)\r\n        :local pEnd [:find \$userStr \"\\\"\" \$pStart]\r\n        :local pass [:pick \$userStr \$pStart \$pEnd]\r\n\r\n        :if ([:len \$user] > 0) do={\r\n          :if ([:len [/ip hotspot user find name=\$user]] = 0) do={\r\n            /ip hotspot user add name=\$user password=\$pass comment=\"Synced\"\r\n            :log info \"Added user: \$user\"\r\n          } else={\r\n            /ip hotspot user set [find name=\$user] password=\$pass\r\n          }\r\n        }\r\n        :set \$pos (\$userEnd + 1)\r\n      }\r\n    }\r\n  }\r\n} on-error={ :log error \"Sync failed\" }"

# 9. Real-time Status Sync (on-login/on-logout)
/ip hotspot user profile
set [ find default=yes ] on-login=":local apiUrl \"YOUR_API_URL\"\r\n/tool fetch url=(\$apiUrl . \"?rpc=true\") http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Online\\\"}]}\" keep-result=no" \
    on-logout=":local apiUrl \"YOUR_API_URL\"\r\n/tool fetch url=(\$apiUrl . \"?rpc=true\") http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Offline\\\"}]}\" keep-result=no"

/system scheduler
add interval=1m name=SyncTask on-event=SyncUsers start-time=startup
