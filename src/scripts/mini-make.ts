/**
 * Simplistic MakeFile runner.
 *
 * Does the bare minimum to run Cosmos's Makefile.
 */

import { readFile, stat } from 'fs/promises'
import shelljs from 'shelljs'

/* ------------------ Types ------------------ */

type Vars = Record<string, string>

interface Rule {
  target: string
  deps: string[]
  cmds: string[]
}

interface MakeContext {
  vars: Vars
  rules: Map<string, Rule>
  phony: Set<string>
}

enum NodeState {
  Unvisited,
  Visiting,
  Done,
}

interface BuildNode {
  rule: Rule
  deps: BuildNode[]
  rebuilt: boolean
  state: NodeState
}

/* ------------ MANUAL OVERRIDES ----------- */
async function parseVar(name: string, value: string): Promise<string> {
  if (name == 'BUN') return shelljs.which('bun') || ''
  return value
}

/* ------------------ CLI ------------------ */

const args: string[] = process.argv.slice(2)
const DRY_RUN: boolean = args.includes('--dry-run') || args.includes('-n')

const targetArg: string | undefined = args.find(a => !a.startsWith('-'))

const MAKEFILE = 'Makefile'

/* ------------------ Utilities ------------------ */

async function runShell(cmd: string): Promise<void> {
  console.log(cmd)
  if (DRY_RUN) {
    return Promise.resolve()
  }

  shelljs.exec(cmd)
}

async function mtime(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs
  } catch {
    return null
  }
}

/* ------------------ Parser ------------------ */

async function parseMakefile(text: string): Promise<MakeContext> {
  const lines = text.split(/\r?\n/)

  const vars: Vars = {}
  const rules = new Map<string, Rule>()
  const phony = new Set<string>()

  let currentRule: Rule | null = null
  const condStack: boolean[] = []

  const isActive = (): boolean => condStack.every(Boolean)

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
      const targets = line
        .split(':')[1]
        ?.trim()
        .split(/\s+/) ?? []
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

function expand(
  str: string,
  vars: Vars,
  auto: Record<string, string> = {},
): string {
  return str
    .replace(/\$\(([^)]+)\)/g, (_, name: string) => {
      // if (name.startsWith('shell ')) {
      //   if (DRY_RUN) return ''
      //   const cmd = expand(name.slice(6), vars, auto)
      //   return execSync(cmd, { encoding: 'utf8' }).trim()
      // }
      return auto[name] ?? vars[name] ?? ''
    })
    .replace(/\$</g, auto['<'] ?? '')
}

/* ------------------ Executor ------------------ */

function buildGraph(
  target: string,
  ctx: MakeContext,
  visiting = new Set<string>(),
  built = new Map<string, BuildNode>(),
): BuildNode {
  if (built.has(target)) return built.get(target)!

  if (visiting.has(target)) {
    throw new Error(`Circular dependency detected at ${target}`)
  }
  visiting.add(target)

  const rule = ctx.rules.get(target)
  if (!rule) {
    // leaf node (file-only dependency)
    const node: BuildNode = {
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

  const node: BuildNode = { rule, deps, rebuilt: false, state: NodeState.Unvisited }
  built.set(target, node)
  visiting.delete(target)
  return node
}
async function executeNode(
  node: BuildNode,
  ctx: MakeContext,
): Promise<void> {
  if (node.state === NodeState.Done) {
    return // ✅ already handled
  }

  if (node.state === NodeState.Visiting) {
    throw new Error(
      `Circular dependency detected at ${node.rule.target}`,
    )
  }

  node.state = NodeState.Visiting

  // Execute dependencies first
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

  node.state = NodeState.Done // ✅ mark complete
} /* ------------------ Main ------------------ */

;(async (): Promise<void> => {
  const makefile = await readFile(MAKEFILE, 'utf8')
  const ctx = await parseMakefile(makefile)

  const target = targetArg ?? ctx.rules.keys().next().value

  if (!target) {
    console.error('No target specified')
    process.exit(1)
  }

  try {
    const graph = buildGraph(target, ctx)
    await executeNode(graph, ctx)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
})()
