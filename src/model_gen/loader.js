/**
 * A hacked-together loader that supports tsconfig paths
 * (https://github.com/TypeStrong/ts-node/discussions/1450#discussion-3563207)
 *
 * as well as getting the extensions correct.
 */

import { pathToFileURL } from 'node:url'
import * as tsConfigPaths from 'tsconfig-paths'
// @ts-ignore: Tyescript doesn't recognize ts-node/esm/transpile-only
import { resolve as resolveTs } from 'ts-node/esm/transpile-only'

const config = tsConfigPaths.loadConfig()
if (config.resultType == 'failed') throw new Error('Loading typescript config failed: ' + config.message)
const matchPath = tsConfigPaths.createMatchPath(config.absoluteBaseUrl, config.paths)

/** Resolve an import (such as ./test) to a file path
 * @param {string} specifier    The given import
 * @param {any} context         Some context
 * @param {any} defaultResolver The resolver to fall back to
 */
export function resolve(specifier, context, defaultResolver) {
  const mappedSpecifier = matchPath(specifier)
  if (mappedSpecifier) {
    // On Windows, Node.js expects absolute paths to be file:// urls
    // mappedSpecifier is an absolute path
    const url = pathToFileURL(mappedSpecifier).href
    specifier = `${url}.js`
  } else if (
    !specifier.endsWith('.ts') && !specifier.endsWith('.js')
    && !specifier.endsWith('.cjs')
    && (specifier.includes('three/') || specifier.includes('./'))
  ) {
    specifier = specifier + '.js'
  }
  if (specifier.includes('$assets')) throw new Error(matchPath(specifier.replace('?url', '')))
  return resolveTs(specifier, context, defaultResolver)
}

// @ts-ignore
export { load } from 'ts-node/esm/transpile-only'
