function split_rr_domain(fqdn) {
	let parts = split(lc(trim(fqdn)), '.');
	if (length(parts) < 2)
		return null;
	if (length(parts) == 2)
		return { rr: '@', domain: join('.', parts) };
	return {
		rr: join('.', slice(parts, 0, length(parts) - 2)),
		domain: join('.', slice(parts, length(parts) - 2))
	};
}

function form_encode(http, obj) {
	let pairs = [];
	for (let k, v in obj)
		push(pairs, http.url_encode(k) + '=' + http.url_encode(v));
	return join('&', pairs);
}

function update(ctx) {
	let parsed = split_rr_domain(ctx.domain);
	if (!parsed)
		return { ok: false, fatal: true, code: 'invalid_domain', message: 'Invalid domain format' };

	let token = sprintf('%s,%s', trim(ctx.username), trim(ctx.password));
	let headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'User-Agent': 'ddnsox/1.0 (openwrt@ddnsox)'
	};

	let list_res = ctx.http.json_request({
		method: 'POST',
		url: 'https://dnsapi.cn/Record.List',
		headers: headers,
		body: form_encode(ctx.http, {
			login_token: token,
			format: 'json',
			domain: parsed.domain,
			sub_domain: parsed.rr,
			record_type: ctx.rrtype
		})
	});

	let code = list_res.data?.status?.code;
	if (code == '-1' || code == '10002')
		return { ok: false, fatal: true, code: 'auth_failed', message: list_res.data?.status?.message || 'DNSPod authentication failed' };

	let existing = list_res.data?.records?.[0];
	let ttl = int(ctx.ttl || 600);
	if (ttl < 600) ttl = 600;

	let endpoint = existing?.id ? 'https://dnsapi.cn/Record.Modify' : 'https://dnsapi.cn/Record.Create';
	let params = {
		login_token: token,
		format: 'json',
		domain: parsed.domain,
		sub_domain: parsed.rr,
		record_type: ctx.rrtype,
		record_line: existing?.line || '默认',
		value: ctx.ip,
		ttl: ttl
	};
	if (existing?.id)
		params.record_id = existing.id;

	let upd = ctx.http.json_request({
		method: 'POST',
		url: endpoint,
		headers: headers,
		body: form_encode(ctx.http, params)
	});

	if (upd.data?.status?.code == '1')
		return { ok: true, fatal: false, code: 'ok', message: 'DNSPod record updated' };

	return {
		ok: false,
		fatal: false,
		code: upd.data?.status?.code || 'update_failed',
		message: upd.data?.status?.message || upd.error || 'DNSPod update failed'
	};
}

export { update };
