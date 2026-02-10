# Script to Move Ports 4 & 5 to Direct Internet (No Hotspot)
# Run this if you already set up the router and want Ports 4 & 5 to be automatic.

# 1. Remove Ports 4 & 5 from the existing Bridge
/interface bridge port remove [find interface=ether4]
/interface bridge port remove [find interface=ether5]

# 2. Create New Direct Bridge
/interface bridge add name=bridge-Direct

# 3. Add Ports to New Bridge
/interface bridge port add bridge=bridge-Direct interface=ether4
/interface bridge port add bridge=bridge-Direct interface=ether5

# 4. Assign IP Address to New Bridge
/ip address add address=192.168.55.1/24 interface=bridge-Direct

# 5. Setup DHCP Server for Direct Internet
/ip pool add name=pool-Direct ranges=192.168.55.10-192.168.55.254
/ip dhcp-server network add address=192.168.55.0/24 gateway=192.168.55.1 dns-server=8.8.8.8,8.8.4.4
/ip dhcp-server add name=dhcp-Direct interface=bridge-Direct address-pool=pool-Direct disabled=no

:log info "Ports 4 and 5 moved to bridge-Direct with Automatic Internet."
