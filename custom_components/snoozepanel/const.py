"""SnoozePanel 常量定义。"""

DOMAIN = "snoozepanel"

# 设备级配置存储：HA .storage/snoozepanel
STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

# WebSocket 命令类型
WS_TYPE_GET_CONFIG = "snoozepanel/get_config"
WS_TYPE_SET_CONFIG = "snoozepanel/set_config"
WS_TYPE_LIST_DEVICES = "snoozepanel/list_devices"
WS_TYPE_DELETE_CONFIG = "snoozepanel/delete_config"
