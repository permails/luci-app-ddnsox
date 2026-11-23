function split_rr_domain(fqdn) {
	let parts = split(lc(trim(fqdn)), '.');
	if (length(parts) < 2)
		return null;
	if (length(parts) == 2)
		return { rr: '', domain: join('.', parts) };
	return {
		rr: join('.', slice(parts, 0, length(parts) - 2)),
		domain: join('.', slice(parts, length(parts) - 2))
	};
}

function update(ctx) {
	let parsed = split_rr_domain(ctx.domain);
	if (!parsed)
		return { ok: false, fatal: true, code: 'invalid_domain', message: 'Invalid domain format' };

	let auth = {
		apikey: trim(ctx.username),
		secretapikey: trim(ctx.password)
	};

	let url_base = 'https://api.porkbun.com/api/json/v3/dns';
	let get_url = parsed.rr
		? sprintf('%s/retrieveByNameType/%s/%s/%s', url_base, parsed.domain, ctx.rrtype, parsed.rr)
		: sprintf('%s/retrieveByNameType/%s/%s', url_base, parsed.domain, ctx.rrtype);

	let q = ctx.http.json_request({ method: 'POST', url: get_url, json: auth });
	if (q.status == 401 || q.status == 403 || q.data?.status == 'ERROR' && index(lc(q.data?.message || ''), 'invalid api') >= 0)
		return { ok: false, fatal: true, code: 'auth_failed', message: q.data?.message || 'Porkbun authentication failed' };

	let ttl = int(ctx.ttl || 600);
	if (ttl < 600) ttl = 600;

	let body = {
		apikey: auth.apikey,
		secretapikey: auth.secretapikey,
		name: parsed.rr,
		type: ctx.rrtype,
		content: ctx.ip,
		ttl: '' + ttl
	};

	let existing = q.data?.records?.[0];
	let upd_url = existing?.id
		? sprintf('%s/edit/%s/%s', url_base, parsed.domain, existing.id)
		: sprintf('%s/create/%s', url_base, parsed.domain);

	let upd = ctx.http.json_request({ method: 'POST', url: upd_url, json: body });
	if (upd.ok && upd.data?.status == 'SUCCESS')
		return { ok: true, fatal: false, code: 'ok', message: 'Porkbun record updated' };

	return {
		ok: false,
		fatal: false,
		code: 'update_failed',
		message: upd.data?.message || upd.error || 'Porkbun update failed'
	};
}

export { update };
