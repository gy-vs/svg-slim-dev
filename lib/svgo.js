import { builtinPlugins } from './builtin.js';
import { encodeSVGDatauri } from './svgo/tools.js';
import { invokePlugins } from './svgo/plugins.js';
import { WarningReporter } from './svgo/warnings.js';
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
 * @param {WarningReporter} reporter
 * @returns {import('./types.js').BuiltinPluginOrPreset<?, ?>}
 */
function getPlugin(name, reporter) {
  if (name === 'removeScriptElement') {
    reporter.emit({
      code: 'PLUGIN_RENAMED',
      plugin: name,
      message:
        'Warning: removeScriptElement has been renamed to removeScripts, please update your SVGO config',
    });
    return pluginsMap.get('removeScripts');
  }

  return pluginsMap.get(name);
}

/**
 * @param {string | import('./types.js').PluginConfig} plugin
 * @param {WarningReporter} reporter
 * @returns {?import('./types.js').PluginConfig}
 */
const resolvePluginConfig = (plugin, reporter) => {
  if (typeof plugin === 'string') {
    // resolve builtin plugin specified as string
    const builtinPlugin = getPlugin(plugin, reporter);
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
      const builtinPlugin = getPlugin(plugin.name, reporter);
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
  const reporter = new WarningReporter(config.onWarning);
  const maxPassCount = config.multipass ? 10 : 1;
  let prevResultSize = Number.POSITIVE_INFINITY;
  let output = '';
  /** @type {Omit<import('./types.js').PluginInfo, 'warn'>} */
  const info = { multipassCount: 0 };
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
      .map((plugin) => resolvePluginConfig(plugin, reporter));

    if (resolvedPlugins.length < plugins.length) {
      reporter.emit({
        code: 'NULL_PLUGIN',
        plugin: '',
        message:
          'Warning: plugins list includes null or undefined elements, these will be ignored.',
      });
    }

    /** @type {import('./types.js').Config} */
    const globalOverrides = {};
    if (config.floatPrecision != null) {
      globalOverrides.floatPrecision = config.floatPrecision;
    }
    invokePlugins(
      ast,
      { ...info, reporter },
      resolvedPlugins,
      null,
      globalOverrides,
      reporter,
    );
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
    warnings: reporter.warnings,
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
