function split_domain(fqdn) {
	let labels = split(lc(trim(fqdn)), '.');
	if (length(labels) < 2)
		return null;
	// Try progressively shorter zones to find the hosted Cloudflare zone
	let zones = [];
	for (let i = 0; i <= length(labels) - 2; i++)
		push(zones, join('.', slice(labels, i)));
	return zones;
}

function build_headers(ctx) {
	let headers = { 'User-Agent': 'ddnsox/1.0' };
	if (ctx.username && length(trim(ctx.username)) > 0) {
		headers['X-Auth-Email'] = trim(ctx.username);
		headers['X-Auth-Key'] = trim(ctx.password);
	} else {
		headers['Authorization'] = 'Bearer ' + trim(ctx.password);
	}
	return headers;
}

function update(ctx) {
	let http = ctx.http;
	let headers = build_headers(ctx);
	let zones = split_domain(ctx.domain);
	if (!zones)
		return { ok: false, fatal: true, code: 'invalid_domain', message: 'Invalid domain format' };

	let zone_id = null;
	for (let z in zones) {
		let res = http.json_request({
			method: 'GET',
			url: sprintf('https://api.cloudflare.com/client/v4/zones?name=%s&status=active', http.url_encode(z)),
			headers: headers
		});
		if (res.status == 401 || res.status == 403)
			return { ok: false, fatal: true, code: 'auth_failed', message: 'Cloudflare authentication failed (invalid token/key)' };
		if (res.ok && res.data?.success && length(res.data?.result || []) > 0) {
			zone_id = res.data.result[0].id;
			break;
		}
	}

	if (!zone_id)
		return { ok: false, fatal: true, code: 'zone_not_found', message: 'Cloudflare zone not found for ' + ctx.domain };

	let rec_res = http.json_request({
		method: 'GET',
		url: sprintf('https://api.cloudflare.com/client/v4/zones/%s/dns_records?type=%s&name=%s',
			zone_id, ctx.rrtype, http.url_encode(ctx.domain)),
		headers: headers
	});

	if (!rec_res.ok || !rec_res.data?.success)
		return { ok: false, fatal: false, code: 'api_error', message: rec_res.error || 'Failed to query Cloudflare DNS records' };

	let payload = {
		type: ctx.rrtype,
		name: ctx.domain,
		content: ctx.ip,
		ttl: int(ctx.ttl || 600) > 0 ? int(ctx.ttl || 600) : 1,
		proxied: !!ctx.proxied
	};

	let existing = rec_res.data.result?.[0];
	let upd_res;
	if (existing?.id) {
		upd_res = http.json_request({
			method: 'PUT',
			url: sprintf('https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s', zone_id, existing.id),
			headers: headers,
			json: payload
		});
	} else {
		upd_res = http.json_request({
			method: 'POST',
			url: sprintf('https://api.cloudflare.com/client/v4/zones/%s/dns_records', zone_id),
			headers: headers,
			json: payload
		});
	}

	if (upd_res.ok && upd_res.data?.success)
		return { ok: true, fatal: false, code: 'ok', message: 'Cloudflare record updated' };

	let err_msg = upd_res.data?.errors?.[0]?.message || upd_res.error || 'Cloudflare update failed';
	return { ok: false, fatal: upd_res.status == 400 || upd_res.status == 403, code: 'update_failed', message: err_msg };
}

export { update };
