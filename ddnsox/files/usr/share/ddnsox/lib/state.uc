const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let start_time = time();
let log_buffer = [];
let max_log_lines = 300;
let min_log_level = 'info';

let rules_state = {};
let wan_snapshot = {
	v4: { interface: null, ip: null, cgnat: false, source: null },
	v6: { interface: null, ip: null, ula: false, source: null }
};

function configure(opts) {
	if (opts?.log_lines && int(opts.log_lines) > 0)
		max_log_lines = int(opts.log_lines);
	if (opts?.log_level && exists(LEVELS, opts.log_level))
		min_log_level = opts.log_level;
}

function log(level, rule_id, msg) {
	let lvl = exists(LEVELS, level) ? level : 'info';
	if (LEVELS[lvl] < LEVELS[min_log_level])
		return;

	let entry = {
		ts: time(),
		level: lvl,
		rule: rule_id || 'daemon',
		msg: '' + msg
	};

	push(log_buffer, entry);
	if (length(log_buffer) > max_log_lines)
		log_buffer = slice(log_buffer, length(log_buffer) - max_log_lines);
	if (lvl == 'error' || lvl == 'warn' || lvl == 'info')
		warn(sprintf('[ddnsox][%s][%s] %s\n', lvl, entry.rule, entry.msg));
}

function get_logs(filter) {
	let rule = filter?.rule;
	let level = filter?.level;
	let query = filter?.query ? lc(trim(filter.query)) : '';
	let limit = filter?.limit ? int(filter.limit) : max_log_lines;
	let min_lvl = (level && exists(LEVELS, level)) ? LEVELS[level] : 0;

	let out = [];
	for (let entry in log_buffer) {
		if (rule && rule != 'all' && entry.rule != rule)
			continue;
		if (LEVELS[entry.level] < min_lvl)
			continue;
		if (query && index(lc(entry.msg), query) == -1 && index(lc(entry.rule), query) == -1)
			continue;
		push(out, entry);
	}

	if (limit > 0 && length(out) > limit)
		out = slice(out, length(out) - limit);

	return {
		total: length(out),
		lines: out
	};
}

function init_rule(rule_cfg) {
	let id = rule_cfg.id;
	let prev = rules_state[id];
	rules_state[id] = {
		id: id,
		enabled: rule_cfg.enabled,
		provider: rule_cfg.provider,
		provider_name: rule_cfg.provider_name || rule_cfg.provider,
		domain: rule_cfg.domain,
		ip_mode: rule_cfg.ip_mode || 'dual',
		state: rule_cfg.enabled ? (prev?.state || 'initializing') : 'disabled',
		v4: prev?.v4 || { probed_ip: null, dns_ip: null, dns_source: null, in_sync: false },
		v6: prev?.v6 || { probed_ip: null, dns_ip: null, dns_source: null, in_sync: false },
		last_update: prev?.last_update || 0,
		last_check: prev?.last_check || 0,
		next_check: prev?.next_check || 0,
		retry_count: prev?.retry_count || 0,
		error_code: rule_cfg.enabled ? (prev?.error_code || null) : null,
		error_message: rule_cfg.enabled ? (prev?.error_message || null) : null
	};
	return rules_state[id];
}

function prune_rules(valid_ids) {
	let keep = {};
	for (let id in valid_ids)
		keep[id] = true;

	for (let id in keys(rules_state)) {
		if (!keep[id])
			delete rules_state[id];
	}
}

function get_rule(id) {
	return rules_state[id];
}

function set_rule_state(id, patch) {
	if (!rules_state[id])
		return null;
	for (let k, v in patch)
		rules_state[id][k] = v;
	return rules_state[id];
}

function set_wan_snapshot(v4, v6) {
	if (v4)
		wan_snapshot.v4 = v4;
	if (v6)
		wan_snapshot.v6 = v6;
}

function compute_backoff(retry_count) {
	let base = 30;
	let exp = retry_count > 6 ? 6 : retry_count;
	let delay = base * (1 << exp);
	return delay > 1800 ? 1800 : delay;
}

function get_status(rule_order) {
	let list = [];
	let summary = { total: 0, synced: 0, updating: 0, error: 0, disabled: 0 };

	let ids = rule_order || keys(rules_state);
	for (let id in ids) {
		let r = rules_state[id];
		if (!r)
			continue;
		push(list, r);
		summary.total++;
		if (!r.enabled || r.state == 'disabled')
			summary.disabled++;
		else if (r.state == 'synced')
			summary.synced++;
		else if (r.state == 'error' || r.state == 'backoff')
			summary.error++;
		else
			summary.updating++;
	}

	return {
		daemon: {
			running: true,
			uptime: time() - start_time,
			version: '26.11.24',
			wan_v4: wan_snapshot.v4,
			wan_v6: wan_snapshot.v6
		},
		summary: summary,
		rules: list
	};
}

export { configure, log, get_logs, init_rule, prune_rules, get_rule, set_rule_state, set_wan_snapshot, compute_backoff, get_status };
