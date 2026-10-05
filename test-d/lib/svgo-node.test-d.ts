import { expectType, expectAssignable } from 'tsd';
import {
  BuiltinPlugin,
  type Config,
  type DataUri,
  type OptimizationWarning,
  type Output,
  type PluginInfo,
  type WarningLevel,
  builtinPlugins,
  loadConfig,
  optimize,
} from '../../types/lib/svgo-node.js';

expectType<Output>(optimize('<svg></svg>'));
expectType<OptimizationWarning[]>(optimize('<svg></svg>').warnings);
expectAssignable<DataUri>('enc');

optimize('<svg></svg>', {
  onWarning: (warning) => {
    expectType<OptimizationWarning>(warning);
    expectType<string>(warning.code);
    expectType<string>(warning.message);
    expectType<WarningLevel>(warning.level);
    expectType<string | undefined>(warning.plugin);
    expectType<string | undefined>(warning.preset);
  },
});

expectAssignable<WarningLevel>('error');
expectAssignable<WarningLevel>('warn');
expectAssignable<WarningLevel>('info');

const pluginInfo = {} as PluginInfo;
pluginInfo.warn({ code: 'custom-warning', message: 'Something to report' });
pluginInfo.warn({
  code: 'custom-warning',
  message: 'Something to report',
  level: 'info',
});

expectType<Promise<Config | null>>(loadConfig());
expectType<Promise<Config | null>>(loadConfig(undefined));
expectType<Promise<Config | null>>(loadConfig(null));
expectType<Promise<Config>>(loadConfig('svgo.config.js'));

const presetDefault = builtinPlugins.find(
  (plugin) => plugin.name === 'preset-default',
)!;
if (!presetDefault.isPreset) {
  throw Error('Could not find preset-default.');
}

expectType<ReadonlyArray<BuiltinPlugin<string, Object>>>(presetDefault.plugins);
expectType<'preset-default'>(presetDefault.name);
