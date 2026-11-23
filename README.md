# luci-app-ddnsox

Event-driven Dynamic DNS (`ddnsox`) and LuCI2 frontend (`luci-app-ddnsox`) for OpenWrt 23.05 and 25.12+, written in native `ucode` and client-side ES6 JavaScript.

It is designed as a modern drop-in replacement for legacy `ddns-scripts` and `luci-app-ddns`, eliminating shell polling loops, `.pid`/`.dat` state files, and local DNS cache/fake-ip pollution.

## Features

- **Event-Driven Architecture**: Managed by `procd` (`USE_PROCD=1`) and `uloop`. Subscribes directly to `netifd` `network.interface` `ubus` events with debouncing, waking rules immediately on WAN link or IP changes.
- **Smart IPv4 / IPv6 Filtering**:
  - Automatically discovers default-route interfaces via `network.interface dump`.
  - Filters RFC1918, CGNAT (`100.64.0.0/10`), loopback, and link-local IPv4 addresses, falling back to HTTPS public IP probes behind CGNAT.
  - Filters IPv6 link-local (`fe80::/10`), ULA (`fc00::/7`), `deprecated`, and `temporary` addresses to select stable global unicast addresses (GUA).
- **Anti-Poisoning DNS Verification**: Verifies live DNS records via DoH (`223.5.5.5`, `1.1.1.1`, or custom) or direct authoritative nameserver queries, bypassing local port 53 (`dnsmasq` cache or proxy fake-ip).
- **Multi-WAN Outbound Binding**: Supports binding individual rules to specific WAN interfaces (e.g., `wan`, `wan2`, `wan6`). When behind CGNAT, probes bind to the target interface `l3_device` (`curl --interface`) to obtain the true outbound IP.
- **Special Environments**: Per-rule HTTP/SOCKS5 proxy support (applies only to provider API updates without affecting WAN IP probing) and custom verification DNS/DoH overrides for internal domains.
- **Single-Rule Dual Stack & FQDN Auto-Split**: Supports `dual`, `ipv4`, and `ipv6` in a single rule and automatically splits standard FQDNs (including Namecheap `host` + `domain` splitting).
- **Legacy Migration**: Automatically migrates `/etc/config/ddns` on first installation via `uci-defaults` or on demand from the UI/RPC, merging IPv4/IPv6 pairs into dual-stack rules.
- **Least-Privilege RPCD & Pure LuCI2 UI**: Exposes structured JSON via `luci.ddnsox` without shell execution or `cgi-io`, with full Light/Dark theme variable adaptation and i18n (`zh_Hans` included).

## Package Structure

```text
.
├── ddnsox/                # ucode event-driven daemon (CONFLICTS:=ddns-scripts)
└── luci-app-ddnsox/       # LuCI2 ES6 frontend, rpcd bridge, ACL, menu, i18n
```

## Supported Providers

- **Native ucode adapters**: Cloudflare (API v4), Aliyun DNS, DNSPod / Tencent Cloud (v3), Porkbun (API v3), DynDNS2 (No-IP, etc.).
- **URL template engine**: 66+ upstream OpenWrt DDNS provider templates (Namecheap with automatic host/zone split, DuckDNS, Oray, 3322, Dyn, FreeDNS, OVH, ZoneEdit, etc.) plus Custom Webhook templates.

## Building from Source

Place `ddnsox/` and `luci-app-ddnsox/` into your OpenWrt buildroot `package/` directory:

```bash
rm -rf tmp/
make defconfig
make package/ddnsox/compile V=s
make package/luci-app-ddnsox/compile V=s
```

In `make menuconfig`:

- `Network -> IP Addresses and Names -> ddnsox`
- `LuCI -> 3. Applications -> luci-app-ddnsox`

## UCI Configuration (`/etc/config/ddnsox`)

```text
config global 'global'
	option enabled '1'
	option use_authoritative_ns '1'
	option check_interval '1800'
	option log_lines '300'
	option log_level 'info'
	list doh_servers 'https://223.5.5.5/dns-query'
	list doh_servers 'https://1.1.1.1/dns-query'

config rule 'my_rule'
	option enabled '1'
	option provider 'cloudflare.com-v4'
	option domain 'nas.example.com'
	option ip_mode 'dual'
	option password 'your_api_token'
	option interface 'auto'
	option ip_source 'auto'
```

## ubus Interfaces

- Daemon object (`ddnsox`): `status`, `sync`, `probe`, `get_log`, `reload`
- LuCI RPC bridge (`luci.ddnsox`): `get_overview`, `get_providers`, `trigger_sync`, `test_probe`, `get_logs`, `service_action`, `migrate_legacy`

## License

Apache-2.0

Copyright (C) 2026 permails <logo@permails.com>
