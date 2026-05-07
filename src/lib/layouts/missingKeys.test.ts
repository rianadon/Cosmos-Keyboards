/**
 * Tests for the per-key strict layout matcher and the layoutDiff indicator
 * helper. Detection treats absence (missing keys) differently from
 * contradiction (alien letters) — a deleted key keeps the layout detected,
 * an alien letter pushes the kbd into CUSTOM.
 */

import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { expect, test } from 'bun:test'
import { applyLayoutToKeys, setClusterSize } from '../../routes/beta/lib/editor/visualEditorHelpers'
import { cuttleConf } from '../worker/config'
import { type CosmosKeyboard, detectLayout, fromCosmosConfig, layoutDiff, mirrorCluster, toCosmosConfig, toFullCosmosConfig } from '../worker/config.cosmos'
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

test('deleting a single alpha key preserves the detected layout', () => {
  // Maintainer bug: with the old strict matcher, deleting h on a QWERTY board
  // flipped the kbd into CUSTOM and broke mirror-flip on the synthesized left.
  // Per-key matching keeps QWERTY because no surviving key contradicts it.
  const kbd = buildDefaultCosmos()
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  const cluster = rightCluster(kbd)
  const homeColIdx = cluster.clusters.findIndex(c => c.keys.some(k => k.profile.letter === 'h'))
  cluster.clusters[homeColIdx].keys = cluster.clusters[homeColIdx].keys.filter(k => k.profile.letter !== 'h')

  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)
  // The indicator's data: h is missing on the right; its left-side mirror g is
  // synthesized via mirrorCluster, so it surfaces too.
  const diff = layoutDiff(kbd, LAYOUT.QWERTY)
  expect(diff.missing).toContain('h')
  expect(diff.missing).toContain(flipLetter('h', LAYOUT.QWERTY)!) // 'g'
  expect(diff.mismatched).toEqual([])
})

test('shrinking columns preserves the detected layout', () => {
  const kbd = buildDefaultCosmos()
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  setClusterSize(kbd, 'right', 5, 4, true)
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  // Shrinking to 5x4 drops at least one canonical alpha column on each half;
  // layoutDiff reports the letters that no longer have a key.
  const diff = layoutDiff(kbd, LAYOUT.QWERTY)
  expect(diff.missing.length).toBeGreaterThan(0)
})

test('a single alien letter keeps the closest named layout (best-fit)', () => {
  // The user's framing: 'X' where 'h' is on QWERTY. Best-fit matching keeps
  // the kbd on QWERTY because every other alpha position still matches —
  // the indicator surfaces 'h' as mismatched rather than collapsing to
  // CUSTOM (which would lose the layout signal entirely).
  const original = buildDefaultCosmos()
  expect(detectLayout(original)).toBe(LAYOUT.QWERTY)

  const cuttle = fromCosmosConfig(original)
  const side = cuttle.right ? 'right' : cuttle.unibody ? 'unibody' : 'left'
  const config = (cuttle as any)[side]
  const targetKey = config.keys.find((k: any) => k.keycap?.letter === 'h')
  expect(targetKey).toBeTruthy()
  targetKey.keycap.letter = 'X'

  const reCosmos = toFullCosmosConfig(cuttle, true)
  expect(detectLayout(reCosmos)).toBe(LAYOUT.QWERTY)
  const diff = layoutDiff(reCosmos, LAYOUT.QWERTY)
  expect(diff.mismatched).toContain('h')
})

test('a duplicate alpha letter outside the canonical block stays best-fit', () => {
  // Expert mode lets users edit any key, including those outside the canonical
  // 5-col block. A stamped duplicate doesn't break detection — best-fit
  // ignores stray non-alpha-block letters and the indicator's dedicated
  // canonical-position walk finds no mismatch in the alpha block.
  const original = buildDefaultCosmos()
  expect(detectLayout(original)).toBe(LAYOUT.QWERTY)

  const cluster = rightCluster(original)
  const innerCandidate = cluster.clusters
    .flatMap((c) => c.keys)
    .find((k) => k.profile.letter === '[' || k.profile.letter === ']')
  expect(innerCandidate).toBeTruthy()
  innerCandidate!.profile.letter = 'h'

  // Best-fit still picks QWERTY (every canonical alpha position matches).
  // The stray duplicate isn't surfaced — a user shenanigan we accept.
  expect(detectLayout(original)).toBe(LAYOUT.QWERTY)
})

