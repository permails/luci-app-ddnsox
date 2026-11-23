import * as http from '/usr/share/ddnsox/lib/http.uc';

function is_private_or_cgnat_v4(ip) {
	let b = iptoarr(ip);
	if (!b || length(b) != 4)
		return true;

	if (b[0] == 0 || b[0] == 10 || b[0] == 127)
		return true;
	if (b[0] == 100 && b[1] >= 64 && b[1] <= 127)
		return true;
	if (b[0] == 169 && b[1] == 254)
		return true;
	if (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
		return true;
	if (b[0] == 192 && b[1] == 168)
		return true;
	if (b[0] >= 224)
		return true;

	return false;
}

function is_cgnat_v4(ip) {
	let b = iptoarr(ip);
	if (!b || length(b) != 4)
		return false;
	return (b[0] == 100 && b[1] >= 64 && b[1] <= 127);
}

function is_invalid_public_v6(ip) {
	let b = iptoarr(ip);
	if (!b || length(b) != 16)
		return true;

	let nonzero = 0;
	for (let i = 0; i < 15; i++)
		nonzero += b[i];
	if (nonzero == 0 && (b[15] == 0 || b[15] == 1))
		return true;

	// fe80::/10 (Link-local)
	if (b[0] == 0xfe && (b[1] & 0xc0) == 0x80)
		return true;

	// fc00::/7 (ULA)
	if ((b[0] & 0xfe) == 0xfc)
		return true;

	// ff00::/8 (Multicast)
	if (b[0] == 0xff)
		return true;

	// 2001:db8::/32 (Documentation)
	if (b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x0d && b[3] == 0xb8)
		return true;

	return false;
}

function has_default_route(iface, family) {
	let target = (family == 6) ? '::' : '0.0.0.0';
	for (let rt in (iface.route || [])) {
		if (rt.target == target && int(rt.mask) == 0)
			return true;
	}
	return false;
}

function find_interface(ifaces, target_name, family) {
	if (target_name && target_name != 'auto') {
		for (let iface in ifaces) {
			if (iface.interface == target_name && iface.up)
				return iface;
		}
		return null;
	}

	for (let iface in ifaces) {
		if (!iface.up)
			continue;
		if (has_default_route(iface, family))
			return iface;
	}

	let fallback = (family == 6) ? 'wan6' : 'wan';
	for (let iface in ifaces) {
		if (iface.interface == fallback && iface.up)
			return iface;
	}
	return null;
}

function pick_iface_v4(iface, allow_private) {
	let first_private = null;
	for (let entry in (iface['ipv4-address'] || [])) {
		let addr = entry.address;
		if (!addr) continue;
		if (!is_private_or_cgnat_v4(addr))
			return { ip: addr, is_private: false, is_cgnat: false };
		if (!first_private)
			first_private = addr;
	}
	if (first_private) {
		return {
			ip: allow_private ? first_private : null,
			raw_ip: first_private,
			is_private: true,
			is_cgnat: is_cgnat_v4(first_private)
		};
	}
	return null;
}

function pick_iface_v6(iface, allow_private) {
	let candidates = [];
	for (let entry in (iface['ipv6-address'] || [])) {
		let addr = entry.address;
		if (!addr) continue;

		if (exists(entry, 'preferred') && int(entry.preferred) <= 0)
			continue;

		if (entry.temporary == true || entry.deprecated == true)
			continue;

		if (is_invalid_public_v6(addr) && !allow_private)
			continue;

		push(candidates, {
			ip: addr,
			preferred: exists(entry, 'preferred') ? int(entry.preferred) : 0,
			ula: ((iptoarr(addr)?.[0] & 0xfe) == 0xfc)
		});
	}

	if (length(candidates) == 0)
		return null;

	sort(candidates, (a, b) => {
		if (a.ula != b.ula) return a.ula ? 1 : -1;
		return b.preferred - a.preferred;
	});

	return candidates[0];
}

function probe_public_url(urls, family, bind_device) {
	for (let url in (urls || [])) {
		let res = http.get(url, { 'User-Agent': 'ddnsox/1.0' }, 8, bind_device);
		if (!res.ok || !res.body)
			continue;
		let candidate = trim(res.body);
		let m = (family == 6)
			? match(candidate, /([0-9a-fA-F:]+:[0-9a-fA-F:]+)/)
			: match(candidate, /(\d{1,3}(?:\.\d{1,3}){3})/);
		if (!m) continue;
		let arr = iptoarr(m[1]);
		if (!arr) continue;
		if (family == 4 && length(arr) == 4 && !is_private_or_cgnat_v4(m[1]))
			return { ip: m[1], source: 'url:' + url };
		if (family == 6 && length(arr) == 16 && !is_invalid_public_v6(m[1]))
			return { ip: m[1], source: 'url:' + url };
	}
	return null;
}

function probe_address(ubus_conn, opts) {
	let family = opts?.family == 6 ? 6 : 4;
	let iface_name = opts?.interface || 'auto';
	let ip_source = opts?.ip_source || 'auto';
	let allow_private = !!opts?.allow_private_ip;
	let urls = opts?.public_urls || [];

	let dump = ubus_conn.call('network.interface', 'dump', {});
	let ifaces = dump?.interface || [];
	let target_iface = find_interface(ifaces, iface_name, family);
	let bind_dev = (iface_name != 'auto' && target_iface) ? (target_iface.l3_device || target_iface.device || null) : null;

	if (ip_source != 'public_url' && target_iface) {
		if (family == 4) {
			let picked = pick_iface_v4(target_iface, allow_private);
			if (picked?.ip) {
				return {
					ok: true,
					ip: picked.ip,
					interface: target_iface.interface,
					cgnat: picked.is_cgnat,
					ula: false,
					source: 'interface:' + target_iface.interface
				};
			}
			if (ip_source == 'auto' && picked?.is_private) {
				let pub = probe_public_url(urls, 4, bind_dev);
				if (pub) {
					return {
						ok: true,
						ip: pub.ip,
						interface: target_iface.interface,
						cgnat: picked.is_cgnat,
						ula: false,
						source: pub.source
					};
				}
				return {
					ok: false,
					ip: null,
					interface: target_iface.interface,
					cgnat: picked.is_cgnat,
					ula: false,
					error: sprintf('Interface %s only has private/CGNAT IP (%s) and public probe failed',
						target_iface.interface, picked.raw_ip)
				};
			}
		} else {
			let picked = pick_iface_v6(target_iface, allow_private);
			if (picked?.ip) {
				return {
					ok: true,
					ip: picked.ip,
					interface: target_iface.interface,
					cgnat: false,
					ula: picked.ula,
					source: 'interface:' + target_iface.interface
				};
			}
		}
	}

	if (ip_source == 'public_url' || ip_source == 'auto') {
		let pub = probe_public_url(urls, family, bind_dev);
		if (pub) {
			return {
				ok: true,
				ip: pub.ip,
				interface: target_iface?.interface || iface_name,
				cgnat: false,
				ula: false,
				source: pub.source
			};
		}
	}

	return {
		ok: false,
		ip: null,
		interface: target_iface?.interface || null,
		cgnat: false,
		ula: false,
		error: sprintf('No valid public IPv%d address found on interface %s',
			family, target_iface?.interface || iface_name)
	};
}

export { is_private_or_cgnat_v4, is_cgnat_v4, is_invalid_public_v6, probe_address };
