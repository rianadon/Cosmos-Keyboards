/**
 * Simplistic MakeFile runner.
 *
 * Does the bare minimum to run Cosmos's Makefile.
 */

import { readFile, stat } from 'fs/promises'
import shelljs from 'shelljs'

/* ------------------ Types ------------------ */

/**
 * @typedef {Record<string, string>} Vars
 */

/**
 * @typedef {Object} Rule
 * @property {string} target
 * @property {string[]} deps
 * @property {string[]} cmds
 */

/**
 * @typedef {Object} MakeContext
 * @property {Vars} vars
 * @property {Map<string, Rule>} rules
 * @property {Set<string>} phony
 */

/**
 * @enum {number}
 */
const NodeState = {
  Unvisited: 0,
  Visiting: 1,
  Done: 2,
}

/**
 * @typedef {Object} BuildNode
 * @property {Rule} rule
 * @property {BuildNode[]} deps
 * @property {boolean} rebuilt
 * @property {number} state
 */

/* ------------ MANUAL OVERRIDES ----------- */

/**
 * @param {string} name
 * @param {string} value
 * @returns {Promise<string>}
 */
async function parseVar(name, value) {
  if (name in cliVars) return cliVars[name]
  if (name === 'BUN') return shelljs.which('bun') || ''
  return value
}

/* ------------------ CLI ------------------ */

/**
 * @param {string[]} args
 * @returns {{ cliVars: Record<string, string>, targets: string[], dryRun: boolean }}
 */
function parseCliArgs(args) {
  /** @type {Record<string, string>} */
  const cliVars = {}
  /** @type {string[]} */
  const targets = []
  let dryRun = false

  for (const arg of args) {
    if (arg === '-n' || arg === '--dry-run') {
      dryRun = true
    } else if (arg.includes('=') && targets.length === 0) {
      const [key, ...rest] = arg.split('=')
      cliVars[key] = rest.join('=')
    } else {
      targets.push(arg)
    }
  }

  return { cliVars, targets, dryRun }
}

const args = process.argv.slice(2)
const { cliVars, targets: cliTargets, dryRun } = parseCliArgs(args)
const DRY_RUN = dryRun

const MAKEFILE = 'Makefile'

const makefileText = await readFile(MAKEFILE, 'utf8')
const ctx = await parseMakefile(makefileText)

// Override Makefile variables with CLI
for (const [k, v] of Object.entries(cliVars)) {
  ctx.vars[k] = v
}

// Default to the first target in the Makefile if none supplied
const targets = cliTargets.length
  ? cliTargets
  : [ctx.rules.keys().next()?.value]

/* ------------------ Utilities ------------------ */

/**
 * @param {string} cmd
 * @returns {Promise<void>}
 */
async function runShell(cmd) {
  console.log(cmd)
  if (DRY_RUN) return

  const parts = cmd.split('&&').map(p => p.trim()).filter(Boolean)
  const originalDir = shelljs.pwd().toString()

  try {
    for (const part of parts) {
      const parsedArgs = part.match(/(?:[^\s"]+|"[^"]*")+/g) || []
      const [fnName, ...args] = parsedArgs.map(s => s.replace(/^"|"$/g, ''))

      const result = typeof shelljs[fnName] === 'function'
        ? shelljs[fnName](args)
        : shelljs.exec(part)
    }
  } finally {
    shelljs.cd(originalDir)
  }
}

/**
 * @param {string} file
 * @returns {Promise<number|null>}
 */
async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs
  } catch {
    return null
  }
}

/* ------------------ Parser ------------------ */

/**
 * @param {string} text
 * @returns {Promise<MakeContext>}
 */
