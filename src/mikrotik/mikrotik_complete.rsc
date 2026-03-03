# Mikrotik hEX S Complete Configuration for ARASU WiFi sa Bukid
# For RouterOS v7+
# -----------------------------------------------------------
# NOTE: If you see "failure: not allowed by device-mode", run:
# /system device-mode update allow-http-fetch=yes
# (You may need to press a button on the router or reboot to confirm)
# -----------------------------------------------------------

/system identity set name="ARASU_WiFi_Bukid"

# 1. Bridge Setup
/interface bridge add name=bridge-Direct comment="Ports 2-3: No Password"
/interface bridge add name=bridge-Hotspot comment="Ports 4-5: Hotspot Required"

/interface bridge port
add bridge=bridge-Direct interface=ether2
add bridge=bridge-Direct interface=ether3
add bridge=bridge-Hotspot interface=ether4
add bridge=bridge-Hotspot interface=ether5

# 2. IP Addressing
/ip address
add address=10.5.10.1/24 interface=bridge-Direct network=10.5.10.0
add address=10.5.50.1/24 interface=bridge-Hotspot network=10.5.50.0

# 3. DHCP Server
/ip pool
add name=pool-Direct ranges=10.5.10.10-10.5.10.250
add name=pool-Hotspot ranges=10.5.50.10-10.5.50.250

/ip dhcp-server
add address-pool=pool-Direct interface=bridge-Direct name=dhcp-Direct
add address-pool=pool-Hotspot interface=bridge-Hotspot name=dhcp-Hotspot

/ip dhcp-server network
add address=10.5.10.0/24 dns-server=8.8.8.8,1.1.1.1 gateway=10.5.10.1
add address=10.5.50.0/24 dns-server=10.5.50.1 gateway=10.5.50.1

/ip dns set allow-remote-requests=yes

# 4. WAN Client (Port 1)
/ip dhcp-client add interface=ether1 disabled=no

# 5. NAT
/ip firewall nat add action=masquerade chain=srcnat out-interface=ether1

# 6. Hotspot Setup
/ip hotspot profile
add dns-name=wifi.bukid hotspot-address=10.5.50.1 name=hsprof1 \
    html-directory=hotspot login-by=http-pap,http-chap,cookie

/ip hotspot
add address-pool=pool-Hotspot disabled=no interface=bridge-Hotspot name=hotspot1 profile=hsprof1

# 7. Walled Garden (Allow Google/Paymongo)
/ip hotspot walled-garden
add dst-host=*.paymongo.com
add dst-host=*.semaphore.co
add dst-host=script.google.com
add dst-host=script.googleusercontent.com
add dst-host=accounts.google.com
add dst-host=ssl.gstatic.com
add dst-host=fonts.googleapis.com
add dst-host=fonts.gstatic.com
add dst-host=*.google.com
add dst-host=*.gstatic.com
add dst-host=cdn.jsdelivr.net
add dst-host=cdn.tailwindcss.com
add dst-host=unpkg.com

# 8. Automation Scripts
/system script
add name=LoadConfig policy=read,write,policy,test,api source={
  :global apiUrl "YOUR_FULL_WEB_APP_URL"
  :global apiToken "YOUR_MIKROTIK_TOKEN"
}

add name=SyncUsers policy=read,write,policy,test,api source={
  /system script run LoadConfig
  :global apiUrl
  :global apiToken

  :do {
    /tool fetch url=($apiUrl . "?action=getNewUsers&token=" . $apiToken) mode=http dst-path=users.txt check-certificate=no
    :delay 2s
    :local content [/file get users.txt contents]
    :if ([:len $content] > 0) do={
      :local users [:toarray $content "|"]
      :local synced ""
      :foreach user in=$users do={
        :local fields [:toarray $user ","]
        :local uName ($fields->0)
        :local uPass ($fields->1)
        :local uTime ($fields->2)
        :local uSpeed ($fields->3)

        /ip hotspot user add name=$uName password=$uPass limit-uptime=$uTime profile=default limit-rate=$uSpeed
        :set synced ($synced . $uName . ",")
      }
      /tool fetch url=($apiUrl . "?action=markSynced&token=" . $apiToken . "&usernames=" . [:url-encode $synced]) mode=http check-certificate=no
    }
    /file remove users.txt
  } on-error={ :log error "SyncUsers failed" }
}

add name=KickUsers policy=read,write,policy,test,api source={
  /system script run LoadConfig
  :global apiUrl
  :global apiToken

  :do {
    /tool fetch url=($apiUrl . "?action=getKickList&token=" . $apiToken) mode=http dst-path=kick.txt check-certificate=no
    :delay 2s
    :local content [/file get kick.txt contents]
    :if ([:len $content] > 0) do={
      :local users [:toarray $content ","]
      :foreach user in=$users do={
        /ip hotspot user remove [find name=$user]
        /ip hotspot active remove [find user=$user]
      }
    }
    /file remove kick.txt
  } on-error={ :log error "KickUsers failed" }
}

# 9. Scheduler
/system scheduler
add interval=1m name=sched-Sync on-event=SyncUsers start-time=startup policy=read,write,policy,test,api
add interval=5m name=sched-Kick on-event=KickUsers start-time=startup policy=read,write,policy,test,api

# 10. Connection Tracking
/ip hotspot user profile
set [ find default=yes ] on-login=":global apiUrl; :global apiToken; /tool fetch url=\"$apiUrl\" http-method=post http-data=\"{\\\"action\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"$apiToken\\\",\\\"username\\\":\\\"$user\\\",\\\"status\\\":\\\"Connected\\\",\\\"mac\\\":\\\"$mac-address\\\"}\" keep-result=no check-certificate=no" \
    on-logout=":global apiUrl; :global apiToken; /tool fetch url=\"$apiUrl\" http-method=post http-data=\"{\\\"action\\\":\\\"updateConnection\\\",\\\"token\\\":\\\"$apiToken\\\",\\\"username\\\":\\\"$user\\\",\\\"status\\\":\\\"Disconnected\\\"}\" keep-result=no check-certificate=no"
