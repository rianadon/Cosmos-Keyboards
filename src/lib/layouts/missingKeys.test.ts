/**
 * Repro for the bug where reducing column count via setClusterSize is
 * supposed to flip the kbd into Custom *and* make missingKeysFor return the
 * letters needed for a re-pick — but missingKeysFor returns [] in practice.
 */

import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { expect, test } from 'bun:test'
import { applyLayoutToKeys, setClusterSize } from '../../routes/beta/lib/editor/visualEditorHelpers'
import { cuttleConf } from '../worker/config'
import { alphaColumns, type CosmosKeyboard, detectLayout, fromCosmosConfig, mirrorCluster, missingKeysFor, toCosmosConfig, toFullCosmosConfig } from '../worker/config.cosmos'
import { decodeConfigIdk } from '../worker/config.serialize'
import { flipLetter, LAYOUT } from './index'

function buildDefaultCosmos(): CosmosKeyboard {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config, 'right', true)
  cosmos.wristRestPosition = 0n
  return cosmos
}

function rightCluster(kbd: CosmosKeyboard) {
  return kbd.clusters.find(c => c.name === 'fingers' && c.side === 'right')!
}

test('REPRO: shrinking to 4 cols leaves alphaColumns saying 5 (because of inner col)', () => {
  const kbd = buildDefaultCosmos()

  // Baseline: how many alpha columns does the default kbd have?
  const before = rightCluster(kbd)
  console.log(
    'baseline:',
    'cluster cols=',
    before.clusters.length,
    'col positions=',
    before.clusters.map(c => c.column),
    'col letters=',
    before.clusters.map(c => c.keys.map(k => k.profile.letter)),
  )
  console.log('baseline alphaColumns =', alphaColumns(kbd, before))
  console.log('baseline detectLayout =', detectLayout(kbd))

  // Shrink right side to 5 rows × 4 cols (the smallest size preset that drops
  // alpha cols). After this, the kbd should not be able to host QWERTY.
  setClusterSize(kbd, 'right', 5, 4, true)

  const after = rightCluster(kbd)
  console.log(
    'after 5x4:',
    'cluster cols=',
    after.clusters.length,
    'col positions=',
    after.clusters.map(c => c.column),
    'col letters=',
    after.clusters.map(c => c.keys.map(k => k.profile.letter)),
  )
  const alphas = alphaColumns(kbd, after)
  console.log('after alphaColumns =', alphas)
  console.log('after detectLayout =', detectLayout(kbd))
  console.log('after missingKeysFor(qwerty) =', missingKeysFor(kbd, LAYOUT.QWERTY))
  console.log('after missingKeysFor(dvorak) =', missingKeysFor(kbd, LAYOUT.DVORAK))

  // The bug: detection says CUSTOM (alphas < 5) but missingKeysFor says
  // nothing's missing. Or: detection says QWERTY (alphas == 5 because inner
  // pinky is counted) but selecting Dvorak doesn't match because the inner
  // col physical position scrambles the letter mapping.
  expect(detectLayout(kbd)).toBe(LAYOUT.CUSTOM)
  // If detect == CUSTOM, missingKeysFor MUST be non-empty so the user can be
  // told why they can't switch back to a named layout.
  expect(missingKeysFor(kbd, LAYOUT.QWERTY).length).toBeGreaterThan(0)
})

