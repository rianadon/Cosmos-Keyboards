/**
 * A hacked-together loader that supports tsconfig paths
 * (https://github.com/TypeStrong/ts-node/discussions/1450#discussion-3563207)
 *
 * as well as getting the extensions correct.
 */

import { resolve as resolveTs } from 'ts-node/esm/transpile-only'
import * as tsConfigPaths from 'tsconfig-paths'

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig()
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths)

export function resolve(specifier, context, defaultResolver) {
  const mappedSpecifier = matchPath(specifier)
  if (mappedSpecifier) {
    specifier = `${mappedSpecifier}.js`
  } else if (
    !specifier.endsWith('.ts') && !specifier.endsWith('.js')
    && (specifier.includes('three/') || specifier.includes('./'))
  ) {
    specifier = specifier + '.js'
  }
  if (specifier.includes('$assets')) throw new Error(matchPath(specifier.replace('?url', '')))
  return resolveTs(specifier, context, defaultResolver)
}

export { load } from 'ts-node/esm/transpile-only'
