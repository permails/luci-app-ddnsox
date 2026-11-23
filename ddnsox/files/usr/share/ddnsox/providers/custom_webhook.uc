function update(ctx) {
	let tpl = trim(ctx.custom_url || '');
	if (!tpl)
		return { ok: false, fatal: true, code: 'missing_url', message: 'Custom update URL template is empty' };

	let url = tpl;
	url = replace(url, '[DOMAIN]', ctx.http.url_encode(ctx.domain));
	url = replace(url, '[IP]', ctx.http.url_encode(ctx.ip));
	url = replace(url, '[USERNAME]', ctx.http.url_encode(ctx.username || ''));
	url = replace(url, '[PASSWORD]', ctx.http.url_encode(ctx.password || ''));
	url = replace(url, '[TYPE]', ctx.rrtype);

	let headers = { 'User-Agent': 'ddnsox/1.0' };
	if ((ctx.username || ctx.password) && index(tpl, '[USERNAME]') < 0 && index(tpl, '[PASSWORD]') < 0)
		headers['Authorization'] = 'Basic ' + b64enc(sprintf('%s:%s', trim(ctx.username || ''), trim(ctx.password || '')));

	let res = ctx.http.get(url, headers, 12);
	if (res.ok)
		return { ok: true, fatal: false, code: 'ok', message: 'Custom webhook updated' };

	return {
		ok: false,
		fatal: (res.status == 401 || res.status == 403),
		code: 'webhook_failed',
		message: res.error || 'Custom webhook request failed'
	};
}

export { update };
