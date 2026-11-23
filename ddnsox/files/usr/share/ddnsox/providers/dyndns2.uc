function update(ctx) {
	let endpoint = trim(ctx.custom_url || 'https://members.dyndns.org/nic/update');
	let sep = index(endpoint, '?') >= 0 ? '&' : '?';
	let url = sprintf('%s%shostname=%s&myip=%s',
		endpoint, sep, ctx.http.url_encode(ctx.domain), ctx.http.url_encode(ctx.ip));

	let headers = { 'User-Agent': 'ddnsox/1.0' };
	if (ctx.username || ctx.password)
		headers['Authorization'] = 'Basic ' + b64enc(sprintf('%s:%s', trim(ctx.username), trim(ctx.password)));

	let res = ctx.http.get(url, headers, 12);
	if (!res.ok) {
		let fatal = (res.status == 401 || res.status == 403);
		return { ok: false, fatal, code: fatal ? 'auth_failed' : 'http_error', message: res.error };
	}

	let body = lc(trim(res.body));
	if (match(body, /^(good|nochg)\b/))
		return { ok: true, fatal: false, code: 'ok', message: trim(res.body) };
	if (match(body, /^(badauth|notfqdn|nohost|numhost|abuse)\b/))
		return { ok: false, fatal: true, code: body, message: 'Provider rejected update: ' + trim(res.body) };

	return { ok: false, fatal: false, code: 'provider_error', message: trim(res.body) || 'Unknown DynDNS2 response' };
}

export { update };