test('REPRO: removing a single alpha key flips to Custom but missingKeysFor must report it', () => {
  // The actual user-reported scenario: they deleted ONE alpha key (not a
  // whole column). detectLayout flips to CUSTOM because that column is now
  // missing row 2 / 3 / 4 — but missingKeysFor used to count only columns,
  // so it returned [] and the dropdown happily applied the layout (with a
  // hole), then re-detected as CUSTOM because of the hole.
  const kbd = buildDefaultCosmos()
  const cluster = rightCluster(kbd)
  // Find the home-row 'h' key (right cluster, index col, row 3) and remove it.
  const homeColIdx = cluster.clusters.findIndex(c => c.keys.some(k => k.profile.letter === 'h'))
  expect(homeColIdx).toBeGreaterThanOrEqual(0)
  const homeCol = cluster.clusters[homeColIdx]
  homeCol.keys = homeCol.keys.filter(k => k.profile.letter !== 'h')

  console.log(
    'after deleting h:',
    'cluster cols=',
    cluster.clusters.length,
    'col letters=',
    cluster.clusters.map(c => c.keys.map(k => k.profile.letter)),
  )
  console.log('alphaColumns =', alphaColumns(kbd, cluster))
  console.log('detectLayout =', detectLayout(kbd))
  console.log('missingKeysFor(qwerty) =', missingKeysFor(kbd, LAYOUT.QWERTY))
  console.log('missingKeysFor(dvorak) =', missingKeysFor(kbd, LAYOUT.DVORAK))

  expect(detectLayout(kbd)).toBe(LAYOUT.CUSTOM)
  // The fix: missingKeysFor should report at least one missing letter so the
  // dropdown can warn the user instead of silently applying a half-layout.
  expect(missingKeysFor(kbd, LAYOUT.QWERTY).length).toBeGreaterThan(0)
  expect(missingKeysFor(kbd, LAYOUT.DVORAK).length).toBeGreaterThan(0)
})

test("REPRO with user's actual hash: hash that gave currentLayout=custom + missing=[]", () => {
  // From the user's logs after they removed a col — at this point currentLayout
  // is 'custom' but missingKeysFor returned [] for dvorak.
  const userHashAfterRemoval =
    'CpsBChUSBRCAPyAnEgIgExICIAASADgxQAAKFRIFEIBLICcSAiATEgIgABIAOB1AAAogEgUQgFcgJxICIBMSBRCwLyAUEgUQsF8gKDgJQIDwvAIKHxIFEIBjICcSAiATEgIgABIDELA7EgUQsGsgKDgKQAAKGRIFEIBvICcSAiATEgIgABIAOB5AgIaKwAcYAEDohaCu8FVI3PCioAEKigEKKxITEMCAAkCAgJgCSMKZoJWQvAFQQxISQICAzAJIwpmglZC8AVCGAVg6OAgKFRIQEEBAgIAgSNCVgN2Q9QNQC1CeAgonEhAQQECAgPgBSOaZ/KeQC1BXEhFAgICkA0jwmcS10DBQdFiVAVB/GAIiCgjIARDIARgAIABAy4v8n9AxSK2R3I3BkwaCAQIEAg=='
  const decoded = decodeConfigIdk(userHashAfterRemoval) as unknown as CosmosKeyboard
  const cluster = rightCluster(decoded)
  console.log(
    "user's kbd after removal:",
    'cluster cols=',
    cluster.clusters.length,
    'col positions=',
    cluster.clusters.map((c) => c.column),
    'col letters=',
    cluster.clusters.map((c) => c.keys.map((k) => k.profile.letter)),
  )
  const alphas = alphaColumns(decoded, cluster)
  console.log("user's kbd alphaColumns =", alphas)
  console.log("user's kbd detectLayout =", detectLayout(decoded))
  console.log("user's kbd missingKeysFor(qwerty) =", missingKeysFor(decoded, LAYOUT.QWERTY))
  console.log("user's kbd missingKeysFor(dvorak) =", missingKeysFor(decoded, LAYOUT.DVORAK))

  // We expect detect == CUSTOM (matches user's logs) and missing != [] (the bug).
  expect(detectLayout(decoded)).toBe(LAYOUT.CUSTOM)
  expect(missingKeysFor(decoded, LAYOUT.DVORAK).length).toBeGreaterThan(0)
})

