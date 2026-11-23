import * as fs from 'fs';

function shell_quote(arg) {
	return "'" + replace('' + arg, "'", "'\\''") + "'";
}

function find_http_client() {
	if (fs.access('/usr/bin/curl', 'x'))
		return 'curl';
	if (fs.access('/bin/uclient-fetch', 'x'))
		return 'uclient';
	return null;
}

function url_encode(str) {
	let s = '' + (str ?? '');
	let out = '';
	for (let i = 0; i < length(s); i++) {
		let c = substr(s, i, 1);
		if (match(c, /[A-Za-z0-9_.~-]/)) {
			out += c;
		} else {
			let code = ord(c);
			out += sprintf('%%%02X', code);
		}
	}
	return out;
}

/**
 * Execute an HTTP/HTTPS request with strict timeout and TLS CA verification.
 * Uses curl (if installed) or OpenWrt native uclient-fetch.
 */
function request(opts) {
	let method = uc(opts?.method || 'GET');
	let url = opts?.url;
	let headers = opts?.headers || {};
	let body = opts?.body;
	let timeout = opts?.timeout || 12;

	if (!url)
		return { ok: false, status: 0, body: '', error: 'Missing request URL' };

	let client = find_http_client();
	if (!client)
		return { ok: false, status: 0, body: '', error: 'No HTTPS client (uclient-fetch/curl) found' };

	let tmp_body = null;
	if (body != null) {
		tmp_body = sprintf('/tmp/ddnsox-req-%d-%d.tmp', time(), clock()[1]);
		fs.writefile(tmp_body, '' + body);
	}

	let cmd_parts = [];
	let bind_dev = opts?.bind_device ? trim(opts.bind_device) : '';
	let proxy_url = opts?.proxy ? trim(opts.proxy) : '';
	if (client == 'curl') {
		push(cmd_parts, '/usr/bin/curl', '-sS', '-L', '--max-time', '' + timeout, '-X', method);
		if (bind_dev)
			push(cmd_parts, '--interface', bind_dev);
		if (proxy_url)
			push(cmd_parts, '-x', proxy_url);
		push(cmd_parts, '-w', '\n__DDNSOX_STATUS__:%{http_code}');
		for (let k, v in headers)
			push(cmd_parts, '-H', sprintf('%s: %s', k, v));
		if (tmp_body)
			push(cmd_parts, '--data-binary', '@' + tmp_body);
		push(cmd_parts, url);
	} else {
		push(cmd_parts, '/bin/uclient-fetch', '-q', '-O', '-', '-T', '' + timeout);
		for (let k, v in headers) {
			if (lc(k) == 'user-agent')
				push(cmd_parts, '-U', '' + v);
			else
				push(cmd_parts, '--header=' + sprintf('%s: %s', k, v));
		}
		if (tmp_body)
			push(cmd_parts, '--post-file=' + tmp_body);
		push(cmd_parts, url);
	}

	let cmdline = join(' ', map(cmd_parts, shell_quote)) + ' 2>&1';
	let proc = fs.popen(cmdline, 'r');
	if (!proc) {
		if (tmp_body) fs.unlink(tmp_body);
		return { ok: false, status: 0, body: '', error: 'Failed to execute HTTP client' };
	}

	let raw = proc.read('all') || '';
	let rc = proc.close();
	if (tmp_body) fs.unlink(tmp_body);

	if (client == 'curl') {
		let marker = '\n__DDNSOX_STATUS__:';
		let pos = rindex(raw, marker);
		if (pos >= 0) {
			let body_part = substr(raw, 0, pos);
			let code_str = trim(substr(raw, pos + length(marker)));
			let code = int(code_str);
			return {
				ok: code >= 200 && code < 300,
				status: code,
				body: body_part,
				error: (code >= 200 && code < 300) ? null : sprintf('HTTP %d', code)
			};
		}
		return {
			ok: false,
			status: 0,
			body: raw,
			error: trim(raw) || sprintf('curl exited with %d', rc)
		};
	}

	let ok = (rc == 0);
	return {
		ok: ok,
		status: ok ? 200 : 0,
		body: raw,
		error: ok ? null : (trim(raw) || sprintf('uclient-fetch exited with %d', rc))
	};
}

function get(url, headers, timeout, bind_device, proxy) {
	return request({ method: 'GET', url, headers, timeout, bind_device, proxy });
}

function json_request(opts) {
	let headers = opts?.headers || {};
	if (!exists(headers, 'Content-Type') && !exists(headers, 'content-type'))
		headers['Content-Type'] = 'application/json';
	if (!exists(headers, 'Accept') && !exists(headers, 'accept'))
		headers['Accept'] = 'application/json';

	let payload = opts?.json != null ? sprintf('%J', opts.json) : opts?.body;
	let res = request({
		method: opts?.method || 'GET',
		url: opts?.url,
		headers: headers,
		body: payload,
		timeout: opts?.timeout,
		bind_device: opts?.bind_device,
		proxy: opts?.proxy
	});

	let parsed = null;
	if (res.body && length(trim(res.body)) > 0) {
		try {
			parsed = json(res.body);
		} catch (e) {
			parsed = null;
		}
	}
	res.data = parsed;
	return res;
}

export { url_encode, request, get, json_request };
