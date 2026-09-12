"""SnoozePanel WebSocket 命令。

前端通过 hass.callWS({ type: 'snoozepanel/get_config', device_id }) 调用。
所有命令均为本地 .storage/ 读写，无任何外发请求。
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    DOMAIN,
    WS_TYPE_DELETE_CONFIG,
    WS_TYPE_GET_CONFIG,
    WS_TYPE_LIST_DEVICES,
    WS_TYPE_SET_CONFIG,
)
from .storage import SnoozeStorage


@callback
def async_register_websocket_commands(hass: HomeAssistant, storage: SnoozeStorage) -> None:
    """注册全部 WS 命令（storage 实例由 __init__ 存入 hass.data[DOMAIN]）。"""
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_list_devices)
    websocket_api.async_register_command(hass, ws_delete_config)


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
