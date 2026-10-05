import { jest } from '@jest/globals';
import { optimize } from './svgo.js';

const svg = `<svg viewBox="0 0 120 120"></svg>`;

describe('structured warnings', () => {
  /** @type {jest.SpiedFunction<typeof console.warn>} */
  let warn;
  /** @type {jest.SpiedFunction<typeof console.error>} */
  let error;
  /** @type {jest.SpiedFunction<typeof console.info>} */
  let info;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
    info.mockRestore();
  });

  test('collects warnings in the result without a callback', () => {
    const { warnings } = optimize(svg, {
      plugins: [
        // @ts-expect-error Testing the deprecated plugin name.
        'removeScriptElement',
      ],
    });
    expect(warnings).toStrictEqual([
      {
        code: 'PLUGIN_RENAMED',
        message:
          'Warning: removeScriptElement has been renamed to removeScripts, please update your SVGO config',
        plugin: 'removeScriptElement',
        level: 'warning',
      },
    ]);
  });

  test('returns an empty warnings array when nothing is reported', () => {
    const { warnings } = optimize(svg, {
      plugins: ['removeDoctype'],
    });
    expect(warnings).toStrictEqual([]);
  });

  test('calls onWarning once for each warning', () => {
    /** @type {import('./types.js').Warning[]} */
    const received = [];
    const { warnings } = optimize(svg, {
      plugins: [
        // @ts-expect-error Testing the deprecated plugin name.
        'removeScriptElement',
        // @ts-expect-error Testing null entries in the plugins list.
        null,
      ],
      onWarning: (warning) => received.push(warning),
    });
    expect(received).toStrictEqual([
      {
        code: 'PLUGIN_RENAMED',
        message:
          'Warning: removeScriptElement has been renamed to removeScripts, please update your SVGO config',
        plugin: 'removeScriptElement',
        level: 'warning',
      },
      {
        code: 'NULL_PLUGIN',
        message:
          'Warning: plugins list includes null or undefined elements, these will be ignored.',
        plugin: '',
        level: 'warning',
      },
    ]);
    expect(received).toStrictEqual(warnings);
  });

  test('does not print to the console when onWarning is provided', () => {
    optimize(svg, {
      plugins: [
        // @ts-expect-error Testing the deprecated plugin name.
        'removeScriptElement',
        { name: 'addAttributesToSVGElement', params: {} },
      ],
      onWarning: () => {},
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  test('keeps the legacy console output without a callback', () => {
    optimize(svg, {
      plugins: [
        // @ts-expect-error Testing the deprecated plugin name.
        'removeScriptElement',
      ],
    });
    optimize(svg, {
      plugins: [{ name: 'addAttributesToSVGElement', params: {} }],
    });
    expect(warn).toHaveBeenCalledWith(
      'Warning: removeScriptElement has been renamed to removeScripts, please update your SVGO config',
    );
    expect(error.mock.calls[0][0])
      .toBe(`Error in plugin "addAttributesToSVGElement": absent parameters.
It should have a list of "attributes" or one "attribute".
Config example:

plugins: [
  {
    name: 'addAttributesToSVGElement',
    params: {
      attribute: "mySvg"
    }
  }
]

plugins: [
  {
    name: 'addAttributesToSVGElement',
    params: {
      attributes: ["mySvg", "size-big"]
    }
  }
]

plugins: [
  {
    name: 'addAttributesToSVGElement',
    params: {
      attributes: [
        {
          focusable: false
        },
        {
          'data-image': icon
        }
      ]
    }
  }
]
`);
  });

  test('reports null entries in the plugins list', () => {
    const { warnings } = optimize(svg, {
      // @ts-expect-error Testing null entries in the plugins list.
      plugins: [null, 'removeDoctype'],
      onWarning: () => {},
    });
    expect(warnings).toStrictEqual([
      {
        code: 'NULL_PLUGIN',
        message:
          'Warning: plugins list includes null or undefined elements, these will be ignored.',
        plugin: '',
        level: 'warning',
      },
    ]);
  });

  test('reports unknown plugins configured in preset overrides with the preset name', () => {
    const { warnings } = optimize(svg, {
      plugins: [
        // @ts-expect-error Testing a plugin name which is not in the preset.
        {
          name: 'preset-default',
          params: { overrides: { cleanupListOfValues: true } },
        },
      ],
      onWarning: () => {},
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: 'PLUGIN_NOT_IN_PRESET',
      plugin: 'cleanupListOfValues',
      preset: 'preset-default',
      level: 'warning',
    });
    expect(warnings[0].message).toContain(
      'You are trying to configure cleanupListOfValues which is not part of preset-default.',
    );
  });

  test('reports missing addAttributesToSVGElement parameters', () => {
    const { warnings } = optimize(svg, {
      plugins: [{ name: 'addAttributesToSVGElement', params: {} }],
      onWarning: () => {},
    });
    expect(warnings).toStrictEqual([
      {
        code: 'ADD_ATTRIBUTES_TO_SVG_ELEMENT_NO_PARAMS',
        message: expect.stringContaining(
          'Error in plugin "addAttributesToSVGElement": absent parameters.',
        ),
        plugin: 'addAttributesToSVGElement',
        level: 'warning',
      },
    ]);
  });

  test('reports missing addClassesToSVGElement parameters', () => {
    const { warnings } = optimize(svg, {
      plugins: [{ name: 'addClassesToSVGElement', params: {} }],
      onWarning: () => {},
    });
    expect(warnings).toStrictEqual([
      {
        code: 'ADD_CLASSES_TO_SVG_ELEMENT_NO_PARAMS',
        message: expect.stringContaining(
          'Error in plugin "addClassesToSVGElement": absent parameters.',
        ),
        plugin: 'addClassesToSVGElement',
        level: 'warning',
      },
    ]);
  });

  test('reports missing removeAttrs parameters', () => {
    const { warnings } = optimize(svg, {
      plugins: [
        // @ts-expect-error Testing missing required params.
        { name: 'removeAttrs', params: {} },
      ],
      onWarning: () => {},
    });
    expect(warnings).toStrictEqual([
      {
        code: 'REMOVE_ATTRS_NO_ATTRS',
        message: expect.stringContaining(
          'Warning: The plugin "removeAttrs" requires the "attrs" parameter.',
        ),
        plugin: 'removeAttrs',
        level: 'warning',
      },
    ]);
  });

  test('reports an info level notice when cleanupIds skips a styled document', () => {
    const { data, warnings } = optimize(
      `<svg><style>.a { fill: red }</style><rect id="keep-me"/></svg>`,
      {
        plugins: ['cleanupIds'],
        onWarning: () => {},
      },
    );
    expect(warnings).toStrictEqual([
      {
        code: 'CLEANUP_IDS_SKIPPED',
        message: expect.stringContaining('cleanupIds'),
        plugin: 'cleanupIds',
        level: 'info',
      },
    ]);
    // the ID is left untouched
    expect(data).toContain('id="keep-me"');
  });

  test('cleanupIds does not report the notice with force enabled', () => {
    const { warnings } = optimize(
      `<svg><style>.a { fill: red }</style><rect id="keep-me"/></svg>`,
      {
        plugins: [{ name: 'cleanupIds', params: { force: true } }],
        onWarning: () => {},
      },
    );
    expect(warnings).toStrictEqual([]);
  });

  test('cleanupIds notice inside a preset carries the preset name', () => {
    const { warnings } = optimize(
      `<svg><style>.a { fill: red }</style><rect id="keep-me"/></svg>`,
      {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                mergeStyles: false,
                inlineStyles: false,
                minifyStyles: false,
              },
            },
          },
        ],
        onWarning: () => {},
      },
    );
    const cleanupIdsWarning = warnings.find(
      (warning) => warning.code === 'CLEANUP_IDS_SKIPPED',
    );
    expect(cleanupIdsWarning).toMatchObject({
      plugin: 'cleanupIds',
      preset: 'preset-default',
      level: 'info',
    });
  });

  test('prints info notices through console.info without a callback', () => {
    const { warnings } = optimize(
      `<svg><style>.a { fill: red }</style><rect id="keep-me"/></svg>`,
      { plugins: ['cleanupIds'] },
    );
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(warnings[0].message);
  });

  test('de-duplicates warnings across multipass runs', () => {
    /** @type {import('./types.js').Warning[]} */
    const received = [];
    const { data, warnings } = optimize(
      `<svg id="abcdefghijklmnopqrstuvwxyz"></svg>`,
      {
        multipass: true,
        plugins: [
          {
            name: 'repeatedWarning',
            fn: (_root, _params, pluginInfo) => {
              pluginInfo.warn({
                code: 'REPEATED',
                message: 'reported every pass',
              });
              return {
                element: {
                  enter: (node) => {
                    node.attributes.id = node.attributes.id.slice(1);
                  },
                },
              };
            },
          },
        ],
        onWarning: (warning) => received.push(warning),
      },
    );
    expect(received).toStrictEqual([
      {
        code: 'REPEATED',
        message: 'reported every pass',
        plugin: 'repeatedWarning',
        level: 'warning',
      },
    ]);
    expect(warnings).toStrictEqual(received);
    expect(data).toBe(`<svg id="klmnopqrstuvwxyz"/>`);
  });

  test('de-duplicates a repeated warning while keeping distinct ones', () => {
    const { warnings } = optimize(`<svg id="abcdefghij"></svg>`, {
      multipass: true,
      plugins: [
        {
          name: 'distinctWarnings',
          fn: (_root, _params, pluginInfo) => {
            // identical every pass -> kept once
            pluginInfo.warn({ code: 'SAME', message: 'same' });
            // distinct every pass -> all kept
            pluginInfo.warn({
              code: 'PER_PASS',
              message: `pass ${pluginInfo.multipassCount}`,
            });
            return {
              element: {
                enter: (node) => {
                  if (node.attributes.id != null) {
                    node.attributes.id = node.attributes.id.slice(1);
                  }
                },
              },
            };
          },
        },
      ],
      onWarning: () => {},
    });
    const sameWarnings = warnings.filter((warning) => warning.code === 'SAME');
    expect(sameWarnings).toStrictEqual([
      {
        code: 'SAME',
        message: 'same',
        plugin: 'distinctWarnings',
        level: 'warning',
      },
    ]);
    const perPassMessages = warnings
      .filter((warning) => warning.code === 'PER_PASS')
      .map((warning) => warning.message);
    expect(perPassMessages).toStrictEqual([
      'pass 0',
      'pass 1',
      'pass 2',
      'pass 3',
      'pass 4',
      'pass 5',
      'pass 6',
      'pass 7',
      'pass 8',
      'pass 9',
    ]);
  });

  test('allows custom plugins to report through info.warn', () => {
    /** @type {import('./types.js').Warning[]} */
    const received = [];
    optimize(svg, {
      plugins: [
        {
          name: 'myCustomPlugin',
          fn: (_root, _params, pluginInfo) => {
            pluginInfo.warn({ code: 'MY_CODE', message: 'my message' });
            pluginInfo.warn({
              code: 'MY_INFO',
              message: 'my notice',
              level: 'info',
            });
            return null;
          },
        },
      ],
      onWarning: (warning) => received.push(warning),
    });
    expect(received).toStrictEqual([
      {
        code: 'MY_CODE',
        message: 'my message',
        plugin: 'myCustomPlugin',
        level: 'warning',
      },
      {
        code: 'MY_INFO',
        message: 'my notice',
        plugin: 'myCustomPlugin',
        level: 'info',
      },
    ]);
  });
});
