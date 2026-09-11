/**
 * 1 秒时钟 tick。后台标签页自动暂停（visibilitychange），恢复时立即补一次。
 */

export type TickCallback = (now: Date) => void;

export class Ticker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly cb: TickCallback;
  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  constructor(cb: TickCallback) {
    this.cb = cb;
  }

  start(): void {
    this.stop();
    if (typeof document !== 'undefined' && document.hidden) return;
    this.cb(new Date()); // 立即触发一次，避免首帧空白
    this.timer = setInterval(() => this.cb(new Date()), 1000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 绑定标签页可见性监听 */
  watchVisibility(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** 彻底销毁：停表 + 解绑监听 */
  destroy(): void {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }
}
