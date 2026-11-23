function split_host_domain(fqdn) {
	let parts = split(lc(trim(fqdn)), '.');
	if (length(parts) < 2)
		return { host: '@', domain: fqdn };
	if (length(parts) == 2)
		return { host: '@', domain: join('.', parts) };
	return {
		host: join('.', slice(parts, 0, length(parts) - 2)),
		domain: join('.', slice(parts, length(parts) - 2))
	};
}

function update(ctx) {
	let tpl = trim(ctx.custom_url || ((ctx.rrtype == 'AAAA') ? ctx.url_v6 : ctx.url_v4) || ctx.url_v4 || '');
	if (!tpl)
		return { ok: false, fatal: true, code: 'missing_url', message: 'No update URL template configured for this provider/IP family' };

	let hd = split_host_domain(ctx.domain);
	let url = tpl;
	url = replace(url, '[DOMAIN]', ctx.http.url_encode(ctx.domain));
	url = replace(url, '[ZONE]', ctx.http.url_encode(hd.domain));
	url = replace(url, '[HOST]', ctx.http.url_encode(hd.host));
	url = replace(url, '[IP]', ctx.http.url_encode(ctx.ip));
	url = replace(url, '[USERNAME]', ctx.http.url_encode(ctx.username || ''));
	url = replace(url, '[PASSWORD]', ctx.http.url_encode(ctx.password || ''));
	url = replace(url, '[PARAMOPT]', ctx.http.url_encode(ctx.param_opt || ''));
	url = replace(url, '[PARAMENC]', ctx.http.url_encode(ctx.param_opt || ''));
	url = replace(url, '[TYPE]', ctx.rrtype);

	let headers = { 'User-Agent': 'ddnsox/1.0' };
	// Extract inline https://user:pass@host/... into Basic Auth header cleanly
	let m = match(url, /^(https?:\/\/)([^:@\/]+):([^@\/]+)@(.*)$/);
	if (m) {
		url = m[1] + m[4];
		headers['Authorization'] = 'Basic ' + b64enc(m[2] + ':' + m[3]);
	} else if ((ctx.username || ctx.password) && index(tpl, '[USERNAME]') < 0 && index(tpl, '[PASSWORD]') < 0) {
		headers['Authorization'] = 'Basic ' + b64enc(sprintf('%s:%s', trim(ctx.username || ''), trim(ctx.password || '')));
	}

	let res = ctx.http.get(url, headers, 12);
	if (!res.ok) {
		let fatal = (res.status == 401 || res.status == 403);
		return { ok: false, fatal: fatal, code: fatal ? 'auth_failed' : 'http_error', message: res.error || 'HTTP request failed' };
	}

	let body = trim(res.body || '');
	let expected = ctx.answer;
	if (expected && length(expected) > 0) {
		let pat = regexp(expected, 'i');
		if (match(body, pat))
			return { ok: true, fatal: false, code: 'ok', message: body || 'Updated' };
		return { ok: false, fatal: false, code: 'unexpected_response', message: body || 'Provider did not return expected answer' };
	}

	return { ok: true, fatal: false, code: 'ok', message: body || 'Updated' };
}

export { update };
