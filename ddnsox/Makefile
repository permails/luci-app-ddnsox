#
# Copyright (C) 2026 permails <logo@permails.com>
#
# This is free software, licensed under the Apache License, Version 2.0.

include $(TOPDIR)/rules.mk

PKG_NAME:=ddnsox
PKG_VERSION:=26.11.24
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=permails <logo@permails.com>

include $(INCLUDE_DIR)/package.mk

define Package/ddnsox
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=IP Addresses and Names
  TITLE:=Event-driven Dynamic DNS daemon in ucode
  URL:=https://openwrt.org/
  PKGARCH:=all
  CONFLICTS:=ddns-scripts
  DEPENDS:=+ucode +ucode-mod-uloop +ucode-mod-ubus +ucode-mod-uci +ucode-mod-fs +ucode-mod-digest +ca-bundle +uclient-fetch
endef

define Package/ddnsox/description
  Modern event-driven Dynamic DNS daemon written in native OpenWrt ucode.
  Subscribes to netifd ubus interface events, validates public IPv4/IPv6
  addresses, verifies DNS records via DoH/authoritative NS to prevent DNS
  poisoning, and replaces legacy shell-polling ddns-scripts.
endef

define Package/ddnsox/conffiles
/etc/config/ddnsox
endef

define Build/Prepare
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/ddnsox/install
	$(INSTALL_DIR) $(1)/etc/config $(1)/etc/init.d $(1)/etc/uci-defaults
	$(INSTALL_CONF) ./files/etc/config/ddnsox $(1)/etc/config/ddnsox
	$(INSTALL_BIN) ./files/etc/init.d/ddnsox $(1)/etc/init.d/ddnsox
	$(INSTALL_BIN) ./files/etc/uci-defaults/60-ddnsox-migrate $(1)/etc/uci-defaults/60-ddnsox-migrate

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/ddnsoxd $(1)/usr/sbin/ddnsoxd

	$(INSTALL_DIR) $(1)/usr/share/ddnsox/lib $(1)/usr/share/ddnsox/providers
	$(INSTALL_DATA) ./files/usr/share/ddnsox/lib/*.uc $(1)/usr/share/ddnsox/lib/
	$(INSTALL_DATA) ./files/usr/share/ddnsox/providers/registry.json $(1)/usr/share/ddnsox/providers/registry.json
	$(INSTALL_DATA) ./files/usr/share/ddnsox/providers/*.uc $(1)/usr/share/ddnsox/providers/
endef

$(eval $(call BuildPackage,ddnsox))
