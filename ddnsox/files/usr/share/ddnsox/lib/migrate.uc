import * as fs from 'fs';
import { cursor } from 'uci';

const SERVICE_MAP = {
	'cloudflare.com-v4': 'cloudflare_v4',
	'aliyun.com': 'aliyun',
	'dnspod.cn': 'dnspod',
	'dnspod.cn-v3': 'dnspod',
	'porkbun.com-v3': 'porkbun_v3',
	'huaweicloud.com': 'huaweicloud',
	'dyndns.org': 'dyndns2',
	'no-ip.com': 'dyndns2',
	'duckdns.org': 'dyndns2',
	'freedns.afraid.org': 'dyndns2'
};

function normalize_domain(raw) {
	if (!raw) return '';
	let s = trim(raw);
	s = replace(s, /^@+\./, '');
	s = replace(s, '@', '.');
	s = replace(s, /^\.+|\.+$/g, '');
	return lc(s);
}

function sanitize_section_name(name) {
	let s = replace(lc(name || 'rule'), /[^a-z0-9_]/g, '_');
	if (!match(s, /^[a-z]/))
		s = 'r_' + s;
	return s;
}

function has_legacy_config() {
	if (!fs.access('/etc/config/ddns', 'r'))
		return false;
	let u = cursor();
	let found = false;
	u.foreach('ddns', 'service', () => {
		found = true;
		return false;
	});
	return found;
}

function run(opts) {
	let dry_run = !!opts?.dry_run;
	if (!fs.access('/etc/config/ddns', 'r'))
		return { ok: false, migrated: 0, rules: [], message: 'Legacy /etc/config/ddns not found' };

	let u = cursor();
	let legacy_services = [];
	u.foreach('ddns', 'service', (sec) => {
		push(legacy_services, sec);
	});

	if (length(legacy_services) == 0)
		return { ok: true, migrated: 0, rules: [], message: 'No legacy service sections found' };

	let grouped = {};
	let order = [];

	for (let sec in legacy_services) {
		let domain = normalize_domain(sec.domain || sec.lookup_host);
		if (!domain) continue;

		let provider = SERVICE_MAP[sec.service_name] || (sec.update_url ? 'custom_webhook' : 'dyndns2');
		let key = provider + '|' + domain;
		let is_v6 = (sec.use_ipv6 == '1');

		if (!grouped[key]) {
			grouped[key] = {
				id: sanitize_section_name(sec['.name']),
				enabled: (sec.enabled != '0') ? '1' : '0',
				provider: provider,
				domain: domain,
				ip_mode: is_v6 ? 'ipv6' : 'ipv4',
				username: sec.username || '',
				password: sec.password || '',
				param_opt: sec.param_opt || '',
				interface: (sec.interface && sec.interface != 'wan' && sec.interface != 'wan6') ? sec.interface : 'auto',
				custom_url: sec.update_url || ''
			};
			push(order, key);
		} else {
			let cur = grouped[key];
			if ((cur.ip_mode == 'ipv4' && is_v6) || (cur.ip_mode == 'ipv6' && !is_v6))
				cur.ip_mode = 'dual';
			if (sec.enabled != '0')
				cur.enabled = '1';
		}
	}

	let result_rules = map(order, (k) => grouped[k]);

	if (!dry_run && length(result_rules) > 0) {
		for (let r in result_rules) {
			let sid = r.id;
			u.set('ddnsox', sid, 'rule');
			u.set('ddnsox', sid, 'enabled', r.enabled);
			u.set('ddnsox', sid, 'provider', r.provider);
			u.set('ddnsox', sid, 'domain', r.domain);
			u.set('ddnsox', sid, 'ip_mode', r.ip_mode);
			if (r.username) u.set('ddnsox', sid, 'username', r.username);
			if (r.password) u.set('ddnsox', sid, 'password', r.password);
			if (r.param_opt) u.set('ddnsox', sid, 'param_opt', r.param_opt);
			if (r.interface && r.interface != 'auto') u.set('ddnsox', sid, 'interface', r.interface);
			if (r.custom_url) u.set('ddnsox', sid, 'custom_url', r.custom_url);
		}
		u.commit('ddnsox');
	}

	return {
		ok: true,
		dry_run: dry_run,
		migrated: length(result_rules),
		rules: result_rules
	};
}

export { has_legacy_config, run };