async function parseMakefile(text) {
  const lines = text.split(/\r?\n/)

  /** @type {Vars} */
  const vars = {}
  /** @type {Map<string, Rule>} */
  const rules = new Map()
  /** @type {Set<string>} */
  const phony = new Set()

  /** @type {Rule|null} */
  let currentRule = null
  /** @type {boolean[]} */
  const condStack = []

  const isActive = () => condStack.every(Boolean)

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    if (!line || line.startsWith('#')) continue

    /* ---- conditionals ---- */
    if (line.startsWith('ifdef ')) {
      const v = line.slice(6).trim()
      condStack.push(Boolean(vars[v]))
      continue
    }

    if (line === 'else') {
      condStack[condStack.length - 1] = !condStack[condStack.length - 1]
      continue
    }

    if (line === 'endif') {
      condStack.pop()
      continue
    }

    if (!isActive()) continue

    /* ---- .PHONY ---- */
    if (line.startsWith('.PHONY')) {
      const targets = line.split(':')[1]?.trim().split(/\s+/) ?? []
      for (const t of targets) phony.add(t)
      continue
    }

    /* ---- variable assignment ---- */
    const varMatch = line.trim().match(/^(\w+)\s*(?:\:)?=\s*(.*)$/)
    if (varMatch) {
      vars[varMatch[1]] = await parseVar(varMatch[1], varMatch[2])
      continue
    }

    /* ---- rule ---- */
    const ruleMatch = line.match(/^([^:\s]+)\s*:\s*(.*)$/)
    if (ruleMatch) {
      const target = ruleMatch[1]
      const deps = ruleMatch[2]
        ? ruleMatch[2].split(/\s+/).filter(Boolean)
        : []
      currentRule = { target, deps, cmds: [] }
      rules.set(target, currentRule)
      continue
    }

    /* ---- command ---- */
    if (line.startsWith('\t') && currentRule) {
      currentRule.cmds.push(line.slice(1))
    }
  }

  return { vars, rules, phony }
}

/* ------------------ Expansion ------------------ */

/**
 * @param {string} str
 * @param {Vars} vars
 * @param {Record<string, string>} [auto]
 * @returns {string}
 */
function expand(str, vars, auto = {}) {
  return str
    .replace(/\$\(([^)]+)\)/g, (_, name) => {
      return auto[name] ?? vars[name] ?? ''
    })
    .replace(/\$</g, auto['<'] ?? '')
}

/* ------------------ Executor ------------------ */

/**
 * @param {string} target
 * @param {MakeContext} ctx
 * @param {Set<string>} [visiting]
 * @param {Map<string, BuildNode>} [built]
 * @returns {BuildNode}
 */
function buildGraph(
  target,
  ctx,
  visiting = new Set(),
  built = new Map(),
) {
  if (built.has(target)) return built.get(target)

  if (visiting.has(target)) {
    throw new Error(`Circular dependency detected at ${target}`)
  }
  visiting.add(target)

  const rule = ctx.rules.get(target)
  if (!rule) {
    const node = {
      rule: { target, deps: [], cmds: [] },
      deps: [],
      rebuilt: false,
      state: NodeState.Unvisited,
    }
    built.set(target, node)
    visiting.delete(target)
    return node
  }

  const deps = rule.deps.map(d => buildGraph(d, ctx, visiting, built))

  const node = {
    rule,
    deps,
    rebuilt: false,
    state: NodeState.Unvisited,
  }

  built.set(target, node)
  visiting.delete(target)
  return node
}

/**
 * @param {BuildNode} node
 * @param {MakeContext} ctx
 * @returns {Promise<void>}
 */
async function executeNode(node, ctx) {
  if (node.state === NodeState.Done) return

  if (node.state === NodeState.Visiting) {
    throw new Error(
      `Circular dependency detected at ${node.rule.target}`,
    )
  }

  node.state = NodeState.Visiting

  for (const dep of node.deps) {
    await executeNode(dep, ctx)
  }

  const { target, deps, cmds } = node.rule
  const isPhony = ctx.phony.has(target)

  let rebuild = isPhony
  const targetTime = await mtime(target)

  if (!rebuild) {
    if (!targetTime) {
      rebuild = true
    } else {
      for (const dep of node.deps) {
        if (dep.rebuilt) {
          rebuild = true
          break
        }
        const depTime = await mtime(dep.rule.target)
        if (depTime && depTime > targetTime) {
          rebuild = true
          break
        }
      }
    }
  }

  if (rebuild) {
    for (const cmd of cmds) {
      const expanded = expand(cmd, ctx.vars, {
        '<': deps[0] ?? '',
      })
      await runShell(expanded)
    }
    node.rebuilt = true
  }

  node.state = NodeState.Done
} /* ------------------ Main ------------------ */

;(async () => {
  const makefile = await readFile(MAKEFILE, 'utf8')
  const ctx = await parseMakefile(makefile)

  const theTargets = targets.length
    ? targets
    : [ctx.rules.keys().next().value]

  for (const target of theTargets) {
    if (!target) continue
    try {
      const graph = buildGraph(target, ctx)
      await executeNode(graph, ctx)
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  }
})()
