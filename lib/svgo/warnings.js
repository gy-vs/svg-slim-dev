/**
 * @import {PluginInfo, Warning, WarningLevel} from '../types.js';
 */

/**
 * Plugin info as seen inside the plugins engine. The reporter is attached by
 * optimize for builtin plugins and presets and is not part of the public
 * PluginInfo type (where `warn` is provided per plugin invocation).
 *
 * @typedef {Omit<PluginInfo, 'warn'> & { reporter: WarningReporter }} InternalPluginInfo
 */

/**
 * Warnings reported by builtin plugins before they had a structured channel.
 * These keep using console.error in the legacy console output mode.
 *
 * @type {ReadonlySet<string>}
 */
const legacyConsoleErrorCodes = new Set([
  'ADD_ATTRIBUTES_TO_SVG_ELEMENT_NO_PARAMS',
  'ADD_CLASSES_TO_SVG_ELEMENT_NO_PARAMS',
  'MERGE_PATHS_FAILED',
]);

/**
 * Collects warnings emitted during a single optimize call, optionally forwards
 * them to an onWarning callback and otherwise prints them to the console the
 * same way previous SVGO versions did.
 */
export class WarningReporter {
  /** @type {Set<string>} */
  #seen = new Set();

  /**
   * @param {(warning: Warning) => void=} onWarning
   */
  constructor(onWarning) {
    /** @type {((warning: Warning) => void) | null} */
    this.onWarning = onWarning ?? null;
    /** @type {Warning[]} */
    this.warnings = [];
  }

  /**
   * Report a single warning. Emitted once per optimize call, even when
   * multipass runs the plugins several times.
   *
   * @param {{
   *   code: string,
   *   message: string,
   *   plugin: string,
   *   level?: WarningLevel,
   *   preset?: string,
   * }} warning
   */
  emit(warning) {
    /** @type {Warning} */
    const normalized = {
      code: warning.code,
      message: warning.message,
      plugin: warning.plugin,
      level: warning.level ?? 'warning',
      ...(warning.preset != null ? { preset: warning.preset } : {}),
    };
    const key = JSON.stringify(normalized);
    if (this.#seen.has(key)) {
      return;
    }
    this.#seen.add(key);
    this.warnings.push(normalized);
    if (this.onWarning != null) {
      this.onWarning(normalized);
    } else {
      const method =
        normalized.level === 'info'
          ? 'info'
          : legacyConsoleErrorCodes.has(normalized.code)
            ? 'error'
            : 'warn';
      console[method](normalized.message);
    }
  }
}
