"""SnoozePanel WebSocket 命令。

前端通过 hass.callWS({ type: 'snoozepanel/get_config', device_id }) 调用。
所有命令均为本地 .storage/ 读写，无任何外发请求。
"""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    DOMAIN,
    MAX_JS_BYTES,
    PLUGIN_ID_PATTERN,
    WS_TYPE_DELETE_CONFIG,
    WS_TYPE_GET_CONFIG,
    WS_TYPE_INSTALL_PLUGIN,
    WS_TYPE_LIST_DEVICES,
    WS_TYPE_LIST_PLUGINS,
    WS_TYPE_SET_CONFIG,
    WS_TYPE_SET_PLUGIN_ENABLED,
    WS_TYPE_UNINSTALL_PLUGIN,
)
from .storage import PluginValidationError, SnoozeStorage

_ID_RE = re.compile(PLUGIN_ID_PATTERN)

# 插件安装记录 schema：服务端强制校验（类型 / 长度 / id 正则），
# 业务级大小/内容/数量限额再由 storage.validate_plugin_record 兜底。
_PLUGIN_RECORD_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=64), vol.Match(_ID_RE)),
        vol.Required("kind"): vol.In(["face", "widget"]),
        vol.Required("channel"): vol.In(["dir", "upload"]),
        vol.Required("entry"): vol.All(str, vol.Length(min=1, max=128)),
        vol.Optional("enabled", default=True): bool,
        vol.Optional("manifest", default=dict): dict,
        vol.Optional("code"): vol.All(str, vol.Length(max=MAX_JS_BYTES)),
        vol.Optional("installed_at"): vol.Coerce(int),
    }
)


@callback
def async_register_websocket_commands(hass: HomeAssistant, storage: SnoozeStorage) -> None:
    """注册全部 WS 命令（storage 实例由 __init__ 存入 hass.data[DOMAIN]）。"""
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_list_devices)
    websocket_api.async_register_command(hass, ws_delete_config)
    websocket_api.async_register_command(hass, ws_list_plugins)
    websocket_api.async_register_command(hass, ws_install_plugin)
    websocket_api.async_register_command(hass, ws_uninstall_plugin)
    websocket_api.async_register_command(hass, ws_set_plugin_enabled)


def _storage(hass: HomeAssistant) -> SnoozeStorage:
    return hass.data[DOMAIN]


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_GET_CONFIG,
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_get_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """读取某设备的配置覆盖。"""
    config = _storage(hass).get_config(msg["device_id"])
    connection.send_result(msg["id"], {"config": config})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_SET_CONFIG,
        vol.Required("device_id"): str,
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def ws_set_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """写入某设备的配置覆盖并落盘。"""
    await _storage(hass).async_set_config(msg["device_id"], msg["config"])
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command({vol.Required("type"): WS_TYPE_LIST_DEVICES})
@websocket_api.async_response
async def ws_list_devices(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """列出所有已存设备 id。"""
    connection.send_result(msg["id"], {"devices": _storage(hass).list_devices()})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DELETE_CONFIG,
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """删除某设备配置。"""
    deleted = await _storage(hass).async_delete_config(msg["device_id"])
    connection.send_result(msg["id"], {"success": deleted})


@websocket_api.websocket_command({vol.Required("type"): WS_TYPE_LIST_PLUGINS})
@websocket_api.async_response
async def ws_list_plugins(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """列出全部插件安装记录。"""
    connection.send_result(msg["id"], {"plugins": _storage(hass).list_plugins()})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_INSTALL_PLUGIN,
        vol.Required("record"): _PLUGIN_RECORD_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_install_plugin(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """安装（或覆盖）一条插件记录；服务端强制校验限额，超限拒绝。"""
    try:
        await _storage(hass).async_install_plugin(dict(msg["record"]))
    except PluginValidationError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_UNINSTALL_PLUGIN,
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=64), vol.Match(_ID_RE)),
    }
)
@websocket_api.async_response
async def ws_uninstall_plugin(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """卸载指定插件。"""
    deleted = await _storage(hass).async_uninstall_plugin(msg["id"])
    connection.send_result(msg["id"], {"success": deleted})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_SET_PLUGIN_ENABLED,
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=64), vol.Match(_ID_RE)),
        vol.Required("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_set_plugin_enabled(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """启用 / 禁用指定插件。"""
    ok = await _storage(hass).async_set_plugin_enabled(msg["id"], msg["enabled"])
    connection.send_result(msg["id"], {"success": ok})
