import { builtinPlugins } from './builtin.js';
import { encodeSVGDatauri } from './svgo/tools.js';
import { invokePlugins } from './svgo/plugins.js';
import { querySelector, querySelectorAll } from './xast.js';
import { mapNodesToParents } from './util/map-nodes-to-parents.js';
import { parseSvg } from './parser.js';
import { stringifySvg } from './stringifier.js';
import { VERSION } from './version.js';
import * as _collections from '../plugins/_collections.js';

const pluginsMap = new Map();
for (const plugin of builtinPlugins) {
  pluginsMap.set(plugin.name, plugin);
}

/**
 * @param {string} name
 * @param {import('./types.js').PluginInfo['warn']} warn
 * @returns {import('./types.js').BuiltinPluginOrPreset<?, ?>}
 */
function getPlugin(name, warn) {
  if (name === 'removeScriptElement') {
    warn({
      code: 'deprecated-plugin-name',
      message:
        'Warning: removeScriptElement has been renamed to removeScripts, please update your SVGO config',
      plugin: 'removeScriptElement',
    });
    return pluginsMap.get('removeScripts');
  }

  return pluginsMap.get(name);
}

/**
 * @param {string | import('./types.js').PluginConfig} plugin
 * @param {import('./types.js').PluginInfo['warn']} warn
 * @returns {?import('./types.js').PluginConfig}
 */
const resolvePluginConfig = (plugin, warn) => {
  if (typeof plugin === 'string') {
    // resolve builtin plugin specified as string
    const builtinPlugin = getPlugin(plugin, warn);
    if (builtinPlugin == null) {
      throw Error(`Unknown builtin plugin "${plugin}" specified.`);
    }
    return {
      name: plugin,
      params: {},
      fn: builtinPlugin.fn,
    };
  }
  if (typeof plugin === 'object' && plugin != null) {
    if (plugin.name == null) {
      throw Error(`Plugin name must be specified`);
    }
    // use custom plugin implementation
    // @ts-expect-error Checking for CustomPlugin with the presence of fn
    let fn = plugin.fn;
    if (fn == null) {
      // resolve builtin plugin implementation
      const builtinPlugin = getPlugin(plugin.name, warn);
      if (builtinPlugin == null) {
        throw Error(`Unknown builtin plugin "${plugin.name}" specified.`);
      }
      fn = builtinPlugin.fn;
    }
    return {
      name: plugin.name,
      params: plugin.params,
      fn,
    };
  }
  return null;
};

export * from './types.js';

/**
 * The core of SVGO.
 *
 * @param {string} input
 * @param {import('./types.js').Config=} config
 * @returns {import('./types.js').Output}
 */
export const optimize = (input, config) => {
  if (config == null) {
    config = {};
  }
  if (typeof config !== 'object') {
    throw Error('Config should be an object');
  }
  const maxPassCount = config.multipass ? 10 : 1;
  let prevResultSize = Number.POSITIVE_INFINITY;
  let output = '';
  /** @type {import('./types.js').OptimizationWarning[]} */
  const warnings = [];
  const reportedWarnings = new Set();
  const { onWarning } = config;

  /** @type {import('./types.js').PluginInfo['warn']} */
  const reportWarning = (warning) => {
    /** @type {import('./types.js').OptimizationWarning} */
    const normalized = {
      code: warning.code,
      message: warning.message,
      level: warning.level ?? 'warn',
    };
    if (warning.plugin != null) {
      normalized.plugin = warning.plugin;
    }
    if (warning.preset != null) {
      normalized.preset = warning.preset;
    }
    // the same warning can be reported on every multipass iteration,
    // only keep and report the first occurrence
    const dedupeKey = JSON.stringify(normalized);
    if (reportedWarnings.has(dedupeKey)) {
      return;
    }
    reportedWarnings.add(dedupeKey);
    warnings.push(normalized);
    if (onWarning != null) {
      onWarning(normalized);
    } else if (normalized.level === 'error') {
      console.error(normalized.message);
    } else if (normalized.level === 'warn') {
      console.warn(normalized.message);
    }
  };

  /** @type {import('./types.js').PluginInfo} */
  const info = {
    multipassCount: 0,
    warn: reportWarning,
  };
  if (config.path != null) {
    info.path = config.path;
  }
  for (let i = 0; i < maxPassCount; i += 1) {
    info.multipassCount = i;
    const ast = parseSvg(input, config.path);
    const plugins = config.plugins || ['preset-default'];
    if (!Array.isArray(plugins)) {
      throw Error(
        'malformed config, `plugins` property must be an array.\nSee more info here: #configuration',
      );
    }
    const resolvedPlugins = plugins
      .filter((plugin) => plugin != null)
      .map((plugin) => resolvePluginConfig(plugin, reportWarning));

    if (resolvedPlugins.length < plugins.length) {
      reportWarning({
        code: 'null-plugin',
        message:
          'Warning: plugins list includes null or undefined elements, these will be ignored.',
      });
    }

    /** @type {import('./types.js').Config} */
    const globalOverrides = {};
    if (config.floatPrecision != null) {
      globalOverrides.floatPrecision = config.floatPrecision;
    }
    invokePlugins(ast, info, resolvedPlugins, null, globalOverrides);
    output = stringifySvg(ast, config.js2svg);
    if (output.length < prevResultSize) {
      input = output;
      prevResultSize = output.length;
    } else {
      break;
    }
  }
  if (config.datauri) {
    output = encodeSVGDatauri(output, config.datauri);
  }
  return {
    data: output,
    warnings,
  };
};

export {
  VERSION,
  builtinPlugins,
  mapNodesToParents,
  querySelector,
  querySelectorAll,
  _collections,
};
