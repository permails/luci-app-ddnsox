'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require poll';
'require view.ddnsox.common as ddnsox';

return view.extend({
	load: function() {
		return Promise.all([
			ddnsox.rpc.getOverview(),
			ddnsox.rpc.getProviders(),
			ddnsox.rpc.getInterfaces().catch(function() { return { interface: [] }; }),
			uci.load('ddnsox')
		]);
	},

	renderGlobalSection: function(data) {
		var self = this;
		var d = data.daemon || {};
		var s = data.summary || {};
		var rules = data.rules || [];
		var running = !!d.running;
		var v4 = d.wan_v4 || {};
		var v6 = d.wan_v6 || {};

		var errCount = s.error || 0;
		var healthCls = errCount > 0 ? 'is-err' : (s.total > 0 ? 'is-ok' : 'is-info');
		var healthPill = errCount > 0 ? 'ddnsox-pill-err' : (s.total > 0 ? 'ddnsox-pill-ok' : 'ddnsox-pill-info');

		var toggleBtn = E('button', {
			type: 'button',
			'class': 'cbi-button ' + (running ? 'cbi-button-negative' : 'cbi-button-positive')
		}, running ? _('Stop DDNS') : _('Start DDNS'));
		toggleBtn.addEventListener('click', function() {
			toggleBtn.disabled = true;
			ddnsox.rpc.serviceAction(running ? 'stop' : 'start').then(function() {
				setTimeout(function() { self.refreshOverview(); }, 800);
			}).finally(function() { toggleBtn.disabled = false; });
		});

		var restartBtn = E('button', {
			type: 'button',
			'class': 'cbi-button cbi-button-neutral'
		}, _('Restart DDNS'));
		restartBtn.addEventListener('click', function() {
			restartBtn.disabled = true;
			ddnsox.rpc.serviceAction('restart').then(function() {
				setTimeout(function() { self.refreshOverview(); }, 800);
			}).finally(function() { restartBtn.disabled = false; });
		});

		var syncAllBtn = E('button', {
			type: 'button',
			'class': 'cbi-button cbi-button-action',
			disabled: !running || rules.length === 0 ? true : null
		}, _('Sync All'));
		syncAllBtn.addEventListener('click', function() {
			syncAllBtn.disabled = true;
			syncAllBtn.textContent = _('Syncing...');
			ddnsox.rpc.triggerSync('', true).then(function(res) {
				if (res && res.accepted)
					ui.addNotification(null, E('p', {}, _('Triggered immediate sync for all rules.')), 'info');
				setTimeout(function() { self.refreshOverview(); }, 700);
			}).finally(function() {
				syncAllBtn.disabled = false;
				syncAllBtn.textContent = _('Sync All');
			});
		});

		var v4Text = v4.ip ? (v4.ip + (v4.interface ? ' (' + v4.interface + ')' : '')) : _('Unavailable');
		var v6Text = v6.ip ? (v6.ip + (v6.interface ? ' (' + v6.interface + ')' : '')) : _('None');
		var hasAnyIp = !!(v4.ip || v6.ip);

		var cards = E('div', { 'class': 'ddnsox-summary-grid' }, [
			E('div', { 'class': 'ddnsox-card ' + (hasAnyIp ? 'is-ok' : 'is-warn') }, [
				E('div', { 'class': 'ddnsox-card-head' }, [
					E('span', { 'class': 'ddnsox-card-title' }, _('Public WAN IPs')),
					E('span', { 'class': 'ddnsox-dot ' + (hasAnyIp ? 'ddnsox-pill-ok' : 'ddnsox-pill-warn') },
						v4.cgnat ? 'CGNAT' : (hasAnyIp ? _('Online') : _('No Public IP')))
				]),
				E('div', { 'class': 'ddnsox-card-body' }, [
					E('div', { 'class': 'ddnsox-ip-line', title: v4Text }, 'v4: ' + v4Text),
					E('div', { 'class': 'ddnsox-ip-line', title: v6Text }, 'v6: ' + v6Text)
				])
			]),

			E('div', { 'class': 'ddnsox-card ' + healthCls }, [
				E('div', { 'class': 'ddnsox-card-head' }, [
					E('span', { 'class': 'ddnsox-card-title' }, _('Domain Sync')),
					E('span', { 'class': 'ddnsox-dot ' + healthPill },
						errCount > 0 ? _('%d Errors').format(errCount) : _('Healthy'))
				]),
				E('div', { 'class': 'ddnsox-card-body' }, [
					E('div', { 'class': 'ddnsox-card-main' }, '%d / %d'.format(s.synced || 0, s.total || 0)),
					E('div', { 'class': 'ddnsox-card-sub' },
						_('%d active, %d stopped').format((s.total || 0) - (s.disabled || 0), s.disabled || 0))
				])
			]),

			E('div', { 'class': 'ddnsox-card ' + (running ? 'is-info' : 'is-err') }, [
				E('div', { 'class': 'ddnsox-card-head' }, [
					E('span', { 'class': 'ddnsox-card-title' }, _('DDNSox Daemon')),
					E('span', { 'class': 'ddnsox-dot ' + (running ? 'ddnsox-pill-info' : 'ddnsox-pill-err') },
						running ? 'v' + (d.version || '26.11.24') : _('Stopped'))
				]),
				E('div', { 'class': 'ddnsox-card-body' }, [
					E('div', { 'class': 'ddnsox-card-main' }, running ? ddnsox.formatUptime(d.uptime) : _('Offline')),
					E('div', { 'class': 'ddnsox-card-sub' }, _('ucode event-driven + DoH'))
				])
			])
		]);

		var notes = [];
		if (data.has_legacy_config) {
			var migBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-action' }, _('Import /etc/config/ddns'));
			migBtn.addEventListener('click', function() {
				migBtn.disabled = true;
				ddnsox.rpc.migrateLegacy(false).then(function(res) {
					ui.addNotification(null, E('p', {}, _('Imported %d rule(s) from legacy /etc/config/ddns.').format(res.migrated || 0)), 'info');
					return uci.load('ddnsox');
				}).then(function() { self.refreshOverview(); });
			});
			notes.push(E('div', { 'class': 'ddnsox-note' }, [
				E('span', {}, _('Legacy /etc/config/ddns detected. Click to migrate existing rules.')),
				migBtn
			]));
		}

		var errRules = rules.filter(function(r) { return r.state === 'error' && r.error_message; });
		if (errRules.length > 0) {
			notes.push(E('div', { 'class': 'ddnsox-note is-err' }, [
				E('span', {}, '%s: %s'.format(errRules[0].domain, errRules[0].error_message))
			]));
		}

		return E('div', {}, [
			E('div', { 'class': 'ddnsox-header-bar' }, [
				E('div', { 'class': 'ddnsox-panel-head', style: 'margin-bottom:0 !important' }, [
					E('span', {}, _('Information'))
				]),
				E('div', { 'class': 'ddnsox-toolbar' }, [toggleBtn, restartBtn, syncAllBtn])
			]),
			cards
		].concat(notes));
	},

	openRuleModal: function(ruleId, providers, interfaces) {
		var self = this;
		var isNew = !ruleId;
		var sec = isNew ? {} : (uci.get('ddnsox', ruleId) || {});
		var credRefs = [];
		var ifaceList = (interfaces || []).filter(function(i) {
			var name = i.interface || '';
			var dev = i.l3_device || i.device || '';
			if (!name || name === 'loopback' || name === 'lan' || /^lan[0-9_]*$/i.test(name))
				return false;
			if (dev === 'br-lan' || /^(docker|veth|br-lan)/.test(dev))
				return false;
			return true;
		});

		var domainInput = E('input', {
			type: 'text',
			'class': 'cbi-input-text',
			value: sec.domain || '',
			placeholder: 'nas.example.com'
		});

		var ipModeSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: 'dual', selected: (sec.ip_mode || 'dual') === 'dual' ? '' : null }, _('Dual Stack (IPv4 + IPv6)')),
			E('option', { value: 'ipv4', selected: sec.ip_mode === 'ipv4' ? '' : null }, _('IPv4 (A)')),
			E('option', { value: 'ipv6', selected: sec.ip_mode === 'ipv6' ? '' : null }, _('IPv6 (AAAA)'))
		]);

		var credsContainer = E('div', { 'class': 'ddnsox-creds-wrap' });
		var credValues = {
			username: sec.username || '',
			password: sec.password || '',
			custom_url: sec.custom_url || ''
		};

		function renderCredsForProvider(p) {
			credRefs = [];
			credsContainer.innerHTML = '';
			(p.fields || []).forEach(function(f) {
				var cf = ddnsox.createCredField(f, credValues[f.key] || '', function(val) {
					credValues[f.key] = val;
				});
				credRefs.push({ key: f.key, ref: cf });
				credsContainer.appendChild(cf.el);
			});
		}

		var selectedProviderId = sec.provider || (providers[0] ? providers[0].id : 'cloudflare_v4');
		var selectedProvider = providers.find(function(p) { return p.id === selectedProviderId; }) || providers[0];
		var combo = ddnsox.createCombobox(providers, selectedProviderId, function(p) {
			renderCredsForProvider(p);
		});
		if (selectedProvider) renderCredsForProvider(selectedProvider);

		var enabledChk = E('input', { type: 'checkbox', checked: sec.enabled !== '0' ? '' : null });
		var currentIface = sec.interface || 'auto';
		var ifaceOpts = [
			E('option', { value: 'auto', selected: currentIface === 'auto' ? '' : null }, _('auto (Auto-track default route)'))
		];
		var seenIface = { auto: true };
		ifaceList.forEach(function(ifc) {
			seenIface[ifc.interface] = true;
			var dev = ifc.l3_device || ifc.device || '';
			var ip = (ifc['ipv4-address'] && ifc['ipv4-address'][0] && ifc['ipv4-address'][0].address) ||
				(ifc['ipv6-address'] && ifc['ipv6-address'][0] && ifc['ipv6-address'][0].address) || '';
			var label = ifc.interface + (dev ? ' (' + dev + (ip ? ' · ' + ip : '') + ')' : '');
			ifaceOpts.push(E('option', { value: ifc.interface, selected: currentIface === ifc.interface ? '' : null }, label));
		});
		if (!seenIface[currentIface])
			ifaceOpts.push(E('option', { value: currentIface, selected: '' }, currentIface + ' (' + _('offline') + ')'));
		var ifaceInput = E('select', { 'class': 'cbi-input-select' }, ifaceOpts);
		var ipSourceSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: 'auto', selected: (sec.ip_source || 'auto') === 'auto' ? '' : null }, _('Auto (Interface + Public Fallback)')),
			E('option', { value: 'interface', selected: sec.ip_source === 'interface' ? '' : null }, _('Network Interface')),
			E('option', { value: 'public_url', selected: sec.ip_source === 'public_url' ? '' : null }, _('URL'))
		]);
		var ttlInput = E('input', { type: 'number', 'class': 'cbi-input-text', value: sec.ttl || '600', min: '60' });
		var forceIntInput = E('input', { type: 'number', 'class': 'cbi-input-text', value: sec.force_interval || '259200', min: '0' });
		var proxiedChk = E('input', { type: 'checkbox', checked: sec.proxied === '1' ? '' : null });
		var allowPrivChk = E('input', { type: 'checkbox', checked: sec.allow_private_ip === '1' ? '' : null });
		var proxyInput = E('input', { type: 'text', 'class': 'cbi-input-text', value: sec.proxy || '', placeholder: 'http://127.0.0.1:7890' });
		var dnsServerInput = E('input', { type: 'text', 'class': 'cbi-input-text', value: sec.dns_server || '', placeholder: 'https://dns.example.com/dns-query' });

		function makeRow(label, fieldEl, desc) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' }, desc ? [fieldEl, E('div', { 'class': 'cbi-value-description' }, desc)] : [fieldEl])
			]);
		}

		var basicPane = E('div', {}, [
			makeRow(_('Enabled'), enabledChk),
			makeRow(_('Lookup Hostname / Domain'), domainInput, _('Standard FQDN, e.g. home.example.com')),
			makeRow(_('DDNS Service Provider'), combo.el),
			makeRow(_('Credentials'), credsContainer),
			makeRow(_('IP Address Version'), ipModeSelect)
		]);

		var advPane = E('div', { style: 'display:none' }, [
			E('div', { 'class': 'ddnsox-adv-section' }, [
				E('div', { 'class': 'ddnsox-adv-section-head' }, [
					E('div', { 'class': 'ddnsox-adv-section-title' }, _('WAN Interface & Record Options')),
					E('div', { 'class': 'ddnsox-adv-section-desc' },
						_('Used for multi-WAN outbound binding, record TTL, and keep-alive renewal intervals.'))
				]),
				makeRow(_('IP Address Source'), ipSourceSelect),
				makeRow(_('Outbound WAN Interface'), ifaceInput, _('Bind this rule to a specific WAN interface for multi-WAN setups, or keep "auto".')),
				makeRow(_('TTL (seconds)'), ttlInput),
				makeRow(_('Force Interval (seconds)'), forceIntInput),
				makeRow(_('Cloudflare Proxy'), proxiedChk),
				makeRow(_('Allow Non-Public IPs'), allowPrivChk)
			]),
			E('div', { 'class': 'ddnsox-adv-section' }, [
				E('div', { 'class': 'ddnsox-adv-section-head' }, [
					E('div', { 'class': 'ddnsox-adv-section-title' }, _('Special Environments: Proxy & Private DNS')),
					E('div', { 'class': 'ddnsox-adv-section-desc' },
						_('Optional overrides for restricted networks or internal enterprise DNS. Leave empty for standard broadband.'))
				]),
				makeRow(_('HTTP / SOCKS5 Proxy'), proxyInput,
					_('Use when the router cannot reach overseas provider APIs (e.g. Cloudflare/Porkbun) directly. Only provider API updates use this proxy; WAN IP probing is unaffected.')),
				makeRow(_('Custom Verification DNS'), dnsServerInput,
					_('Use for internal/private authoritative DNS (e.g. 10.0.0.53) or a custom DoH URL. Leave empty to use the global anti-poisoning DoH servers.'))
			])
		]);

		var logArea = E('textarea', {
			readonly: 'readonly',
			style: 'width:100%;height:260px;font-family:var(--font-mono,monospace);font-size:12px;box-sizing:border-box;padding:8px'
		}, _('Loading logs...'));
		var logPane = E('div', { style: 'display:none' }, [logArea]);

		var tabBasic = E('button', { type: 'button', 'class': 'ddnsox-modal-tab active' }, _('Basic Settings'));
		var tabAdv = E('button', { type: 'button', 'class': 'ddnsox-modal-tab' }, _('Advanced Settings'));
		var tabLog = E('button', { type: 'button', 'class': 'ddnsox-modal-tab' }, _('Log File Viewer'));

		function switchTab(name) {
			tabBasic.classList.toggle('active', name === 'basic');
			tabAdv.classList.toggle('active', name === 'adv');
			tabLog.classList.toggle('active', name === 'log');
			basicPane.style.display = name === 'basic' ? '' : 'none';
			advPane.style.display = name === 'adv' ? '' : 'none';
			logPane.style.display = name === 'log' ? '' : 'none';
			if (name === 'log' && ruleId) {
				ddnsox.rpc.getLogs(ruleId, 'debug', '', 100).then(function(res) {
					var lines = (res && res.lines) || [];
					logArea.value = lines.length
						? lines.map(function(l) { return '[%s] %s'.format(l.level.toUpperCase(), l.msg); }).join('\n')
						: _('No logs for this rule yet.');
				});
			}
		}

		tabBasic.addEventListener('click', function() { switchTab('basic'); });
		tabAdv.addEventListener('click', function() { switchTab('adv'); });
		tabLog.addEventListener('click', function() { switchTab('log'); });

		var banner = E('div', { 'class': 'alert-message error', style: 'display:none;margin-bottom:12px' });

		var cancelBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-neutral' }, _('Dismiss'));
		cancelBtn.addEventListener('click', ui.hideModal);

		var saveBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-action' }, _('Save'));
		saveBtn.addEventListener('click', function() {
			credRefs.forEach(function(item) { credValues[item.key] = item.ref.flush(); });
			var domain = domainInput.value.trim().toLowerCase().replace(/@/g, '.');
			if (!domain || domain.indexOf('.') === -1) {
				banner.textContent = _('Please enter a valid domain name.');
				banner.style.display = 'block';
				return;
			}

			saveBtn.disabled = true;
			saveBtn.textContent = _('Saving...');

			var sid = ruleId || ('rule_' + Date.now().toString(36));
			if (isNew) uci.add('ddnsox', 'rule', sid);
			uci.set('ddnsox', sid, 'enabled', enabledChk.checked ? '1' : '0');
			uci.set('ddnsox', sid, 'domain', domain);
			uci.set('ddnsox', sid, 'provider', combo.getValue());
			uci.set('ddnsox', sid, 'ip_mode', ipModeSelect.value);
			uci.set('ddnsox', sid, 'username', credValues.username || '');
			uci.set('ddnsox', sid, 'password', credValues.password || '');
			uci.set('ddnsox', sid, 'custom_url', credValues.custom_url || '');
			uci.set('ddnsox', sid, 'interface', ifaceInput.value.trim() || 'auto');
			uci.set('ddnsox', sid, 'ip_source', ipSourceSelect.value);
			uci.set('ddnsox', sid, 'ttl', ttlInput.value || '600');
			uci.set('ddnsox', sid, 'force_interval', forceIntInput.value || '259200');
			uci.set('ddnsox', sid, 'proxied', proxiedChk.checked ? '1' : '0');
			uci.set('ddnsox', sid, 'allow_private_ip', allowPrivChk.checked ? '1' : '0');
			uci.set('ddnsox', sid, 'proxy', proxyInput.value.trim());
			uci.set('ddnsox', sid, 'dns_server', dnsServerInput.value.trim());

			uci.save().then(function() {
				return uci.apply();
			}).then(function() {
				return ddnsox.rpc.serviceAction('reload');
			}).then(function() {
				ui.hideModal();
				setTimeout(function() { self.refreshOverview(); }, 600);
			}).catch(function(err) {
				banner.textContent = err.message || _('Failed to save rule');
				banner.style.display = 'block';
			}).finally(function() {
				saveBtn.disabled = false;
				saveBtn.textContent = _('Save');
			});
		});

		var tabs = isNew ? [tabBasic, tabAdv] : [tabBasic, tabAdv, tabLog];
		var modal = ui.showModal(isNew ? _('Add new services...') : _('Configure: %s').format(sec.domain || ruleId), [
			banner,
			E('div', { 'class': 'ddnsox-modal-tabs' }, tabs),
			basicPane,
			advPane,
			logPane,
			E('div', { 'class': 'button-row right' }, [cancelBtn, saveBtn])
		]);
		if (modal) modal.classList.add('ddnsox-modal');
	},

	renderServicesTable: function(data, providers, interfaces) {
		var self = this;
		var rules = data.rules || [];

		var head = E('div', { 'class': 'ddnsox-panel-head' }, [
			E('span', {}, _('Services')),
			E('span', { 'class': 'ddnsox-count-pill' }, String(rules.length))
		]);

		var rows = [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Name')),
				E('div', { 'class': 'th' }, _('Registered IP')),
				E('div', { 'class': 'th' }, _('Last Update / Next Check')),
				E('div', { 'class': 'th' }, _('Status')),
				E('div', { 'class': 'th cbi-section-actions' }, _('Actions'))
			])
		];

		if (rules.length === 0) {
			rows.push(E('div', { 'class': 'tr placeholder' },
				_('This section contains no values yet')));
		} else {
			rules.forEach(function(r) {
				var st = ddnsox.stateMeta(r.state);
				var ipLines = [];
				if (r.ip_mode !== 'ipv6' && r.v4) {
					var v4Txt = r.v4.in_sync && r.v4.probed_ip
						? 'v4: ' + r.v4.probed_ip + ' ✓'
						: 'v4: %s → %s'.format(r.v4.probed_ip || '-', r.v4.dns_ip || '-');
					ipLines.push(E('div', { 'class': 'ddnsox-mono', style: 'white-space:nowrap' }, v4Txt));
				}
				if (r.ip_mode !== 'ipv4' && r.v6) {
					var v6Txt = r.v6.in_sync && r.v6.probed_ip
						? 'v6: ' + r.v6.probed_ip + ' ✓'
						: 'v6: %s → %s'.format(r.v6.probed_ip || '-', r.v6.dns_ip || '-');
					ipLines.push(E('div', { 'class': 'ddnsox-mono', style: 'white-space:nowrap' }, v6Txt));
				}

				var reloadBtn = E('button', {
					type: 'button',
					'class': 'cbi-button cbi-button-action',
					disabled: !r.enabled ? true : null
				}, _('Reload'));
				reloadBtn.addEventListener('click', function() {
					reloadBtn.disabled = true;
					ddnsox.rpc.triggerSync(r.id, true).finally(function() {
						reloadBtn.disabled = false;
						setTimeout(function() { self.refreshOverview(); }, 600);
					});
				});

				var stopBtn = E('button', {
					type: 'button',
					'class': 'cbi-button cbi-button-neutral'
				}, r.enabled ? _('Stop') : _('Start'));
				stopBtn.addEventListener('click', function() {
					stopBtn.disabled = true;
					uci.set('ddnsox', r.id, 'enabled', r.enabled ? '0' : '1');
					uci.save().then(function() { return uci.apply(); }).then(function() {
						return ddnsox.rpc.serviceAction('reload');
					}).then(function() {
						setTimeout(function() { self.refreshOverview(); }, 500);
					});
				});

				var editBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-neutral' }, _('Edit'));
				editBtn.addEventListener('click', function() {
					self.openRuleModal(r.id, providers, interfaces);
				});

				var delBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-negative' }, _('Delete'));
				delBtn.addEventListener('click', function() {
					uci.remove('ddnsox', r.id);
					uci.save().then(function() { return uci.apply(); }).then(function() {
						return ddnsox.rpc.serviceAction('reload');
					}).then(function() {
						setTimeout(function() { self.refreshOverview(); }, 500);
					});
				});

				var boundIface = uci.get('ddnsox', r.id, 'interface');
				var pname = (r.provider_name || r.provider).replace(/\s*\([^)]*\)\s*$/, '');
				var subLabel = '%s · %s'.format(pname, (r.ip_mode || 'dual').toUpperCase()) +
					(boundIface && boundIface !== 'auto' ? ' · ' + boundIface : '');

				rows.push(E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td', 'data-title': _('Name') }, [
						E('div', { style: 'font-weight:600;white-space:nowrap' }, r.domain || r.id),
						E('div', { style: 'font-size:12px;color:var(--text-color-medium);white-space:nowrap' }, subLabel)
					]),
					E('div', { 'class': 'td', 'data-title': _('Registered IP') }, ipLines.length ? ipLines : '-'),
					E('div', { 'class': 'td', 'data-title': _('Last Update / Next Check'), style: 'white-space:nowrap' }, [
						E('div', {}, _('Last: %s').format(ddnsox.formatTime(r.last_update))),
						E('div', { style: 'font-size:12px;color:var(--text-color-medium)' }, _('Next: %s').format(ddnsox.formatTime(r.next_check)))
					]),
					E('div', { 'class': 'td', 'data-title': _('Status') }, [
						E('span', { 'class': 'ddnsox-tag ' + st.cls, title: r.error_message || '' }, st.label),
						r.error_message ? E('div', {
							'class': 'ddnsox-ellipsis',
							style: 'font-size:11.5px;color:var(--error-color-low);margin-top:3px',
							title: r.error_message
						}, r.error_message) : null
					].filter(Boolean)),
					E('div', { 'class': 'td cbi-section-actions' }, [
						E('div', {}, [reloadBtn, stopBtn, editBtn, delBtn])
					])
				]));
			});
		}

		var addBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-add' }, _('Add new services...'));
		addBtn.addEventListener('click', function() {
			self.openRuleModal(null, providers, interfaces);
		});

		return E('div', {}, [
			head,
			E('div', { 'class': 'ddnsox-panel-body' }, [
				E('div', { 'class': 'table' }, rows),
				E('div', { 'class': 'ddnsox-table-footer' }, [
					addBtn,
					E('span', { style: 'font-size:12px;color:var(--text-color-medium)' },
						_('Event-driven updates + clean DoH verification'))
				])
			])
		]);
	},

	refreshOverview: function() {
		var self = this;
		return Promise.all([
			ddnsox.rpc.getOverview(),
			ddnsox.rpc.getProviders(),
			ddnsox.rpc.getInterfaces().catch(function() { return { interface: [] }; })
		]).then(function(res) {
			var data = res[0] || {};
			var providers = (res[1] && res[1].providers) || [];
			var interfaces = (res[2] && res[2].interface) || [];
			var badge = document.getElementById('ddnsox_service_badge');
			var statusBox = document.getElementById('ddnsox_status_panel');
			var tablesBox = document.getElementById('ddnsox_tables_box');
			var running = !!(data.daemon && data.daemon.running);

			if (badge) {
				badge.className = 'ddnsox-dot ' + (running ? 'ddnsox-pill-ok' : 'ddnsox-pill-err');
				badge.textContent = running ? _('Running') : _('Stopped');
			}
			if (statusBox) {
				statusBox.innerHTML = '';
				statusBox.appendChild(self.renderGlobalSection(data));
			}
			if (tablesBox && !document.querySelector('#modal_overlay > .modal.ddnsox-modal')) {
				tablesBox.innerHTML = '';
				tablesBox.appendChild(self.renderServicesTable(data, providers, interfaces));
			}
		});
	},

	render: function(res) {
		var self = this;
		var data = res[0] || {};
		var providers = (res[1] && res[1].providers) || [];
		var interfaces = (res[2] && res[2].interface) || [];
		var running = !!(data.daemon && data.daemon.running);
		var styleEl = ddnsox.injectStyles();

		var statusPanel = E('div', { id: 'ddnsox_status_panel', 'class': 'ddnsox-outer-box' },
			this.renderGlobalSection(data));
		var tablesBox = E('div', { id: 'ddnsox_tables_box', 'class': 'ddnsox-outer-box' },
			this.renderServicesTable(data, providers, interfaces));

		poll.add(function() {
			return self.refreshOverview();
		}, 5);

		return E('div', { id: 'cbi-ddnsox' }, [
			styleEl,
			E('h2', { 'class': 'ddnsox-page-title' }, [
				E('span', {}, _('Dynamic DNSox')),
				E('span', {
					id: 'ddnsox_service_badge',
					'class': 'ddnsox-dot ' + (running ? 'ddnsox-pill-ok' : 'ddnsox-pill-err')
				}, running ? _('Running') : _('Stopped'))
			]),
			E('div', { 'class': 'cbi-map-descr' },
				_('Event-driven Dynamic DNS client with netifd interface tracking and DoH verification.')),
			statusPanel,
			tablesBox
		].filter(Boolean));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