test('REPRO: qwerty → expert → change key letter → basic → currentLayout flips to Custom', () => {
  // User scenario: start in basic with QWERTY, switch to expert, change one
  // alpha key's letter, switch back to basic. The dropdown should now show
  // Custom (because the letters no longer match a named layout).
  //
  // What the live app does on each step:
  //   basic → expert: nothing relevant (CodeEditor mounts, fed by $protoConfig)
  //   user types in editor: Monaco compiles TS → JS → worker runs JS →
  //     produces newConf → assigns to App.svelte's `config` (via bind:conf)
  //   expert → basic: setMode runs:
  //     next = toFullCosmosConfig(config, true)
  //     state.options = next; protoConfig.set(next); config = fromCosmosConfig(next)
  //     mode = 'basic' → VisualEditor2 mounts → currentLayout = detectLayout($protoConfig)
  //
  // This test exercises that exact path — minus the editor's TS-compile + JS-run
  // hops, which are async. If the user clicks "basic" before those resolve,
  // `config` is stale and the bug appears in the live app even though this
  // round-trip is correct.

  // 1. Start with QWERTY in basic.
  const original = buildDefaultCosmos()
  expect(detectLayout(original)).toBe(LAYOUT.QWERTY)

  // 2. Switch to expert: the CodeEditor sees a FullCuttleform derived from
  //    $protoConfig.
  const cuttle = fromCosmosConfig(original)

  // 3. Change a key letter in expert. Pick the home-row 'h' on the right.
  const side = cuttle.right ? 'right' : cuttle.unibody ? 'unibody' : 'left'
  const config = (cuttle as any)[side]
  const targetKey = config.keys.find((k: any) => k.keycap?.letter === 'h')
  expect(targetKey).toBeTruthy()
  targetKey.keycap.letter = 'X'

  // 4. Switch back to basic: setMode runs toFullCosmosConfig on the modified
  //    config and pushes the result into $protoConfig.
  const reCosmos = toFullCosmosConfig(cuttle, true)

  // Sanity: the letter survived the round-trip into the new $protoConfig.
  const reCluster = rightCluster(reCosmos)
  const allLetters = reCluster.clusters.flatMap((c) => c.keys.map((k) => k.profile.letter))
  console.log('after round-trip with X edit, right letters =', allLetters)
  expect(allLetters).toContain('X')
  expect(allLetters).not.toContain('h')

  // 5. The dropdown reads `currentLayout = detectLayout($protoConfig)` — must
  //    be CUSTOM since 'h' no longer matches QWERTY.
  expect(detectLayout(reCosmos)).toBe(LAYOUT.CUSTOM)
})

test('REPRO: expert-mode edit to a non-alpha-block key (inner col) → duplicate alpha letter → Custom', () => {
  // Basic mode only exposes the 5-col alpha block, so any letter edit there
  // is automatically caught by detectLayout's row checks. Expert mode lets
  // you edit ANY key — including the inner pinky col, which sits outside the
  // 5-col block. Without a duplicate check, detectLayout would happily return
  // QWERTY even though the kbd now has two 'a's (one in the home-row pinky,
  // one in the inner col the user just edited).
  const original = buildDefaultCosmos()
  expect(detectLayout(original)).toBe(LAYOUT.QWERTY)

  // Find an alpha letter that already appears once and stamp it onto a
  // non-alpha-block key (e.g., a row-5 outer key) to simulate the expert-mode
  // edit producing a duplicate.
  const cluster = rightCluster(original)
  // Pick any key that isn't currently in the alpha block at row 2/3/4 — for
  // the default, row-5 outer-punctuation keys exist with letters like '['.
  const innerCandidate = cluster.clusters
    .flatMap((c) => c.keys)
    .find((k) => k.profile.letter === '[' || k.profile.letter === ']')
  expect(innerCandidate).toBeTruthy()
  // Stamp 'h' onto it — 'h' is QWERTY's home-row index, so this creates a
  // duplicate.
  innerCandidate!.profile.letter = 'h'

  expect(detectLayout(original)).toBe(LAYOUT.CUSTOM)
})

