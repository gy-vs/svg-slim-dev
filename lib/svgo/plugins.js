import { visit } from '../util/visit.js';

/**
 * Plugins engine.
 *
 * @module plugins
 *
 * @param {import('../types.js').XastNode} ast Input AST.
 * @param {import('./warnings.js').InternalPluginInfo} info Extra information.
 * @param {ReadonlyArray<any>} plugins Plugins property from config.
 * @param {any} overrides
 * @param {any} globalOverrides
 * @param {import('./warnings.js').WarningReporter} reporter
 * @param {string=} presetName Name of the preset invoking the plugins, if any.
 */
export const invokePlugins = (
  ast,
  info,
  plugins,
  overrides,
  globalOverrides,
  reporter,
  presetName,
) => {
  for (const plugin of plugins) {
    const override = overrides?.[plugin.name];
    if (override === false) {
      continue;
    }
    const params = { ...plugin.params, ...globalOverrides, ...override };

    /** @type {import('../types.js').PluginInfo} */
    const pluginInfo = {
      ...info,
      warn: (warning) => {
        reporter.emit({
          ...warning,
          plugin: plugin.name,
          ...(presetName != null ? { preset: presetName } : {}),
        });
      },
    };
    const visitor = plugin.fn(ast, params, pluginInfo);
    if (visitor != null) {
      visit(ast, visitor);
    }
  }
};

/**
 * @template {`preset-${string}`} T
 * @param {{ name: T, plugins: ReadonlyArray<import('../types.js').BuiltinPlugin<string, any>> }} arg0
 * @returns {import('../types.js').BuiltinPluginOrPreset<T, any>}
 */
export const createPreset = ({ name, plugins }) => {
  return {
    name,
    isPreset: true,
    plugins: Object.freeze(plugins),
    fn: (ast, params, info) => {
      const { floatPrecision, overrides } = params;
      const globalOverrides = {};
      if (floatPrecision != null) {
        globalOverrides.floatPrecision = floatPrecision;
      }
      const internalInfo =
        /** @type {import('./warnings.js').InternalPluginInfo} */
        (/** @type {unknown} */ (info));
      const { reporter } = internalInfo;
      if (overrides) {
        const pluginNames = plugins.map(({ name }) => name);
        for (const pluginName of Object.keys(overrides)) {
          if (!pluginNames.includes(pluginName)) {
            reporter.emit({
              code: 'PLUGIN_NOT_IN_PRESET',
              plugin: pluginName,
              preset: name,
              message:
                `You are trying to configure ${pluginName} which is not part of ${name}.\n` +
                `Try to put it before or after, for example\n\n` +
                `plugins: [\n` +
                `  {\n` +
                `    name: '${name}',\n` +
                `  },\n` +
                `  '${pluginName}'\n` +
                `]\n`,
            });
          }
        }
      }
      invokePlugins(
        ast,
        internalInfo,
        plugins,
        overrides,
        globalOverrides,
        reporter,
        name,
      );
    },
  };
};
