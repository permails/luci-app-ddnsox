'use strict';
'require baseclass';
'require rpc';
'require ui';

var callGetOverview = rpc.declare({
	object: 'luci.ddnsox',
	method: 'get_overview',
	expect: {}
});

var callGetProviders = rpc.declare({
	object: 'luci.ddnsox',
	method: 'get_providers',
	expect: {}
});

var callTriggerSync = rpc.declare({
	object: 'luci.ddnsox',
	method: 'trigger_sync',
	params: ['id', 'force'],
	expect: {}
});

var callTestProbe = rpc.declare({
	object: 'luci.ddnsox',
	method: 'test_probe',
	params: ['id', 'ip_mode', 'interface'],
	expect: {}
});

var callGetLogs = rpc.declare({
	object: 'luci.ddnsox',
	method: 'get_logs',
	params: ['rule', 'level', 'query', 'limit'],
	expect: {}
});

var callServiceAction = rpc.declare({
	object: 'luci.ddnsox',
	method: 'service_action',
	params: ['action'],
	expect: {}
});

var callMigrateLegacy = rpc.declare({
	object: 'luci.ddnsox',
	method: 'migrate_legacy',
	params: ['dry_run'],
	expect: {}
});

var callNetworkInterfaces = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: {}
});

var SHARED_CSS = `
/* ===== DDNSox Design Tokens & Theme Adaptation ===== */
#maincontent ul.tabs {
	display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; margin: 0 0 16px 0;
	border-radius: 8px;
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
	border: 1px solid var(--border-color-low);
	background-image: none; background-size: auto;
}
#maincontent ul.tabs > li {
	height: auto !important; max-width: none; margin: 0 !important;
	border-radius: 6px; border: 1px solid transparent;
	background: transparent; background-image: none;
	color: var(--text-color-medium);
	transition: background 0.15s ease, color 0.15s ease;
}
#maincontent ul.tabs > li > a {
	padding: 6px 14px; line-height: 1.4; font-size: 13.5px; font-weight: 500;
	border-radius: 6px; background: transparent;
}
#maincontent ul.tabs > li:not(.active):hover {
	background: var(--background-color-high); background-image: none;
	color: var(--primary-color-high);
}
#maincontent ul.tabs > li.active {
	background: var(--background-color-high); background-image: none;
	border-color: var(--border-color-low); color: var(--primary-color-high);
	font-weight: 600; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.ddnsox-page-title {
	display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
	margin: 4px 0 10px 0 !important;
}
#cbi-ddnsox > h2:not(.ddnsox-page-title) {
	margin: 4px 0 22px 0 !important;
}
#cbi-ddnsox > .cbi-map-descr,
#cbi-ddnsox .cbi-map > .cbi-map-descr {
	margin: 0 0 24px 0 !important;
	font-size: 13px; line-height: 1.5;
	color: var(--text-color-medium);
}

/* ===== Outer Containers ===== */
.ddnsox-outer-box {
	padding: 18px 20px; margin: 0 0 16px 0;
	border-radius: 10px;
	border: 1px solid var(--border-color-low);
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
}

.ddnsox-header-bar {
	display: flex; align-items: center; justify-content: space-between;
	flex-wrap: wrap; gap: 10px; margin-bottom: 12px;
}
.ddnsox-header-bar > h3 {
	margin: 0; font-size: 15px; font-weight: 600; color: var(--text-color-high);
}

.ddnsox-toolbar {
	display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
}
.ddnsox-toolbar select {
	min-width: 170px; max-width: 260px; height: 28px; font-size: 12.5px;
	border-radius: 6px;
}
.ddnsox-toolbar .cbi-button:disabled {
	opacity: 0.45; cursor: not-allowed;
}

/* ===== 3-Column Grouped Summary Grid ===== */
.ddnsox-summary-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 12px;
}
.ddnsox-ip-line {
	font-family: var(--font-mono, monospace); font-size: 11.5px; line-height: 1.7;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ddnsox-card {
	min-height: 90px; padding: 14px 16px; border-radius: 8px;
	border: 1px solid var(--border-color-low);
	background: var(--background-color-high);
	box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
	display: flex; flex-direction: column; justify-content: space-between;
	box-sizing: border-box;
}
.ddnsox-card.is-ok {
	background: color-mix(in srgb, var(--success-color-high) 5%, var(--background-color-high));
}
.ddnsox-card.is-info {
	background: color-mix(in srgb, var(--primary-color-high) 5%, var(--background-color-high));
}
.ddnsox-card.is-warn {
	background: color-mix(in srgb, var(--warn-color-high) 7%, var(--background-color-high));
}
.ddnsox-card.is-err {
	background: color-mix(in srgb, var(--error-color-high) 5.5%, var(--background-color-high));
}
.ddnsox-card-head {
	display: flex; align-items: center; justify-content: space-between; gap: 6px;
}
.ddnsox-card-title {
	font-size: 12px; font-weight: 600; color: var(--text-color-medium);
}
.ddnsox-card-body {
	margin-top: 8px;
}
.ddnsox-card-main {
	font-size: 18px; font-weight: 600; line-height: 1.3;
	color: var(--text-color-high);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnsox-card-main.mono {
	font-family: var(--font-mono, monospace); font-size: 15px;
}
.ddnsox-card-sub {
	margin-top: 4px; font-size: 12px; color: var(--text-color-medium);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ===== Status Pills & Tags ===== */
.ddnsox-dot, .ddnsox-tag {
	display: inline-flex; align-items: center; gap: 5px;
	padding: 2px 9px; border-radius: 999px;
	font-size: 11.5px; font-weight: 600; line-height: 1.4; white-space: nowrap;
}
.ddnsox-dot::before {
	content: ''; width: 6px; height: 6px; border-radius: 50%; display: inline-block;
	background: currentColor;
}
.ddnsox-pill-ok {
	color: var(--success-color-low);
	background: rgba(var(--success-color-high-rgb, 34, 197, 94), 0.12);
}
.ddnsox-pill-info {
	color: var(--primary-color-low);
	background: color-mix(in srgb, var(--primary-color-high) 12%, transparent);
}
.ddnsox-pill-warn {
	color: var(--text-color-high);
	background: color-mix(in srgb, var(--warn-color-high) 22%, transparent);
}
.ddnsox-pill-err {
	color: var(--error-color-low);
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.12);
}
.ddnsox-pill-muted {
	color: var(--text-color-medium);
	background: var(--background-color-low);
}

:root[data-darkmode="true"] .ddnsox-pill-ok { color: var(--success-color-high); }
:root[data-darkmode="true"] .ddnsox-pill-info { color: var(--primary-color-high); }
:root[data-darkmode="true"] .ddnsox-pill-warn { color: var(--warn-color-low); }
:root[data-darkmode="true"] .ddnsox-pill-err { color: var(--error-color-high); }

/* ===== Note Banner ===== */
.ddnsox-note {
	margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 12.5px;
	display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
	border: 1px solid var(--border-color-low);
	border-left: 3px solid var(--warn-color-high);
	background: color-mix(in srgb, var(--warn-color-high) 10%, var(--background-color-high));
	color: var(--text-color-high);
}
.ddnsox-note.is-err {
	border-left-color: var(--error-color-high);
	background: color-mix(in srgb, var(--error-color-high) 8%, var(--background-color-high));
}

/* ===== Detached Tab-Header Table ===== */
.ddnsox-panel-head {
	display: inline-flex; min-width: 176px; height: 36px; box-sizing: border-box;
	align-items: center; justify-content: space-between; gap: 10px;
	margin: 0 0 8px 0 !important; padding: 0 14px;
	border: 1px solid color-mix(in srgb, var(--primary-color-high) 24%, var(--border-color-medium));
	border-radius: 8px;
	background: color-mix(in srgb, var(--primary-color-high) 7%, var(--background-color-high));
	font-size: 13.5px; font-weight: 600; color: var(--primary-color-low);
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
:root[data-darkmode="true"] .ddnsox-panel-head { color: var(--primary-color-high); }

.ddnsox-count-pill {
	padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
	background: var(--background-color-high); color: var(--text-color-medium);
	border: 1px solid var(--border-color-low);
}

.ddnsox-panel-body {
	border-radius: 8px; border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	overflow-x: auto; overflow-y: hidden;
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.ddnsox-panel-body .table {
	margin: 0; border: none; width: 100%;
}
.ddnsox-panel-body .tr.table-titles {
	background: color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high));
}
.ddnsox-panel-body .th {
	font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em;
	white-space: nowrap; color: var(--text-color-medium);
	border-bottom: 1px solid var(--border-color-low);
}
.ddnsox-panel-body .tr:not(.table-titles) {
	border-top: 1px solid var(--border-color-low);
	background: transparent;
}
.ddnsox-panel-body .tr:not(.table-titles):not(.placeholder):hover {
	background: color-mix(in srgb, var(--primary-color-high) 3%, transparent);
}
.ddnsox-panel-body .td {
	vertical-align: middle; border: none;
}
.ddnsox-panel-body .td.cbi-section-actions {
	width: 1%; white-space: nowrap;
}
.ddnsox-panel-body .td.cbi-section-actions > div {
	display: inline-flex; flex-wrap: nowrap; gap: 6px; justify-content: flex-end;
}
.ddnsox-panel-body .tr.placeholder {
	height: 52px; line-height: 52px; padding: 0 16px;
	color: var(--text-color-medium); font-size: 12.5px;
}
.ddnsox-table-footer {
	display: flex; align-items: center; justify-content: space-between;
	padding: 10px 16px; gap: 8px;
	border-top: 1px solid var(--border-color-low);
	background: color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high));
}

.ddnsox-mono {
	font-family: var(--font-mono, monospace); font-size: 12px;
}
.ddnsox-ellipsis {
	max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	display: inline-block; vertical-align: bottom;
}

/* ===== Settings Single Outer Card & Upstream CBI Tabmenu ===== */
#cbi-ddnsox .cbi-tabmenu {
	display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; margin: 0 0 14px 0;
	border-radius: 8px;
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
	border: 1px solid var(--border-color-low);
	background-image: none; background-size: auto;
}
#cbi-ddnsox .cbi-tabmenu > li {
	height: auto !important; max-width: none; margin: 0 !important;
	border-radius: 6px; border: 1px solid transparent;
	background: transparent; background-image: none;
	color: var(--text-color-medium);
}
#cbi-ddnsox .cbi-tabmenu > li > a {
	padding: 6px 14px; line-height: 1.4; font-size: 13px; font-weight: 500;
	border-radius: 6px; background: transparent;
}
#cbi-ddnsox .cbi-tabmenu > li.cbi-tab {
	background: var(--background-color-high); background-image: none;
	border-color: var(--border-color-low); color: var(--primary-color-high);
	font-weight: 600; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

#cbi-ddnsox.ddnsox-settings-wrap {
	padding: 0; border: none; background: transparent;
}
.ddnsox-cbi-card {
	padding: 18px 20px; border-radius: 10px; margin-bottom: 16px;
	border: 1px solid var(--border-color-low);
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
}
.ddnsox-cbi-card .cbi-section {
	border-radius: 8px; margin: 0; padding: 14px 16px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section {
	padding: 18px 20px; margin: 0 0 16px 0; border-radius: 10px;
	border: 1px solid var(--border-color-low);
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
	box-shadow: none;
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section:first-child { margin-top: 0; }
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section > h3 {
	display: inline-flex; min-width: 176px; height: 36px; box-sizing: border-box;
	align-items: center; justify-content: flex-start; gap: 10px;
	margin: 0 0 8px 0 !important; padding: 0 14px !important;
	border: 1px solid color-mix(in srgb, var(--primary-color-high) 24%, var(--border-color-medium)) !important;
	border-radius: 8px !important;
	background: color-mix(in srgb, var(--primary-color-high) 7%, var(--background-color-high)) !important;
	font-size: 13.5px; font-weight: 600; color: var(--primary-color-low);
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
:root[data-darkmode="true"] #cbi-ddnsox.ddnsox-settings-wrap .cbi-section > h3 {
	color: var(--primary-color-high);
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section > .cbi-section-descr {
	margin: 0 0 8px 0; padding: 0 2px; font-size: 12px; color: var(--text-color-medium);
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section-node {
	border-radius: 8px; overflow: hidden;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-value {
	margin: 0; padding: 12px 16px;
	border-bottom: 1px solid var(--border-color-low);
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-value:last-child {
	border-bottom: none;
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-dynlist {
	max-width: 420px; width: 100%;
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-input-text,
#cbi-ddnsox.ddnsox-settings-wrap .cbi-input-select {
	border-radius: 6px;
}
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section:first-child { margin-top: 0; }
#cbi-ddnsox.ddnsox-settings-wrap .cbi-section > h3 {
	margin: 0; padding: 12px 16px; font-size: 14px; font-weight: 600;
	border-bottom: 1px solid var(--border-color-low);
}

/* ===== Modal & Combobox & Cred Box ===== */
#modal_overlay > .modal.cbi-modal.ddnsox-modal {
	border-radius: 10px; padding: 18px 22px 14px 22px; overflow: visible;
	box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
}
#modal_overlay > .modal.cbi-modal.ddnsox-modal > h4 {
	margin: -18px -22px 16px -22px; padding: 14px 22px;
	border-radius: 10px 10px 0 0; font-size: 15px; font-weight: 600;
	background: var(--background-color-medium);
	border-bottom: 1px solid var(--border-color-low);
}
#modal_overlay > .modal.cbi-modal.ddnsox-modal > .button-row {
	margin: 14px -22px -14px -22px; padding: 12px 22px;
	border-radius: 0 0 10px 10px;
	background: var(--background-color-medium);
	border-top: 1px solid var(--border-color-low);
}

.ddnsox-modal-tabs {
	display: flex; gap: 4px; padding: 4px; margin: 0 0 14px 0;
	border-radius: 8px;
	background: var(--background-color-medium);
	border: 1px solid var(--border-color-low);
}
.ddnsox-modal-tab {
	flex: 1; text-align: center; padding: 6px 12px; border-radius: 6px;
	font-size: 13px; font-weight: 500; cursor: pointer;
	color: var(--text-color-medium); background: transparent; border: 1px solid transparent;
}
.ddnsox-modal-tab.active {
	background: var(--background-color-high); color: var(--primary-color-high);
	border-color: var(--border-color-low); font-weight: 600;
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.ddnsox-seg-group {
	display: inline-flex; gap: 4px; padding: 3px; border-radius: 8px;
	background: var(--background-color-medium);
	border: 1px solid var(--border-color-low);
}
.ddnsox-seg-btn {
	padding: 5px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
	cursor: pointer; border: 1px solid transparent; background: transparent;
	color: var(--text-color-medium); transition: all 0.15s ease;
}
.ddnsox-seg-btn.active {
	background: var(--background-color-high); color: var(--primary-color-high);
	border-color: var(--border-color-low); font-weight: 600;
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.ddnsox-adv-details {
	margin-top: 12px; border-radius: 8px;
	border: 1px solid var(--border-color-low);
	background: color-mix(in srgb, var(--background-color-low) 35%, var(--background-color-high));
}
.ddnsox-adv-details > summary {
	padding: 10px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
	color: var(--text-color-medium); user-select: none; list-style: none;
	display: flex; align-items: center; justify-content: space-between;
}
.ddnsox-adv-details > summary::after {
	content: '▸'; font-size: 12px; transition: transform 0.15s ease;
}
.ddnsox-adv-details[open] > summary::after {
	transform: rotate(90deg);
}
.ddnsox-adv-body {
	padding: 6px 14px 12px 14px;
	border-top: 1px solid var(--border-color-low);
}
.ddnsox-adv-section {
	padding: 12px 14px; margin-bottom: 12px; border-radius: 8px;
	border: 1px solid var(--border-color-low);
	background: color-mix(in srgb, var(--background-color-low) 35%, var(--background-color-high));
}
.ddnsox-adv-section:last-child { margin-bottom: 0; }
.ddnsox-adv-section-head {
	margin-bottom: 10px; padding-bottom: 8px;
	border-bottom: 1px solid var(--border-color-low);
}
.ddnsox-adv-section-title {
	font-size: 13.5px; font-weight: 600; color: var(--text-color-high);
}
.ddnsox-adv-section-desc {
	margin-top: 2px; font-size: 12px; color: var(--text-color-medium);
}
.ddnsox-ip-diff {
	display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
	font-family: var(--font-mono, monospace); font-size: 12px;
}
.ddnsox-ip-match { color: var(--success-color-low); font-weight: 600; }
.ddnsox-ip-mismatch { color: var(--warn-color-low, #b45309); font-weight: 600; }
:root[data-darkmode="true"] .ddnsox-ip-match { color: var(--success-color-high); }
:root[data-darkmode="true"] .ddnsox-ip-mismatch { color: var(--warn-color-high); }

.ddnsox-combo {
	position: relative; width: 100%; max-width: 460px;
}
.ddnsox-combo-input {
	width: 100%; padding-right: 54px !important; box-sizing: border-box;
}
.ddnsox-combo-btns {
	position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
	display: inline-flex; align-items: center; gap: 4px;
}
.ddnsox-combo-btn {
	border: none; background: transparent; cursor: pointer;
	color: var(--text-color-medium); padding: 2px 5px; font-size: 13px; line-height: 1;
}
.ddnsox-combo-menu {
	position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 1200;
	max-height: 240px; overflow-y: auto; border-radius: 8px;
	background: var(--background-color-high);
	border: 1px solid var(--border-color-medium);
	box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16);
	display: none;
}
.ddnsox-combo-menu.open { display: block; }
.ddnsox-combo-meta {
	padding: 6px 10px; font-size: 11px; color: var(--text-color-medium);
	border-bottom: 1px solid var(--border-color-low);
}
.ddnsox-combo-item {
	padding: 8px 10px; cursor: pointer; display: flex; justify-content: space-between;
	align-items: center; gap: 8px; font-size: 13px;
}
.ddnsox-combo-item:hover, .ddnsox-combo-item.active {
	background: color-mix(in srgb, var(--primary-color-high) 10%, transparent);
	color: var(--primary-color-high);
}
.ddnsox-combo-id {
	font-family: var(--font-mono, monospace); font-size: 11px; color: var(--text-color-medium);
}

.ddnsox-creds-wrap {
	width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 10px;
}
.ddnsox-cred-item label {
	display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px;
	color: var(--text-color-medium);
}
.ddnsox-cred-box {
	position: relative; width: 100%;
}
.ddnsox-cred-box input {
	width: 100%; padding-right: 58px !important; box-sizing: border-box;
}
.ddnsox-cred-toggle {
	position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
	padding: 3px 7px; font-size: 11px; border-radius: 4px; cursor: pointer;
	border: 1px solid var(--border-color-low);
	background: var(--background-color-medium); color: var(--text-color-medium);
}
.ddnsox-cred-warn {
	margin-top: 4px; padding: 4px 8px; border-radius: 4px; font-size: 11.5px;
	display: flex; align-items: center; justify-content: space-between; gap: 6px;
	color: var(--error-color-low);
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.1);
}

/* ===== Log Viewer ===== */
.ddnsox-log-card {
	border-radius: 8px; border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
	overflow: hidden;
}
.ddnsox-log-toolbar {
	display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
	gap: 8px; padding: 10px 14px;
	border-bottom: 1px solid var(--border-color-low);
	background: color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high));
}
.ddnsox-log-body textarea {
	width: 100%; height: 500px; box-sizing: border-box; border: none; padding: 12px 14px;
	font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.5;
	white-space: pre; overflow: auto; resize: vertical;
	background: var(--background-color-high); color: var(--text-color-high);
}

/* ===== Responsive Breakpoints: 860 / 768 / 520 ===== */
@media screen and (max-width: 860px) {
	.ddnsox-summary-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
}

@media screen and (max-width: 768px), screen and (max-device-width: 600px) {
	.ddnsox-outer-box input, .ddnsox-outer-box select,
	.ddnsox-modal input, .ddnsox-modal select,
	.ddnsox-log-toolbar input, .ddnsox-log-toolbar select {
		font-size: 16px !important; min-height: 36px; box-sizing: border-box;
	}
	.cbi-button { min-height: 34px; }
	#maincontent ul.tabs > li { flex: 1 1 auto; text-align: center; }

	.ddnsox-toolbar {
		display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%;
	}
	.ddnsox-toolbar select, .ddnsox-toolbar .ddnsox-full-btn {
		grid-column: 1 / -1; max-width: none; width: 100%;
	}

	.ddnsox-panel-body .tr.table-titles { display: none !important; }
	.ddnsox-panel-body .tr:not(.table-titles):not(.placeholder) {
		display: flex; flex-wrap: wrap; padding: 10px 12px; margin: 8px;
		border: 1px solid var(--border-color-low); border-radius: 8px;
		background: var(--background-color-high);
	}
	.ddnsox-panel-body .td {
		flex: 1 1 calc(50% - 10px); min-width: 130px; padding: 4px 6px;
		white-space: normal; word-break: break-word;
	}
	.ddnsox-panel-body .td[data-title]::before {
		content: attr(data-title); display: block; font-size: 11px;
		font-weight: 600; color: var(--text-color-medium); margin-bottom: 2px;
	}
	.ddnsox-panel-body .td.cbi-section-actions {
		flex: 1 1 100%; width: 100%; margin-top: 6px; padding-top: 8px;
		border-top: 1px dashed var(--border-color-low);
	}

	#modal_overlay > .modal.cbi-modal.ddnsox-modal {
		width: calc(100vw - 20px) !important; margin: 10px auto; padding: 14px 14px 12px 14px;
	}
	#modal_overlay > .modal.cbi-modal.ddnsox-modal > h4 {
		margin: -14px -14px 12px -14px; padding: 12px 14px;
	}
	#modal_overlay > .modal.cbi-modal.ddnsox-modal > .button-row {
		margin: 12px -14px -12px -14px; padding: 10px 14px;
	}
	.ddnsox-modal .cbi-value {
		flex-direction: column; align-items: stretch;
	}
	.ddnsox-modal .cbi-value-title {
		text-align: left; width: 100%; margin-bottom: 4px;
	}
	.ddnsox-modal .cbi-value-field {
		width: 100%;
	}
}

@media screen and (max-width: 520px) {
	.ddnsox-summary-grid { grid-template-columns: 1fr; }
	.ddnsox-panel-body .td { flex: 1 1 100%; }
	#modal_overlay > .modal.cbi-modal.ddnsox-modal > .button-row .btn,
	#modal_overlay > .modal.cbi-modal.ddnsox-modal > .button-row .cbi-button {
		flex: 1 1 auto;
	}
}
`;