test('mirrored split: deleting a single right-side alpha key reports both halves', () => {
  // Reviewer's case: in mirror form only the right cluster is stored, but the
  // user sees both halves. Deleting QWERTY's 'p' on the right (= 'q' on the
  // visible left) should surface BOTH 'p' and 'q' as missing — not just 'p'.
  const kbd = buildDefaultCosmos()
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  // Confirm we're in mirror form (no explicit left fingers cluster stored).
  expect(kbd.clusters.find(c => c.name === 'fingers' && c.side === 'left')).toBeUndefined()

  const cluster = rightCluster(kbd)
  const pCol = cluster.clusters.find(c => c.keys.some(k => k.profile.letter === 'p'))!
  pCol.keys = pCol.keys.filter(k => k.profile.letter !== 'p')

  const missing = missingKeysFor(kbd, LAYOUT.QWERTY)
  expect(missing).toContain('p')
  expect(missing).toContain(flipLetter('p', LAYOUT.QWERTY)!) // 'q'
})

test('non-mirror split: missing column on left reports left-side letter only', () => {
  // When both halves are stored explicitly, each half is checked independently.
  // Deleting a row-2 key on the LEFT side only should surface only the
  // left-side letter ('q' for QWERTY) — the right cluster is untouched.
  const kbd = buildDefaultCosmos()
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  // Splice in an explicit left cluster mirroring the right.
  const right = rightCluster(kbd)
  kbd.clusters.push(mirrorCluster(right, kbd))
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  // Delete the 'q' key (the visual left top-row outer alpha) from the left
  // cluster only. The right cluster's 'p' is still intact.
  const leftCluster = kbd.clusters.find(c => c.name === 'fingers' && c.side === 'left')!
  const qCol = leftCluster.clusters.find(c => c.keys.some(k => k.profile.letter === 'q'))!
  qCol.keys = qCol.keys.filter(k => k.profile.letter !== 'q')

  const missing = missingKeysFor(kbd, LAYOUT.QWERTY)
  expect(missing).toContain('q')
  expect(missing).not.toContain('p')
})

test('intact mirror keyboard reports no missing keys', () => {
  // Sanity check: a default mirrored QWERTY kbd should report zero missing
  // keys for QWERTY (and the new dedupe shouldn't introduce phantoms).
  const kbd = buildDefaultCosmos()
  expect(missingKeysFor(kbd, LAYOUT.QWERTY)).toEqual([])
})

test('REPRO: left-cluster-only edit is detected (right cluster still pure)', () => {
  // The actual screenshot scenario: user is on Colemak, edits a LEFT-side
  // alpha key in expert mode (e.g., changes the top-row 'g' to 'a'), then
  // switches back to basic. Left now has duplicate 'a', right is unchanged.
  // detectLayout used to only check the right cluster, so it returned Colemak
  // even though the left was Custom.
  const kbd = applyLayoutToKeys(buildDefaultCosmos(), LAYOUT.COLEMAK)
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)

  // Splice in an explicit left cluster that mirrors the right (simulates the
  // user's expert-mode edit producing a non-mirror form). mirrorCluster does
  // the proper deep clone + letter flipping for us.
  const right = kbd.clusters.find((c) => c.name === 'fingers' && c.side === 'right')!
  const leftMirror = mirrorCluster(right, kbd)
  kbd.clusters.push(leftMirror)
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK) // both clusters still match

  // Edit a left-side top-row key to 'a' (Colemak left top is q,w,f,p,g — pick
  // the rightmost 'g' and stamp 'a').
  const leftCluster = kbd.clusters.find((c) => c.name === 'fingers' && c.side === 'left')!
  const targetKey = leftCluster.clusters
    .flatMap((c) => c.keys)
    .find((k) => k.profile.letter === 'g')
  expect(targetKey).toBeTruthy()
  targetKey!.profile.letter = 'a'

  // Now there are two 'a's on the left, none on the right. detectLayout must
  // return CUSTOM because the left cluster is impure even though the right
  // still matches Colemak.
  expect(detectLayout(kbd)).toBe(LAYOUT.CUSTOM)
})
