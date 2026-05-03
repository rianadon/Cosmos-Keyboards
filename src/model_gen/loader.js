/**
 * A hacked-together loader that supports tsconfig paths
 * (https://github.com/TypeStrong/ts-node/discussions/1450#discussion-3563207)
 *
 * as well as getting the extensions correct.
 */

import { statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import * as tsConfigPaths from 'tsconfig-paths'
// @ts-ignore: Tyescript doesn't recognize ts-node/esm/transpile-only
import { resolve as resolveTs } from 'ts-node/esm/transpile-only'

const config = tsConfigPaths.loadConfig('.svelte-kit')
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
    // tsconfig-paths returns directory paths verbatim, so resolve `foo` →
    // `foo/index` when `foo` is a directory before appending the extension.
    const resolvedPath = isDirectory(mappedSpecifier) ? `${mappedSpecifier}/index` : mappedSpecifier
    const url = pathToFileURL(resolvedPath).href
    specifier = url.endsWith('.json') ? url : `${url}.js`
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

/** @param {string} absPath */
function isDirectory(absPath) {
  try {
    return statSync(absPath).isDirectory()
  } catch {
    return false
  }
}

// @ts-ignore
export { load } from 'ts-node/esm/transpile-only'
