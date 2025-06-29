#!/usr/bin/env bun

import { spawn } from 'child_process'
import { createInterface } from 'readline'

/**
 * @interface SvelteCheckDiagnostic
 * Describes the structure of a single diagnostic object output by svelte-check
 * in machine-verbose mode. It can use either 'fn' or 'filename'.
 */
interface SvelteCheckDiagnostic {
  type: 'ERROR' | 'WARNING'
  fn?: string // The relative path to the file
  filename?: string // svelte-check sometimes uses this key instead of 'fn'
  start: { line: number; character: number }
  end: { line: number; character: number }
  message: string
  code: number | string
  source: string
}

/**
 * A list of filenames to be excluded from the error report.
 * Only the basename of the file is needed.
 * For example, 'App.ts' will match 'src/lib/App.ts'.
 */
const excludedFiles: string[] = ['VisualEditor2.ts', 'Viewer3D.svelte', 'App.svelte', 'VisualEditor2.svelte']

/**
 * Main asynchronous function to execute the svelte-check process,
 * parse its output, and display the results using Node.js's child_process.
 */
async function runSvelteCheckParser() {
  console.log('🚀 Starting svelte-check...')

  // A map to store diagnostics, grouped by their filename.
  const errorsByFile = new Map<string, SvelteCheckDiagnostic[]>()

  // We wrap the child process logic in a Promise to handle the async, event-driven nature.
  await new Promise<void>((resolve, reject) => {
    // Spawn the svelte-check process with the required arguments.
    const proc = spawn(
      'npx',
      [
        'svelte-check',
        '--threshold',
        'error',
        '--output',
        'machine-verbose',
      ],
      { shell: true }, // Use shell to ensure npx is found correctly across environments
    )

    let stderrData = ''
    proc.stderr?.on('data', (chunk) => {
      stderrData += chunk.toString()
    })

    // Create a readline interface to process the stdout stream line-by-line.
    const rl = createInterface({
      input: proc.stdout!,
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      // Each machine-verbose diagnostic is a JSON object on a new line.
      const jsonStart = line.indexOf('{')
      if (jsonStart === -1) {
        return // Skip non-JSON lines (like START, COMPLETED).
      }
      const jsonStr = line.substring(jsonStart)

      try {
        const diagnostic: SvelteCheckDiagnostic = JSON.parse(jsonStr)

        if (diagnostic.type !== 'ERROR') {
          return
        }

        const filePath = diagnostic.fn || diagnostic.filename
        if (!filePath) {
          console.warn(`Could not determine file path from diagnostic: ${jsonStr}`)
          return
        }

        const fileBasename = filePath.split('/').pop()
        if (fileBasename && excludedFiles.includes(fileBasename)) {
          return
        }

        const existingErrors = errorsByFile.get(filePath) || []
        existingErrors.push(diagnostic)
        errorsByFile.set(filePath, existingErrors)
      } catch (e) {
        console.warn(`Could not parse line: ${line}`)
      }
    })

    proc.on('error', (err) => {
      console.error('Failed to start svelte-check process.', err)
      reject(err)
    })

    proc.on('close', (exitCode) => {
      if (stderrData) {
        console.error(`\n--- Svelte-Check Process Stderr ---\n${stderrData}`)
      }

      // --- Output Formatting ---
      if (errorsByFile.size === 0) {
        console.log('\n✅ No relevant errors found!')
      } else {
        // 1. Print all individual errors, grouped by file.
        console.log('\n\n--- Detailed Error Report ---')
        for (const [file, errors] of errorsByFile.entries()) {
          errors.sort((a, b) => a.start.line - b.start.line)
          console.log(`\n\x1b[1m\x1b[36m${file}\x1b[0m`) // Bold cyan
          for (const error of errors) {
            const location = `L${error.start.line}:${error.start.character}`
            console.log(`  \x1b[33m[${location}]\x1b[0m ${error.message} \x1b[2m(${error.code})\x1b[0m`)
          }
        }

        // 2. Print the summary table.
        console.log('\n\n--- Error Summary ---')
        console.log(`${'Errors'.padStart(7)}  Files`)
        const sortedFiles = Array.from(errorsByFile.keys()).sort()
        let totalErrors = 0
        for (const file of sortedFiles) {
          const errors = errorsByFile.get(file)!
          totalErrors += errors.length
          const firstErrorLine = errors.length > 0 ? errors[0].start.line : 0
          const errorCountStr = String(errors.length).padStart(7)
          console.log(`${errorCountStr}  ${file}:${firstErrorLine}`)
        }

        console.log(`\nFound ${totalErrors} errors in ${errorsByFile.size} files.`)

        // Exit if there are errors.
        if (totalErrors > 0) process.exit(1)
      }
      resolve()
    })
  })
}

// Execute the main function and catch any top-level errors.
runSvelteCheckParser().catch((err) => {
  console.error('\nAn unexpected error occurred:', err)
  process.exit(1)
})
