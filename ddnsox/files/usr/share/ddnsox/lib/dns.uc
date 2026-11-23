import * as http from '/usr/share/ddnsox/lib/http.uc';

let resolv = null;
try {
	resolv = require('resolv');
} catch (e) {
	resolv = null;
}

function query_doh(doh_url, domain, rrtype) {
	let sep = index(doh_url, '?') >= 0 ? '&' : '?';
	let url = sprintf('%s%sname=%s&type=%s', doh_url, sep, domain, rrtype);
	let res = http.json_request({
		method: 'GET',
		url: url,
		headers: {
			'Accept': 'application/dns-json',
			'User-Agent': 'ddnsox/1.0'
		},
		timeout: 8
	});

	if (!res.ok || !res.data)
		return { ok: false, ips: [], error: res.error || 'Invalid DoH JSON response' };

	if (int(res.data.Status) != 0 && int(res.data.Status) != 3)
		return { ok: false, ips: [], error: sprintf('DoH RCODE %d', int(res.data.Status)) };

	let target_type = (rrtype == 'AAAA') ? 28 : 1;
	let ips = [];
	for (let ans in (res.data.Answer || [])) {
		if (int(ans.type) == target_type && ans.data)
			push(ips, trim(ans.data));
	}

	return {
		ok: true,
		ips: ips,
		source: 'doh:' + replace(doh_url, /^https?:\/\/([^\/]+).*$/, '$1')
	};
}

function query_authoritative_ns(domain, rrtype) {
	if (!resolv)
		return { ok: false, ips: [], error: 'ucode-mod-resolv not installed' };
	let labels = split(domain, '.');
	let ns_hosts = [];
	for (let i = 0; i < length(labels) - 1; i++) {
		let zone = join('.', slice(labels, i));
		try {
			let res = resolv.query(zone, { type: ['NS'] });
			if (res && res[zone]?.NS) {
				ns_hosts = res[zone].NS;
				break;
			}
		} catch (e) {}
	}

	if (length(ns_hosts) == 0)
		return { ok: false, ips: [], error: 'Authoritative NS lookup failed' };

	let ns_ip = null;
	try {
		let ns_a = resolv.query(ns_hosts[0], { type: ['A'] });
		ns_ip = ns_a?.[ns_hosts[0]]?.A?.[0];
	} catch (e) {}

	if (!ns_ip)
		return { ok: false, ips: [], error: 'Failed to resolve authoritative NS IP' };

	try {
		let ans = resolv.query(domain, { type: [rrtype], nameserver: [ns_ip] });
		let ips = ans?.[domain]?.[rrtype] || [];
		return {
			ok: true,
			ips: ips,
			source: 'ns:' + ns_hosts[0]
		};
	} catch (e) {
		return { ok: false, ips: [], error: 'Authoritative NS query failed' };
	}
}

function query_direct_dns(domain, rrtype, server_ip) {
	if (resolv) {
		try {
			let ans = resolv.query(domain, { type: [rrtype], nameserver: [server_ip] });
			let ips = ans?.[domain]?.[rrtype] || [];
			return { ok: true, ips: ips, source: 'dns:' + server_ip };
		} catch (e) {}
	}
	return { ok: false, ips: [], error: 'Direct DNS query to ' + server_ip + ' failed (ucode-mod-resolv required)' };
}

function lookup_clean(domain, family, opts) {
	let rrtype = (family == 6) ? 'AAAA' : 'A';
	let custom_dns = opts?.custom_dns_server ? trim(opts.custom_dns_server) : '';

	if (custom_dns) {
		if (match(custom_dns, /^https:\/\//))
			return query_doh(custom_dns, domain, rrtype);
		return query_direct_dns(domain, rrtype, custom_dns);
	}

	let doh_servers = opts?.doh_servers || [];

	for (let doh_url in doh_servers) {
		let res = query_doh(doh_url, domain, rrtype);
		if (res.ok)
			return res;
	}

	if (opts?.use_authoritative_ns != false) {
		let ns_res = query_authoritative_ns(domain, rrtype);
		if (ns_res.ok)
			return ns_res;
	}

	return {
		ok: false,
		ips: [],
		source: 'none',
		error: 'All clean DNS verification sources (DoH / Authoritative NS) failed'
	};
}

function ip_matches(ip, ips) {
	let target = iptoarr(ip);
	if (!target)
		return false;
	for (let item in (ips || [])) {
		let arr = iptoarr(item);
		if (!arr || length(arr) != length(target))
			continue;
		let same = true;
		for (let i = 0; i < length(target); i++) {
			if (arr[i] != target[i]) {
				same = false;
				break;
			}
		}
		if (same)
			return true;
	}
	return false;
}

export { lookup_clean, ip_matches };