return baseclass.extend({
	rpc: {
		getOverview: callGetOverview,
		getProviders: callGetProviders,
		triggerSync: callTriggerSync,
		testProbe: callTestProbe,
		getLogs: callGetLogs,
		serviceAction: callServiceAction,
		migrateLegacy: callMigrateLegacy,
		getInterfaces: callNetworkInterfaces
	},

	injectStyles: function() {
		if (document.getElementById('ddnsox-shared-style'))
			return null;
		return E('style', { id: 'ddnsox-shared-style' }, SHARED_CSS);
	},

	formatUptime: function(sec) {
		sec = parseInt(sec, 10) || 0;
		if (sec <= 0) return '-';
		var d = Math.floor(sec / 86400);
		var h = Math.floor((sec % 86400) / 3600);
		var m = Math.floor((sec % 3600) / 60);
		if (d > 0) return '%dd %dh'.format(d, h);
		if (h > 0) return '%dh %dm'.format(h, m);
		return '%dm %ds'.format(m, sec % 60);
	},

	formatTime: function(ts) {
		if (!ts || ts <= 0) return '-';
		var d = new Date(ts * 1000);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	},

	stateMeta: function(state) {
		switch (state) {
		case 'synced':
			return { cls: 'ddnsox-pill-ok', label: _('Synced') };
		case 'updating':
		case 'probing':
		case 'checking_dns':
		case 'initializing':
			return { cls: 'ddnsox-pill-info', label: _('Syncing') };
		case 'backoff':
			return { cls: 'ddnsox-pill-warn', label: _('Retrying') };
		case 'error':
			return { cls: 'ddnsox-pill-err', label: _('Error') };
		default:
			return { cls: 'ddnsox-pill-muted', label: _('Disabled') };
		}
	},

	createCombobox: function(providers, selectedId, onChange) {
		var current = providers.find(function(p) { return p.id === selectedId; }) || providers[0];
		var activeIdx = -1;

		var input = E('input', {
			type: 'text',
			'class': 'cbi-input-text ddnsox-combo-input',
			value: current ? current.name : '',
			placeholder: _('Search DNS provider...')
		});
		var clearBtn = E('button', { type: 'button', 'class': 'ddnsox-combo-btn', title: _('Clear') }, '×');
		var dropBtn = E('button', { type: 'button', 'class': 'ddnsox-combo-btn', title: _('Toggle list') }, '▾');
		var menu = E('div', { 'class': 'ddnsox-combo-menu' });

		var wrap = E('div', { 'class': 'ddnsox-combo' }, [
			input,
			E('div', { 'class': 'ddnsox-combo-btns' }, [clearBtn, dropBtn]),
			menu
		]);

		function renderList(filter) {
			var q = (filter || '').trim().toLowerCase();
			var matches = providers.filter(function(p) {
				return !q || p.name.toLowerCase().indexOf(q) !== -1 || p.id.toLowerCase().indexOf(q) !== -1;
			});

			menu.innerHTML = '';
			menu.appendChild(E('div', { 'class': 'ddnsox-combo-meta' },
				_('%d providers matched').format(matches.length)));

			matches.forEach(function(p, idx) {
				var item = E('div', {
					'class': 'ddnsox-combo-item' + (idx === activeIdx ? ' active' : ''),
					'data-id': p.id
				}, [
					E('span', {}, p.name),
					E('span', { 'class': 'ddnsox-combo-id' }, p.id)
				]);
				item.addEventListener('mousedown', function(ev) {
					ev.preventDefault();
					selectProvider(p);
				});
				menu.appendChild(item);
			});
		}

		function selectProvider(p) {
			current = p;
			input.value = p.name;
			menu.classList.remove('open');
			if (onChange) onChange(p);
		}

		input.addEventListener('focus', function() {
			activeIdx = -1;
			renderList('');
			menu.classList.add('open');
		});
		input.addEventListener('input', function() {
			activeIdx = 0;
			renderList(input.value);
			menu.classList.add('open');
		});
		var onDocMouseDown = function(ev) {
			if (!wrap.isConnected) {
				document.removeEventListener('mousedown', onDocMouseDown);
				return;
			}
			if (!wrap.contains(ev.target)) {
				menu.classList.remove('open');
				if (current && input.value !== current.name)
					input.value = current.name;
			}
		};
		document.addEventListener('mousedown', onDocMouseDown);

		input.addEventListener('keydown', function(ev) {
			var items = menu.querySelectorAll('.ddnsox-combo-item');
			if (ev.key === 'ArrowDown') {
				ev.preventDefault();
				activeIdx = Math.min(activeIdx + 1, items.length - 1);
				renderList(input.value);
			} else if (ev.key === 'ArrowUp') {
				ev.preventDefault();
				activeIdx = Math.max(activeIdx - 1, 0);
				renderList(input.value);
			} else if (ev.key === 'Enter' && menu.classList.contains('open') && items[activeIdx]) {
				ev.preventDefault();
				var pid = items[activeIdx].getAttribute('data-id');
				var p = providers.find(function(x) { return x.id === pid; });
				if (p) selectProvider(p);
			} else if (ev.key === 'Escape' || ev.key === 'Tab') {
				menu.classList.remove('open');
				if (current && input.value !== current.name)
					input.value = current.name;
			}
		});

		clearBtn.addEventListener('mousedown', function(ev) { ev.preventDefault(); });
		clearBtn.addEventListener('click', function() {
			input.value = '';
			input.focus();
			renderList('');
			menu.classList.add('open');
		});
		dropBtn.addEventListener('mousedown', function(ev) { ev.preventDefault(); });
		dropBtn.addEventListener('click', function() {
			if (menu.classList.contains('open')) {
				menu.classList.remove('open');
			} else {
				input.focus();
				renderList('');
				menu.classList.add('open');
			}
		});

		return {
			el: wrap,
			getValue: function() { return current ? current.id : ''; }
		};
	},

	createCredField: function(field, value, onDebouncedChange) {
		var isSecret = !!field.secret;
		var input = E('input', {
			type: isSecret ? 'password' : 'text',
			'class': 'cbi-input-text',
			value: value || '',
			placeholder: field.placeholder || ''
		});
		var warnBox = E('div', { 'class': 'ddnsox-cred-warn', style: 'display:none' });
		var timer = null;

		function checkFormat() {
			var v = input.value;
			var bad = /^['"]|['"]$/.test(v.trim()) || /^(export\s+|[A-Z0-9_]+=)/.test(v.trim());
			if (!bad) {
				warnBox.style.display = 'none';
				warnBox.innerHTML = '';
				return;
			}
			warnBox.style.display = 'flex';
			warnBox.innerHTML = '';
			warnBox.appendChild(E('span', {}, _('Detected extra quotes or KEY= prefix')));
			var fixBtn = E('button', { type: 'button', 'class': 'cbi-button cbi-button-neutral' }, _('Auto-fix'));
			fixBtn.addEventListener('click', function() {
				var cleaned = v.trim().replace(/^export\s+/, '').replace(/^[A-Za-z0-9_]+=/, '').replace(/^['"]|['"]$/g, '');
				input.value = cleaned;
				checkFormat();
				if (onDebouncedChange) onDebouncedChange(cleaned);
			});
			warnBox.appendChild(fixBtn);
		}

		input.addEventListener('input', function() {
			checkFormat();
			clearTimeout(timer);
			timer = setTimeout(function() {
				if (onDebouncedChange) onDebouncedChange(input.value);
			}, 220);
		});

		var children = [input];
		if (isSecret) {
			var toggle = E('button', { type: 'button', 'class': 'ddnsox-cred-toggle' }, _('Show'));
			toggle.addEventListener('click', function() {
				if (input.type === 'password') {
					input.type = 'text';
					toggle.textContent = _('Hide');
				} else {
					input.type = 'password';
					toggle.textContent = _('Show');
				}
			});
			children.push(toggle);
		}

		checkFormat();
		return {
			el: E('div', { 'class': 'ddnsox-cred-item' }, [
				E('label', {}, field.label + (field.required ? ' *' : '')),
				E('div', { 'class': 'ddnsox-cred-box' }, children),
				warnBox
			]),
			flush: function() {
				clearTimeout(timer);
				return input.value;
			}
		};
	}
});
