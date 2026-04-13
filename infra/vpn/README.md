# VPN for Docker Compose

The compose stack uses `qmcgaw/gluetun` as a VPN gateway container.

Current topology:

```text
Windows WireGuard endpoint: 192.168.1.12:51820
Windows VPN IP:            10.13.13.1
Mac VPN IP:                10.13.13.2
Windows SymmetricDS:       http://10.13.13.1:31415/sync/node-win
Mac SymmetricDS:           http://10.13.13.2:31415/sync/node-mac
```

`app` and `symmetricds` use:

```yaml
network_mode: "service:vpn"
```

That means their outbound traffic goes through the VPN container, while the host system keeps its normal network route.

Fill these values in `.env.local` from the Windows-generated WireGuard peer config:

```text
WIREGUARD_PRIVATE_KEY   = [Interface] PrivateKey
WIREGUARD_PUBLIC_KEY    = [Peer] PublicKey
WIREGUARD_PRESHARED_KEY = [Peer] PresharedKey
WIREGUARD_ADDRESSES     = [Interface] Address, usually 10.13.13.2/32
```

The endpoint values are:

```text
VPN_ENDPOINT_IP=192.168.1.12
VPN_ENDPOINT_PORT=51820
WIREGUARD_ENDPOINT_IP=192.168.1.12
WIREGUARD_ENDPOINT_PORT=51820
WIREGUARD_ALLOWED_IPS=10.13.13.0/24
```

For SymmetricDS traffic arriving through the VPN tunnel:

```text
FIREWALL_VPN_INPUT_PORTS=31415
```

This is a private WireGuard tunnel, not a public internet VPN. Keep Gluetun's health checks on the Windows peer instead of the default internet targets:

```text
HEALTH_TARGET_ADDRESSES=10.13.13.1:31415
HEALTH_ICMP_TARGET_IPS=10.13.13.1
PUBLICIP_ENABLED=off
DOT=off
BLOCK_MALICIOUS=off
```

For Docker-published access from the host/LAN:

```text
FIREWALL_INPUT_PORTS=3000,31415
```

`FIREWALL_OUTBOUND_SUBNETS` keeps local/private database addresses reachable while Gluetun's firewall is enabled.

`gluetun-route-fix.sh` keeps the split-tunnel route present inside the Gluetun container:

```text
10.13.13.0/24 dev tun0
```
