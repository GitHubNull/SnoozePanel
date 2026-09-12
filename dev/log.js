// @ts-check
/**
 * dev 实测台的日志 / Toast 反馈，以及按钮 loading 态工具。
 *
 * @typedef {import('./types.js').LogLevel} LogLevel
 */
import { LOG_LIMIT } from './constants.js';
import { el } from './state.js';

/**
 * 追加一条分级日志（自动滚动到底部；超上限丢弃最旧条目）。
 * @param {LogLevel} level
 * @param {string} message
 */
export function log(level, message) {
  const li = document.createElement('li');
  li.className = 'log-line ' + level;
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const msg = document.createElement('span');
  msg.className = 'msg';
  msg.textContent = message;
  li.append(time, msg);
  el.logList.appendChild(li);
  if (el.logList.children.length > LOG_LIMIT) {
    const first = el.logList.firstElementChild;
    if (first) first.remove();
  }
  el.logList.scrollTop = el.logList.scrollHeight;
}

/**
 * 右上角轻提示（点击立即关闭；3.6s 自动消失）。
 * @param {'success' | 'error' | 'warning'} kind
 * @param {string} title
 * @param {string} [detail]
 */
export function toast(kind, title, detail) {
  const box = document.createElement('div');
  box.className = 'toast ' + kind;
  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  box.appendChild(titleEl);
  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'toast-detail';
    detailEl.textContent = detail;
    box.appendChild(detailEl);
  }
  box.addEventListener('click', () => box.remove());
  el.toastStack.appendChild(box);
  window.setTimeout(() => {
    box.classList.add('leave');
    window.setTimeout(() => box.remove(), 240);
  }, 3600);
}

/**
 * 切换按钮 loading 态（禁用 + 旋转指示）。
 * @param {HTMLButtonElement} btn
 * @param {boolean} busy
 */
export function setBusy(btn, busy) {
  if (busy) {
    btn.dataset.busy = '1';
    btn.disabled = true;
  } else {
    delete btn.dataset.busy;
    btn.disabled = false;
  }
}
