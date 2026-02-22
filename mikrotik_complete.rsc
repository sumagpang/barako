# WiFi sa Bukid - Mikrotik hEX S Complete Configuration
# ISP: ether1
# Direct LAN: ether2, ether3 (Bridge-Direct)
# Hotspot: ether4, ether5 (Bridge-Hotspot)

/system identity set name="WiFi-sa-Bukid"

# 0. CONFIGURATION - CHANGE THESE VALUES
# These will be stored in a script to persist across reboots.
/system script
add name=LoadConfig source=":global apiUrl \"YOUR_API_URL\"; :global apiToken \"YOUR_MIKROTIK_TOKEN\";"

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
/ip hotspot walled-garden
add dst-host=*.paymongo.com
add dst-host=*.semaphore.co
add dst-host=script.google.com
add dst-host=script.googleusercontent.com
add dst-host=accounts.google.com
add dst-host=ssl.gstatic.com
add dst-host=fonts.googleapis.com
add dst-host=fonts.gstatic.com
add dst-host=cdn.jsdelivr.net
add dst-host=cdn.tailwindcss.com
add dst-host=unpkg.com

# 8. Sync Scripts
/system script
add name=SyncUsers policy=read,write,policy,test,api source="/system script run LoadConfig; :global apiUrl; :global apiToken; :if ([:len \$apiUrl] = 0 || [:len \$apiToken] = 0) do={ :log error \"SyncUsers: Global variables not set. Check LoadConfig script.\"; :error \"Missing config\" }; :local syncedUsers \"\"; :do { :log info \"SyncUsers: Fetching new users...\"; /tool fetch url=(\$apiUrl . \"?action=getNewUsers&token=\" . \$apiToken) check-certificate=no keep-result=yes dst-path=users.txt; :local fileObj [/file find name=users.txt]; :if ([:len \$fileObj] > 0) do={ :local content [/file get users.txt contents]; :if ([:len \$content] > 0) do={ :log info \"SyncUsers: Processing users data...\"; :local pos 0; :while (\$pos < [:len \$content]) do={ :local end [:find \$content \"|\" \$pos]; :if ([:typeof \$end] = \"nil\") do={ :set end [:len \$content] }; :local record [:pick \$content \$pos \$end]; :set pos (\$end + 1); :if ([:len \$record] > 0) do={ :local fields [:toarray \$record]; :local uname (\$fields->0); :local pass (\$fields->1); :local duration (\$fields->2); :local speed (\$fields->3); :if ([:len [/ip hotspot user find name=\$uname]] = 0) do={ /ip hotspot user add name=\$uname password=\$pass limit-uptime=\$duration rate-limit=\$speed comment=\"Synced\"; :log info \"SyncUsers: Added user \$uname\"; } else={ /ip hotspot user set [find name=\$uname] password=\$pass limit-uptime=\$duration rate-limit=\$speed; :log info \"SyncUsers: Updated user \$uname\"; }; :set syncedUsers (\$syncedUsers . \$uname . \",\"); }; }; :if ([:len \$syncedUsers] > 0) do={ :log info \"SyncUsers: Marking users as synced...\"; /tool fetch url=(\$apiUrl . \"?action=markSynced&token=\" . \$apiToken . \"&usernames=\" . \$syncedUsers) check-certificate=no keep-result=no; }; } else={ :log info \"SyncUsers: No new users found.\"; }; /file remove users.txt; } else={ :log error \"SyncUsers: users.txt not created. Fetch might have failed.\"; }; } on-error={ :log error \"SyncUsers: Script execution failed. Check network/URL.\"; }"

add name=KickUsers policy=read,write,policy,test,api source="/system script run LoadConfig; :global apiUrl; :global apiToken; :if ([:len \$apiUrl] = 0 || [:len \$apiToken] = 0) do={ :log error \"KickUsers: Global variables not set. Check LoadConfig script.\"; :error \"Missing config\" }; :do { :log info \"KickUsers: Fetching kick list...\"; /tool fetch url=(\$apiUrl . \"?action=getKickList&token=\" . \$apiToken) check-certificate=no keep-result=yes dst-path=kick.txt; :local fileObj [/file find name=kick.txt]; :if ([:len \$fileObj] > 0) do={ :local content [/file get kick.txt contents]; :if ([:len \$content] > 0) do={ :log info \"KickUsers: Processing kick list...\"; :local pos 0; :while (\$pos < [:len \$content]) do={ :local end [:find \$content \"|\" \$pos]; :if ([:typeof \$end] = \"nil\") do={ :set end [:len \$content] }; :local uname [:pick \$content \$pos \$end]; :set pos (\$end + 1); :if ([:len \$uname] > 0) do={ :if ([:len [/ip hotspot user find name=\$uname]] > 0) do={ /ip hotspot user remove [find name=\$uname]; :log info \"KickUsers: Removed user \$uname\"; }; /ip hotspot active remove [find user=\$uname]; }; }; } else={ :log info \"KickUsers: Kick list is empty.\"; }; /file remove kick.txt; } else={ :log error \"KickUsers: kick.txt not created. Fetch might have failed.\"; }; } on-error={ :log error \"KickUsers: Script execution failed. Check network/URL.\"; }"

# 9. Real-time Status Sync (on-login/on-logout)
/ip hotspot user profile
set [ find default=yes ] on-login="/system script run LoadConfig; :global apiUrl; :global apiToken; /tool fetch url=(\$apiUrl . \"?rpc=true\") check-certificate=no http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"\$apiToken\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Online\\\"}]}\" keep-result=no" \
    on-logout="/system script run LoadConfig; :global apiUrl; :global apiToken; /tool fetch url=(\$apiUrl . \"?rpc=true\") check-certificate=no http-method=post http-data=\"{\\\"method\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"\$apiToken\\\",\\\"args\\\":[{\\\"username\\\":\\\"\$user\\\",\\\"status\\\":\\\"Offline\\\"}]}\" keep-result=no"

/system scheduler
add interval=30s name=SyncTask on-event=SyncUsers policy=read,write,policy,test,api start-time=startup
add interval=30s name=KickTask on-event=KickUsers policy=read,write,policy,test,api start-time=startup
add name=StartupTask on-event=LoadConfig policy=read,write,policy,test,api start-time=startup
