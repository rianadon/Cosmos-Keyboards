import { execSync } from 'child_process'
import { relative } from 'path'

export function getChangedFiles(): string[] | null {
  const head = process.env.VERCEL_GIT_COMMIT_SHA
  if (!head) return null

  const base = execSync(`git merge-base origin/main ${head}`).toString().trim()
  const files = execSync(`git diff --name-only ${base} ${head}`).toString().trim()

  return files ? files.split('\n') : []
}

export function relativePathToRepo(absPath: string) {
  const root = process.cwd()
  return relative(root, absPath).replace(/\\/g, '/')
}
