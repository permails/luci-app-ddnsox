'use strict';
'require baseclass';
'require view.ddnsox.common as ddnsox';

return baseclass.extend({
	title: _('Dynamic DNS (DDNSox)'),

	load: function() {
		return ddnsox.rpc.getOverview().catch(function() { return null; });
	},

	render: function(data) {
		if (!data)
			return E('em', {}, _('Unable to retrieve DDNSox status'));

		var rules = data.rules || [];
		var rows = [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Domain')),
				E('th', { 'class': 'th' }, _('Provider')),
				E('th', { 'class': 'th' }, _('IPv4 / IPv6')),
				E('th', { 'class': 'th' }, _('Status'))
			])
		];

		if (rules.length === 0) {
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', colspan: 4 }, _('No DDNS rules configured'))
			]));
		} else {
			rules.forEach(function(r) {
				var st = ddnsox.stateMeta(r.state);
				var ips = [];
				if (r.v4 && r.v4.probed_ip) ips.push(r.v4.probed_ip);
				if (r.v6 && r.v6.probed_ip) ips.push(r.v6.probed_ip);
				rows.push(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, r.domain || r.id),
					E('td', { 'class': 'td' }, r.provider_name || r.provider),
					E('td', { 'class': 'td' }, ips.join(' / ') || '-'),
					E('td', { 'class': 'td' }, st.label)
				]));
			});
		}

		return E('table', { 'class': 'table' }, rows);
	}
});
