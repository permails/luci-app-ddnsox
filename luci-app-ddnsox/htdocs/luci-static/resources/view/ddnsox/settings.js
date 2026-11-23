'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require view.ddnsox.common as ddnsox';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ddnsox'),
			ddnsox.rpc.getOverview()
		]);
	},

	render: function(res) {
		var overview = res[1] || {};
		var styleEl = ddnsox.injectStyles();

		var m = new form.Map('ddnsox', _('Dynamic DNSox') + ' - ' + _('Settings'),
			_('Configure global event-driven probing, clean DoH verification servers, and log retention.'));

		// Card 1: Service & Scheduling
		var s1 = m.section(form.NamedSection, 'global', 'global', _('Service & Scheduling'),
			_('Control the ucode background daemon and safety-net fallback verification interval.'));
		s1.addremove = false;

		var o = s1.option(form.Flag, 'enabled', _('Enable DDNSox Daemon'));
		o.rmempty = false;

		o = s1.option(form.Value, 'check_interval', _('Fallback Check Interval (s)'),
			_('Safety-net verification interval in addition to real-time netifd ubus events.'));
		o.datatype = 'min(60)';
		o.placeholder = '1800';

		// Card 2: Anti-Poisoning DNS & WAN Probe
		var s2 = m.section(form.NamedSection, 'global', 'global', _('Anti-Poisoning DNS & WAN Probe'),
			_('Bypass local port 53 cache/fake-ip via DoH, and configure fallback public IP probe URLs for CGNAT WANs.'));
		s2.addremove = false;

		o = s2.option(form.Flag, 'use_authoritative_ns', _('Authoritative NS Fallback'),
			_('Query the domain authoritative nameserver directly if DoH upstream servers fail.'));
		o.rmempty = false;

		o = s2.option(form.DynamicList, 'doh_servers', _('DoH Verification Servers'),
			_('Used to verify live DNS records without trusting local port 53 cache or fake-ip.'));

		o = s2.option(form.DynamicList, 'public_ip_urls_v4', _('Public IPv4 Probe URLs'),
			_('Fallback endpoints when the WAN interface is behind CGNAT or private IPv4.'));

		o = s2.option(form.DynamicList, 'public_ip_urls_v6', _('Public IPv6 Probe URLs'));

		// Card 3: Logging & Legacy Migration
		var s3 = m.section(form.NamedSection, 'global', 'global', _('Logging & Maintenance'));
		s3.addremove = false;

		o = s3.option(form.ListValue, 'log_level', _('Log Level'));
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('warn', _('Warning'));
		o.value('error', _('Error'));

		o = s3.option(form.Value, 'log_lines', _('Log Ring Buffer Size'));
		o.datatype = 'range(50, 2000)';
		o.placeholder = '300';

		if (overview.has_legacy_config) {
			var btn = s3.option(form.Button, '_migrate', _('Import /etc/config/ddns'));
			btn.inputtitle = _('Migrate Legacy Rules');
			btn.inputstyle = 'action';
			btn.onclick = function() {
				return ddnsox.rpc.migrateLegacy(false).then(function(r) {
					ui.addNotification(null, E('p', {},
						_('Migrated %d rule(s) from legacy /etc/config/ddns.').format(r.migrated || 0)), 'info');
				});
			};
		}

		return m.render().then(function(mapEl) {
			var wrap = E('div', { id: 'cbi-ddnsox', 'class': 'ddnsox-settings-wrap' }, [mapEl]);
			return E('div', {}, [styleEl, wrap].filter(Boolean));
		});
	}
});
