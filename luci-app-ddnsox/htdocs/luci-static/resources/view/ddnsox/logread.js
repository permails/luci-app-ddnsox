'use strict';
'require view';
'require poll';
'require view.ddnsox.common as ddnsox';

return view.extend({
	load: function() {
		return Promise.all([
			ddnsox.rpc.getLogs('all', 'debug', '', 300),
			ddnsox.rpc.getOverview()
		]);
	},

	formatLines: function(lines) {
		return (lines || []).map(function(l) {
			var d = new Date(l.ts * 1000);
			var ts = d.toISOString().replace('T', ' ').slice(0, 19);
			return '[%s] [%s] [%s] %s'.format(ts, l.level.toUpperCase(), l.rule, l.msg);
		}).join('\n');
	},

	render: function(res) {
		var self = this;
		var initLog = res[0] || { lines: [] };
		var overview = res[1] || { rules: [] };
		var styleEl = ddnsox.injectStyles();

		var countPill = E('span', { 'class': 'ddnsox-count-pill' }, String((initLog.lines || []).length));

		var levelSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: 'debug' }, _('All Levels')),
			E('option', { value: 'info' }, 'Info+'),
			E('option', { value: 'warn' }, 'Warn+'),
			E('option', { value: 'error' }, 'Error')
		]);

		var ruleSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: 'all' }, _('All Rules')),
			E('option', { value: 'daemon' }, 'daemon')
		].concat((overview.rules || []).map(function(r) {
			return E('option', { value: r.id }, r.domain || r.id);
		})));

		var searchInput = E('input', {
			type: 'text',
			'class': 'cbi-input-text',
			placeholder: _('Filter keyword...')
		});

		var textarea = E('textarea', { readonly: 'readonly', wrap: 'off' },
			this.formatLines(initLog.lines));

		function fetchLogs() {
			var atBottom = (textarea.scrollHeight - textarea.scrollTop - textarea.clientHeight) < 24;
			return ddnsox.rpc.getLogs(ruleSelect.value, levelSelect.value, searchInput.value.trim(), 300).then(function(data) {
				var lines = data.lines || [];
				countPill.textContent = String(lines.length);
				textarea.value = self.formatLines(lines);
				if (atBottom)
					textarea.scrollTop = textarea.scrollHeight;
			});
		}

		var refreshBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-action' }, _('Refresh'));
		refreshBtn.addEventListener('click', fetchLogs);

		var topBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-neutral' }, '↑ ' + _('Top'));
		topBtn.addEventListener('click', function() { textarea.scrollTop = 0; });

		var bottomBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-neutral' }, '↓ ' + _('Bottom'));
		bottomBtn.addEventListener('click', function() { textarea.scrollTop = textarea.scrollHeight; });

		levelSelect.addEventListener('change', fetchLogs);
		ruleSelect.addEventListener('change', fetchLogs);
		searchInput.addEventListener('input', fetchLogs);

		poll.add(fetchLogs, 5);

		return E('div', { id: 'cbi-ddnsox' }, [
			styleEl,
			E('h2', {}, _('Dynamic DNSox') + ' - ' + _('Logs')),
			E('div', { 'class': 'ddnsox-outer-box' }, [
				E('div', { 'class': 'ddnsox-panel-head' }, [
					E('span', {}, _('Daemon Log Buffer')),
					countPill
				]),
				E('div', { 'class': 'ddnsox-log-card' }, [
					E('div', { 'class': 'ddnsox-log-toolbar' }, [
						E('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [
							ruleSelect, levelSelect, searchInput
						]),
						E('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, [
							refreshBtn, topBtn, bottomBtn
						])
					]),
					E('div', { 'class': 'ddnsox-log-body' }, textarea)
				])
			])
		].filter(Boolean));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
