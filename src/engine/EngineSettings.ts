/**
 * Settings of the verifier, remembered in the browser.
 *
 * The memory limit is the largest heap a verification may use: the engine
 * is a WebAssembly module whose memory grows on demand, and growing beyond
 * the limit fails, which stops the verifier cleanly.
 *
 * @author Roberto Metere
 * @license MIT
 */
class EngineSettings {
  /**
   * The memory limits offered in the settings, in MB: 0 is no limit, the
   * engine then grows as long as the browser gives it memory.
   *
   * @type {Array<number>}
   */
  static MEMORY_CHOICES: number[] = [64, 128, 256, 512, 1024, 2048, 3072, 0];

  /**
   * The folder of the engine (ProVerif or CryptoVerif for WebAssembly),
   * from the page. The
   * runners are told, because in the bundle of dist.sh their script is not
   * in that folder.
   *
   * @type {string}
   */
  static ENGINE_FOLDER = "engine/";

  maxMemoryMB: number;
  timeoutSeconds: number;
  extraArgs: string;
  liveChecks: boolean;

  /**
   * @param {Object} params Initial values, overriding the stored ones.
   */
  constructor(params: any = {}) {
    const defaults = {
        maxMemoryMB: 1024
      , timeoutSeconds: 300
      , extraArgs: ""
      , liveChecks: true
    };
    const values = {...defaults, ...EngineSettings.load(), ...params};
    const memory = Number(values.maxMemoryMB);
    this.maxMemoryMB = memory === 0 ? 0 : EngineSettings.clamp(memory || defaults.maxMemoryMB, 64, 4095);
    this.timeoutSeconds = Math.max(0, Number(values.timeoutSeconds) || 0);
    const args = typeof values.extraArgs === "string" ? values.extraArgs.trim() : "";
    this.extraArgs = args === "undefined" || args === "null" ? "" : args;
    this.liveChecks = values.liveChecks !== false;
  }

  /**
   * @param {number} value A number.
   * @param {number} min The smallest value.
   * @param {number} max The largest value.
   * @return {number} The value, within the bounds.
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  /**
   * @return {Object} The stored settings, or an empty object.
   */
  static load() {
    try {
      return JSON.parse(localStorage.getItem(StudioCore.storageKey("engine")) || "{}");
    } catch (e) {
      // TODO no handling?
      return {};
    }
  }

  /**
   * Remembers the settings in the browser, when storage is available.
   */
  save() {
    try {
      localStorage.setItem(StudioCore.storageKey("engine"), JSON.stringify({
          maxMemoryMB: this.maxMemoryMB
        , timeoutSeconds: this.timeoutSeconds
        , extraArgs: this.extraArgs
        , liveChecks: this.liveChecks
      }));
    } catch (e) {
      // TODO: now storage is assumed to be disabled, is that right?
    }
  }

  /**
   * @return {number} The memory limit of a run, in bytes, or 0 for none.
   */
  getMaxMemoryBytes(): number {
    return this.maxMemoryMB*1024*1024;
  }

  /**
   * @return {number} The time limit of a run, in seconds (0 for none).
   */
  getTimeoutSeconds(): number {
    return this.timeoutSeconds;
  }


  /**
   * @return {Array<string>} The extra command line arguments.
   */
  getArgs(): string[] {
    return this.extraArgs.split(/\s+/).filter(arg => arg !== "");
  }
}
// ----------------------------------------------------------------