test('mirror-form Colemak preserves Colemak across deletion (the original bug)', () => {
  // The maintainer's exact regression: joint-edit Colemak, delete one alpha
  // key, and the synthesized left side reverts to QWERTY because
  // mirrorCluster's detectLayout fall-through hit DEFAULT_LAYOUT (QWERTY).
  // Per-key matching keeps Colemak detected after deletion, so mirrorCluster
  // uses Colemak's flipMap and the left half's letters stay correct.
  const kbd = applyLayoutToKeys(buildDefaultCosmos(), LAYOUT.COLEMAK)
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)
  expect(kbd.clusters.find(c => c.name === 'fingers' && c.side === 'left')).toBeUndefined()

  // Delete a single Colemak alpha key on the right. (Colemak top row right
  // = j-l-u-y-;)
  const cluster = rightCluster(kbd)
  const lCol = cluster.clusters.find(c => c.keys.some(k => k.profile.letter === 'l'))!
  lCol.keys = lCol.keys.filter(k => k.profile.letter !== 'l')

  // Detection still says Colemak (no contradiction, just absence).
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)

  // mirrorCluster therefore uses Colemak's flipMap. The synthesized left
  // cluster's letters should be Colemak's left side (q-w-f-p-g top row),
  // not QWERTY's (q-w-e-r-t).
  const synthesizedLeft = mirrorCluster(cluster, kbd)
  const leftLetters = synthesizedLeft.clusters.flatMap(c => c.keys.map(k => k.profile.letter))
  // Colemak's left side has 'f' (mapped from right 'u') and 'p' (from right 'l').
  // Even after deleting 'l', other Colemak letters survive the mirror.
  expect(leftLetters).toContain('f') // Colemak only — QWERTY has 'r' here
  // The deleted right-side 'l' should also be absent on the synthesized left
  // (its flip 'p' shouldn't appear since the source key was deleted).
  expect(leftLetters).not.toContain('p')
})

test('intact QWERTY mirror reports no missing or mismatched keys', () => {
  const kbd = buildDefaultCosmos()
  const diff = layoutDiff(kbd, LAYOUT.QWERTY)
  expect(diff).toEqual({ missing: [], mismatched: [] })
})

test('mirrored split: deleting one alpha key reports both halves', () => {
  // Same as the maintainer's "missing keys for both halves" requirement —
  // the synthesized left side surfaces in layoutDiff so users see they need
  // to add keys back on either side.
  const kbd = buildDefaultCosmos()
  expect(kbd.clusters.find(c => c.name === 'fingers' && c.side === 'left')).toBeUndefined()

  const cluster = rightCluster(kbd)
  const pCol = cluster.clusters.find(c => c.keys.some(k => k.profile.letter === 'p'))!
  pCol.keys = pCol.keys.filter(k => k.profile.letter !== 'p')

  const diff = layoutDiff(kbd, LAYOUT.QWERTY)
  expect(diff.missing).toContain('p')
  expect(diff.missing).toContain(flipLetter('p', LAYOUT.QWERTY)!) // 'q'
})

test('non-mirror split: missing left col reports left-side letter only', () => {
  const kbd = buildDefaultCosmos()
  const right = rightCluster(kbd)
  kbd.clusters.push(mirrorCluster(right, kbd))
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)

  const leftCluster = kbd.clusters.find(c => c.name === 'fingers' && c.side === 'left')!
  const qCol = leftCluster.clusters.find(c => c.keys.some(k => k.profile.letter === 'q'))!
  qCol.keys = qCol.keys.filter(k => k.profile.letter !== 'q')

  const diff = layoutDiff(kbd, LAYOUT.QWERTY)
  expect(diff.missing).toContain('q')
  expect(diff.missing).not.toContain('p')
})

test('left-cluster off-key surfaces as a mismatch but kbd stays best-fit', () => {
  const kbd = applyLayoutToKeys(buildDefaultCosmos(), LAYOUT.COLEMAK)
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)

  const right = kbd.clusters.find((c) => c.name === 'fingers' && c.side === 'right')!
  kbd.clusters.push(mirrorCluster(right, kbd))
  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)

  // Edit a left-side top-row key off-Colemak. Best-fit still picks Colemak
  // (the right cluster is pure, the left has 14 of 15 correct), and the
  // indicator surfaces the edited position as mismatched.
  const leftCluster = kbd.clusters.find((c) => c.name === 'fingers' && c.side === 'left')!
  const targetKey = leftCluster.clusters.flatMap((c) => c.keys).find((k) => k.profile.letter === 'g')
  expect(targetKey).toBeTruthy()
  targetKey!.profile.letter = 'a'

  expect(detectLayout(kbd)).toBe(LAYOUT.COLEMAK)
  const diff = layoutDiff(kbd, LAYOUT.COLEMAK)
  expect(diff.mismatched).toContain('g')
})

test('empty kbd defaults to QWERTY via registry-order tiebreak', () => {
  const kbd = buildDefaultCosmos()
  // Strip every alpha letter on every cluster; layout is now ambiguous.
  for (const cluster of kbd.clusters) {
    for (const col of cluster.clusters) {
      for (const key of col.keys) {
        if (key.profile.letter && /[a-z]/.test(key.profile.letter)) {
          key.profile.letter = undefined
        }
      }
    }
  }
  // No contradictions → all named layouts pass → first registry entry wins.
  expect(detectLayout(kbd)).toBe(LAYOUT.QWERTY)
})
