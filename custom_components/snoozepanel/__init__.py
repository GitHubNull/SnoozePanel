"""SnoozePanel 后端集成：设备级配置持久化 + 侧边栏导航入口。

提供 WebSocket API 把每台设备（平板）的屏保配置覆盖落盘到 HA .storage/，
解决 HA 重启 / 浏览器清缓存 / 换 App 后配置丢失问题。
同时注册 panel_custom，在 HA 侧边栏生成「SnoozePanel」导航入口。
纯本地读写，无任何遥测 / 上报 / 外发请求。
"""

from __future__ import annotations

import logging

from homeassistant.components import panel_custom
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .storage import SnoozeStorage
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """初始化存储并注册 WS 命令与侧边栏面板（configuration.yaml 方式加载）。"""
    storage = SnoozeStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = storage
    async_register_websocket_commands(hass, storage)

    # 注册侧边栏导航入口：点击跳转至 SnoozePanel 配置页
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="snooze-panel-sidebar",
        frontend_url_path="snoozepanel",
        sidebar_title="SnoozePanel",
        sidebar_icon="mdi:sleep",
        module_url="/local/snoozepanel/snoozepanel.js",
        config={"mode": "config"},
    )

    _LOGGER.info("SnoozePanel 后端已就绪：设备级配置持久化到 .storage/%s，侧边栏入口已注册", DOMAIN)
    return True
