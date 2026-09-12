"""SnoozePanel 后端集成：设备级配置持久化。

提供 WebSocket API 把每台设备（平板）的屏保配置覆盖落盘到 HA .storage/，
解决 HA 重启 / 浏览器清缓存 / 换 App 后配置丢失问题。
纯本地读写，无任何遥测 / 上报 / 外发请求。
"""

from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .storage import SnoozeStorage
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """初始化存储并注册 WS 命令（configuration.yaml 方式加载）。"""
    storage = SnoozeStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = storage
    async_register_websocket_commands(hass, storage)
    _LOGGER.info("SnoozePanel 后端已就绪：设备级配置持久化到 .storage/%s", DOMAIN)
    return True
