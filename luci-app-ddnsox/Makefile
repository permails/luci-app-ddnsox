#
# Copyright (C) 2026 permails <logo@permails.com>
#
# This is free software, licensed under the Apache License, Version 2.0.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for DDNSox (Event-driven Dynamic DNS)
LUCI_DEPENDS:=+luci-base +ddnsox +rpcd-mod-ucode
LUCI_PKGARCH:=all
PKG_VERSION:=26.11.24
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=permails <logo@permails.com>

CONFLICTS:=luci-app-ddns ddns-scripts

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
