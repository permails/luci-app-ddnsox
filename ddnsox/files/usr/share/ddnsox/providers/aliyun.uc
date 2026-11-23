let digest = null;
try {
	digest = require('digest');
} catch (e) {
	digest = null;
}

function hmac_sha1_raw(key, msg) {
	let block_size = 64;
	let k = key;
	if (length(k) > block_size)
		k = digest.sha1_raw ? digest.sha1_raw(k) : hexdec(digest.sha1(k));
	while (length(k) < block_size)
		k += '\x00';

	let o_pad = '';
	let i_pad = '';
	for (let i = 0; i < block_size; i++) {
		let b = ord(k, i);
		o_pad += chr(b ^ 0x5c);
		i_pad += chr(b ^ 0x36);
	}
	let inner = hexdec(digest.sha1(i_pad + msg));
	return hexdec(digest.sha1(o_pad + inner));
}

function aliyun_encode(http, str) {
	let s = http.url_encode(str);
	s = replace(s, '+', '%20');
	s = replace(s, '*', '%2A');
	s = replace(s, '%7E', '~');
	return s;
}

function iso8601_utc() {
	let t = gmtime(time());
	return sprintf('%04d-%02d-%02dT%02d:%02d:%02dZ',
		t.year, t.mon, t.mday, t.hour, t.min, t.sec);
}

function sign_request(http, secret, params) {
	let sorted_keys = sort(keys(params));
	let pairs = [];
	for (let k in sorted_keys)
		push(pairs, aliyun_encode(http, k) + '=' + aliyun_encode(http, params[k]));
	let canonical = join('&', pairs);
	let to_sign = 'GET&%2F&' + aliyun_encode(http, canonical);
	let sig = b64enc(hmac_sha1_raw(secret + '&', to_sign));
	return 'https://alidns.aliyuncs.com/?' + canonical + '&Signature=' + aliyun_encode(http, sig);
}

function aliyun_call(http, ak, sk, extra) {
	let params = {
		Format: 'JSON',
		Version: '2015-01-09',
		AccessKeyId: ak,
		SignatureMethod: 'HMAC-SHA1',
		Timestamp: iso8601_utc(),
		SignatureVersion: '1.0',
		SignatureNonce: sprintf('%d%09d', time(), clock()[1])
	};
	for (let k, v in extra)
		params[k] = '' + v;

	let url = sign_request(http, sk, params);
	return http.json_request({ method: 'GET', url: url, headers: { 'User-Agent': 'ddnsox/1.0' } });
}

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

function update(ctx) {
	if (!digest)
		return { ok: false, fatal: true, code: 'missing_digest', message: 'Aliyun DNS requires ucode-mod-digest package' };
	let parsed = split_rr_domain(ctx.domain);
	if (!parsed)
		return { ok: false, fatal: true, code: 'invalid_domain', message: 'Invalid domain format' };

	let ak = trim(ctx.username);
	let sk = trim(ctx.password);
	let q = aliyun_call(ctx.http, ak, sk, {
		Action: 'DescribeSubDomainRecords',
		SubDomain: ctx.domain,
		Type: ctx.rrtype
	});

	if (!q.ok && (q.data?.Code == 'InvalidAccessKeyId.NotFound' || q.data?.Code == 'SignatureDoesNotMatch'))
		return { ok: false, fatal: true, code: 'auth_failed', message: q.data?.Message || 'Aliyun authentication failed' };

	let records = q.data?.DomainRecords?.Record || [];
	let ttl = int(ctx.ttl || 600);
	if (ttl < 600) ttl = 600;

	let res;
	if (length(records) > 0) {
		res = aliyun_call(ctx.http, ak, sk, {
			Action: 'UpdateDomainRecord',
			RecordId: records[0].RecordId,
			RR: records[0].RR || parsed.rr,
			Type: ctx.rrtype,
			Value: ctx.ip,
			TTL: ttl
		});
	} else {
		res = aliyun_call(ctx.http, ak, sk, {
			Action: 'AddDomainRecord',
			DomainName: parsed.domain,
			RR: parsed.rr,
			Type: ctx.rrtype,
			Value: ctx.ip,
			TTL: ttl
		});
	}

	if (res.ok && res.data?.RecordId)
		return { ok: true, fatal: false, code: 'ok', message: 'Aliyun DNS record updated' };

	return {
		ok: false,
		fatal: false,
		code: res.data?.Code || 'update_failed',
		message: res.data?.Message || res.error || 'Aliyun DNS update failed'
	};
}

export { update };
