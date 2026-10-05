import { jest } from '@jest/globals';
import { parsePathData, stringifyPathData } from '../../lib/path.js';

/** @type {jest.Mock<(path1: any, path2: any, onFailure?: () => void) => boolean>} */
const intersectsMock = jest.fn();

jest.unstable_mockModule('../../plugins/_path.js', () => ({
  // path2js and js2path are needed to convert path data
  path2js: (/** @type {any} */ path) => parsePathData(path.attributes.d),
  js2path: (/** @type {any} */ path, /** @type {any} */ data) => {
    path.attributes.d = stringifyPathData({ pathData: data });
  },
  intersects: (
    /** @type {any} */ path1,
    /** @type {any} */ path2,
    /** @type {(() => void) | undefined} */ onFailure,
  ) => intersectsMock(path1, path2, onFailure),
}));

const { optimize } = await import('../../lib/svgo.js');

const svg = `<svg><path d="M0,0L10,0L10,10z"/><path d="M0,0L10,0L10,10z"/></svg>`;

const expectedWarning = {
  code: 'MERGE_PATHS_FAILED',
  message: 'Error: infinite loop while processing mergePaths plugin.',
  plugin: 'mergePaths',
  level: 'warning',
};

test('mergePaths reports a warning when paths cannot be compared', () => {
  intersectsMock.mockImplementation((_path1, _path2, onFailure) => {
    onFailure?.();
    return true;
  });
  /** @type {import('../../lib/types.js').Warning[]} */
  const received = [];
  const { warnings } = optimize(svg, {
    plugins: ['mergePaths'],
    onWarning: (warning) => received.push(warning),
  });
  expect(received).toStrictEqual([expectedWarning]);
  expect(warnings).toStrictEqual(received);
});

test('mergePaths keeps the legacy console.error output without a callback', () => {
  intersectsMock.mockImplementation((_path1, _path2, onFailure) => {
    onFailure?.();
    return true;
  });
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { warnings } = optimize(svg, { plugins: ['mergePaths'] });
  expect(error).toHaveBeenCalledWith(
    'Error: infinite loop while processing mergePaths plugin.',
  );
  expect(warnings).toStrictEqual([expectedWarning]);
  error.mockRestore();
});
