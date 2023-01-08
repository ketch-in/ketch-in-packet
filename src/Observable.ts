export default class Observable<T> {
  private events: { [type: string]: T[keyof T][] };
  private isDestroy: boolean;
  private idObservable: string;

  constructor() {
    this.isDestroy = false;
    this.events = {};
    this.idObservable = Math.random().toPrecision(1);
  }

  log(...args: any[]) {
    console.log(`[${this.idObservable}] > `, ...args);
  }

  protected emit<K extends keyof T>(type: K, ...args: any[]) {
    this.log(this.isDestroy);
    if (typeof type !== "string" || !this.events[type] || this.isDestroy) {
      return;
    }
    this.events[type].forEach((func) => {
      if (typeof func === "function") {
        func(this, ...args);
      }
    });
  }

  protected getDestroy() {
    return this.isDestroy;
  }

  destroy() {
    this.log("destroy", this.isDestroy);
    const keys = Object.keys(this.events);
    keys.forEach((key) => {
      delete this.events[key];
    });
    this.isDestroy = true;
  }

  addEventListener<K extends keyof T>(type: K, listener: T[K]) {
    if (typeof type !== "string" || this.isDestroy) {
      return;
    }
    if (!this.events[type]) {
      this.events[type] = [];
    }
    if (this.events[type].includes(listener)) {
      return;
    }
    this.events[type].push(listener);
  }

  removeEventListener<K extends keyof T>(type: K, listener: T[K]) {
    if (
      typeof type !== "string" ||
      !this.events[type] ||
      !this.events[type].includes(listener)
    ) {
      return;
    }

    this.events[type] = this.events[type].filter((func) => func !== listener);
    if (this.events[type].length === 0) {
      delete this.events[type];
    }
  }
}
