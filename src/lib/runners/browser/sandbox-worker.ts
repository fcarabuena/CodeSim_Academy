/**
 * Runs a worker script inside a hidden sandboxed iframe.
 *
 *   page ──postMessage──▶ iframe (sandbox="allow-scripts", opaque origin) ──▶ Web Worker
 *
 * The opaque origin means student code can't read the app's cookies or call
 * its API, and because the code runs in a worker, an infinite loop can't
 * freeze the page: on timeout we delete the iframe, which kills the worker.
 * The runtime (e.g. Pyodide) is kept warm between runs until that happens.
 */

const BOOTSTRAP = `<!doctype html><meta charset="utf-8"><script>
let worker;
addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const d = e.data;
  if (d && d.__init) {
    try {
      worker = new Worker(URL.createObjectURL(new Blob([d.source], { type: "text/javascript" })));
      worker.onmessage = (m) => parent.postMessage(m.data, "*");
      worker.onerror = (err) => { err.preventDefault(); parent.postMessage({ __loadError: err.message || "The code runner failed to start." }, "*"); };
    } catch (err) {
      parent.postMessage({ __loadError: "Your browser blocked the code runner: " + err }, "*");
    }
    return;
  }
  if (worker) worker.postMessage(d);
});
</script>`;

export class TimeoutError extends Error {}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class SandboxWorker {
  private frame?: HTMLIFrameElement;
  private loaded?: Promise<void>;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private listener?: (e: MessageEvent) => void;
  private sourceCache?: Promise<string>;

  constructor(
    private readonly workerUrl: string,
    /** How long to wait for the runtime to download and start. */
    private readonly loadTimeoutMs = 90_000,
  ) {}

  /** True once the runtime has loaded (so the next run starts instantly). */
  isLoaded = false;

  private source(): Promise<string> {
    this.sourceCache ??= fetch(this.workerUrl).then((r) => {
      if (!r.ok) throw new Error(`Couldn't download the code runner (${r.status}).`);
      return r.text();
    });
    this.sourceCache.catch(() => (this.sourceCache = undefined));
    return this.sourceCache;
  }

  private start(): Promise<void> {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-10px;top:-10px;";
    frame.srcdoc = BOOTSTRAP;
    this.frame = frame;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.kill();
        reject(new Error("The code runner took too long to load. Check your internet connection and try again."));
      }, this.loadTimeoutMs);

      this.listener = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
        const d = e.data as { id?: number; __loaded?: boolean; __loadError?: string };
        if (d.__loaded) {
          clearTimeout(timer);
          this.isLoaded = true;
          resolve();
        } else if (d.__loadError) {
          clearTimeout(timer);
          this.kill();
          reject(new Error(d.__loadError));
        } else if (typeof d.id === "number") {
          const p = this.pending.get(d.id);
          this.pending.delete(d.id);
          p?.resolve(d);
        }
      };
      window.addEventListener("message", this.listener);

      frame.addEventListener("load", async () => {
        try {
          frame.contentWindow?.postMessage({ __init: true, source: await this.source() }, "*");
        } catch (err) {
          clearTimeout(timer);
          this.kill();
          reject(err as Error);
        }
      }, { once: true });
      document.body.append(frame);
    });
  }

  /** Download and start the runtime ahead of time (e.g. when a Python lesson opens). */
  warmUp(): Promise<void> {
    this.loaded ??= this.start();
    this.loaded.catch(() => (this.loaded = undefined));
    return this.loaded;
  }

  /**
   * Send one job. Waits for the runtime to load first (not counted towards
   * the time limit), then rejects with TimeoutError if the job takes longer
   * than `timeoutMs`, killing the worker.
   */
  async call<T>(message: Record<string, unknown>, timeoutMs: number): Promise<T> {
    await this.warmUp();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.kill();
        reject(new TimeoutError());
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.frame?.contentWindow?.postMessage({ ...message, id }, "*");
    });
  }

  /** Stop everything. The next call starts a fresh runtime. */
  kill() {
    if (this.listener) window.removeEventListener("message", this.listener);
    this.frame?.remove();
    this.frame = undefined;
    this.loaded = undefined;
    this.isLoaded = false;
    for (const p of this.pending.values()) p.reject(new Error("The code runner was stopped."));
    this.pending.clear();
  }
}
