'use strict';

import * as fs from 'fs';
import * as ubus from 'ubus';
import * as migrate from '/usr/share/ddnsox/lib/migrate.uc';

const REGISTRY_PATH = '/usr/share/ddnsox/providers/registry.json';
const ALLOWED_ACTIONS = { start: true, stop: true, restart: true, reload: true };

function call_daemon(method, args) {
	let conn = ubus.connect();
	if (!conn)
		return { _ubus_error: 'ubus connection failed' };
	let res = conn.call('ddnsox', method, args || {});
	let err = !res ? (conn.error() || 'ubus call failed') : null;
	conn.disconnect();
	return res || { _ubus_error: err };
}

const methods = {
	get_overview: {
		call: function() {
			let st = call_daemon('status', {});
			let running = !!(st && !st._ubus_error && st.daemon?.running);
			return {
				daemon: running ? st.daemon : { running: false, uptime: 0, version: '1.0.0', wan_v4: {}, wan_v6: {} },
				daemon: running ? st.daemon : { running: false, uptime: 0, version: '26.11.24', wan_v4: {}, wan_v6: {} },
				summary: running ? st.summary : { total: 0, synced: 0, updating: 0, error: 0, disabled: 0 },
				rules: running ? (st.rules || []) : [],
				has_legacy_config: migrate.has_legacy_config()
			};
		}
	},

	get_providers: {
		call: function() {
			let raw = fs.readfile(REGISTRY_PATH);
			if (!raw)
				return { providers: [] };
			try {
				return json(raw);
			} catch (e) {
				return { providers: [] };
			}
		}
	},

	trigger_sync: {
		args: { id: '', force: false },
		call: function(req) {
			let res = call_daemon('sync', {
				id: req.args?.id || '',
				force: !!req.args?.force
			});
			if (!res || res._ubus_error)
				return { accepted: false, error: 'ddnsox daemon is not running' };
			return res;
		}
	},

	test_probe: {
		args: { id: '', ip_mode: 'dual', interface: 'auto' },
		call: function(req) {
			let res = call_daemon('probe', {
				id: req.args?.id || '',
				ip_mode: req.args?.ip_mode || 'dual',
				interface: req.args?.interface || 'auto'
			});
			if (!res || res._ubus_error)
				return { ok: false, error: 'ddnsox daemon is not running' };
			return res;
		}
	},

	get_logs: {
		args: { rule: 'all', level: 'debug', query: '', limit: 250 },
		call: function(req) {
			let res = call_daemon('get_log', {
				rule: req.args?.rule || 'all',
				level: req.args?.level || 'debug',
				query: req.args?.query || '',
				limit: int(req.args?.limit || 250)
			});
			if (!res || res._ubus_error)
				return { total: 0, lines: [] };
			return res;
		}
	},

	service_action: {
		args: { action: '' },
		call: function(req) {
			let act = req.args?.action;
			if (!ALLOWED_ACTIONS[act])
				return { ok: false, error: 'Invalid service action' };
			let conn = ubus.connect();
			if (!conn)
				return { ok: false, error: 'ubus connection failed' };
			conn.call('rc', 'init', { name: 'ddnsox', action: act });
			conn.disconnect();
			return { ok: true, action: act };
		}
	},

	migrate_legacy: {
		args: { dry_run: false },
		call: function(req) {
			let res = migrate.run({ dry_run: !!req.args?.dry_run });
			if (res.ok && !req.args?.dry_run && res.migrated > 0)
				call_daemon('reload', {});
			return res;
		}
	}
};

return { 'luci.ddnsox': methods };
