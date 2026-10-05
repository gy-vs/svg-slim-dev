import {
  expectType,
  expectAssignable,
  expectError,
  expectNotAssignable,
} from 'tsd';
import {
  BuiltinPlugin,
  type Config,
  type DataUri,
  type Output,
  type Warning,
  type WarningLevel,
  builtinPlugins,
  loadConfig,
  optimize,
} from '../../types/lib/svgo-node.js';

expectType<Output>(optimize('<svg></svg>'));
expectAssignable<DataUri>('enc');

expectType<Promise<Config | null>>(loadConfig());
expectType<Promise<Config | null>>(loadConfig(undefined));
expectType<Promise<Config | null>>(loadConfig(null));
expectType<Promise<Config>>(loadConfig('svgo.config.js'));

// warnings are part of the result
const result = optimize('<svg></svg>', {
  onWarning: (warning) => {
    expectType<Warning>(warning);
    expectType<string>(warning.code);
    expectType<string>(warning.message);
    expectType<string>(warning.plugin);
    expectType<WarningLevel>(warning.level);
    expectType<string | undefined>(warning.preset);
  },
});
expectType<Warning[]>(result.warnings);

// onWarning accepts undefined and a callback
expectAssignable<Config>({ onWarning: undefined });
expectAssignable<Config>({ onWarning: () => {} });
expectNotAssignable<Config>({ onWarning: 'not a function' });

// custom plugins can report through info.warn
optimize('<svg></svg>', {
  plugins: [
    {
      name: 'custom',
      fn: (root, params, info) => {
        info.warn({ code: 'CUSTOM', message: 'something happened' });
        info.warn({
          code: 'CUSTOM_INFO',
          message: 'a notice',
          level: 'info',
        });
        // code and message are required
        expectError(info.warn({ message: 'missing code' }));
        // arbitrary levels are not allowed
        expectError(info.warn({ code: 'X', message: 'x', level: 'error' }));
        return null;
      },
    },
  ],
});

const presetDefault = builtinPlugins.find(
  (plugin) => plugin.name === 'preset-default',
)!;
if (!presetDefault.isPreset) {
  throw Error('Could not find preset-default.');
}

expectType<ReadonlyArray<BuiltinPlugin<string, Object>>>(presetDefault.plugins);
expectType<'preset-default'>(presetDefault.name);
