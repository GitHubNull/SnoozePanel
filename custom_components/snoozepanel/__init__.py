"""SnoozePanel 后端集成：设备级配置持久化 + 侧边栏导航入口。

提供 WebSocket API 把每台设备（平板）的屏保配置覆盖落盘到 HA .storage/，
解决 HA 重启 / 浏览器清缓存 / 换 App 后配置丢失问题。
同时注册 panel_custom，在 HA 侧边栏生成「SnoozePanel」导航入口。
纯本地读写，无任何遥测 / 上报 / 外发请求。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .storage import SnoozeStorage
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)


def _frontend_version() -> str:
    """读取本集成 manifest.json 的 version，作为前端产物缓存破除串（单一版本源）。"""
    try:
        manifest = json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))
        return str(manifest.get("version", "0"))
    except (OSError, ValueError):  # pragma: no cover - 保底，不应发生
        return "0"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """初始化存储并注册 WS 命令与侧边栏面板（configuration.yaml 方式加载）。"""
    storage = SnoozeStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = storage
    async_register_websocket_commands(hass, storage)

    # 注册侧边栏导航入口：点击跳转至 SnoozePanel 配置页
    # sidebar_icon 使用前端注册的自定义图标集（snoozepanel:logo，见 src/runtime/iconset.ts）；
    # 若目标 HA 未加载自定义图标集，可回退为原生 mdi 图标，如 sidebar_icon="mdi:power-sleep"。
    # module_url 附带版本查询串：/local 静态产物 cache-control 为 max-age 31 天，
    # 无查询串时发版后浏览器会长时间命中旧缓存；版本随 manifest 变化自动破除。
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="snooze-panel-sidebar",
        frontend_url_path="snoozepanel",
        sidebar_title="SnoozePanel",
        sidebar_icon="snoozepanel:logo",
        module_url=f"/local/snoozepanel/snoozepanel.js?v={_frontend_version()}",
        config={"mode": "config"},
    )

    _LOGGER.info("SnoozePanel 后端已就绪：设备级配置持久化到 .storage/%s，侧边栏入口已注册", DOMAIN)
    return True
