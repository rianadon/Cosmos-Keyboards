// https://github.com/google/mediapipe/blob/master/docs/solutions/hands.md
// https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/src/mediapipe/detector.ts
import resLandmarks from '@mediapipe/hands/hand_landmark_full.tflite?url'
import resBinarypbh from '@mediapipe/hands/hands.binarypb?url'
import resPackedAssets from '@mediapipe/hands/hands_solution_packed_assets.data?url'
import resAssetsLoader from '@mediapipe/hands/hands_solution_packed_assets_loader?url'
import resSimdWasm from '@mediapipe/hands/hands_solution_simd_wasm_bin.wasm?url'
import resSimdWasmJs from '@mediapipe/hands/hands_solution_simd_wasm_bin?url'

import * as mp from '@mediapipe/hands'
import type { InputImage } from '@mediapipe/hands'
import type { PoseHand } from './hand'

interface EstimationConfig {
  flipHorizontal?: boolean
}

/** Mediapipe detector adapted from the mediapipe source code.
 * I needed to make my own so I could set custom paths for each required file.
 * Much of the code remains unchanged.
 */
class MediaPipeHandsMediaPipeDetector {
  private readonly handsSolution: mp.Hands

  private hands: { Left?: PoseHand; Right?: PoseHand } = {}
  private selfieMode = false

  constructor() {
    this.handsSolution = new mp.Hands({
      locateFile(path: string) {
        switch (path) {
          case 'hand_landmark_full.tflite':
            return resLandmarks
          case 'hands.binarypb':
            return resBinarypbh
          case 'hands_solution_packed_assets_loader.js':
            return resAssetsLoader
          case 'hands_solution_packed_assets.data':
            return resPackedAssets
          case 'hands_solution_simd_wasm_bin.js':
            return resSimdWasmJs
          case 'hands_solution_simd_wasm_bin.wasm':
            return resSimdWasm
          default:
            throw new Error('Unknown path ' + path)
        }
      },
    })
    this.handsSolution.setOptions({
      modelComplexity: 1, // Full model
      selfieMode: this.selfieMode,
      maxNumHands: 2,
    })
    this.handsSolution.onResults((results) => {
      this.hands = {}
      if (results.multiHandLandmarks !== null) {
        const handednessList = results.multiHandedness
        const landmarksList = results.multiHandLandmarks
        const worldLandmarksList = results.multiHandWorldLandmarks

        for (let i = 0; i < handednessList.length; i++) {
          this.hands[handednessList[i].label] = {
            keypoints: landmarksList[i],
            keypoints3D: worldLandmarksList[i],
            score: handednessList[i].score,
            handedness: handednessList[i].label,
          }
        }
      }
    })
  }

  /**
   * Estimates hand poses for an image or video frame.
   *
   * It returns a single hand or multiple hands based on the maxHands
   * parameter passed to the constructor of the class.
   *
   * @param input
   * ImageData|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement The input
   * image to feed through the network.
   *
   * @param config Optional.
   *       flipHorizontal: Optional. Default to false. When image data comes
   *       from camera, the result has to flip horizontally.
   *
   * @return An array of `Hand`s.
   */
  async estimateHands(input: InputImage, estimationConfig?: EstimationConfig) {
    if (
      estimationConfig
      && estimationConfig.flipHorizontal
      && estimationConfig.flipHorizontal !== this.selfieMode
    ) {
      this.selfieMode = estimationConfig.flipHorizontal
      this.handsSolution.setOptions({
        selfieMode: this.selfieMode,
      })
    }
    await this.handsSolution.send({ image: input as InputImage })
    return this.hands
  }

  dispose() {
    this.handsSolution.close()
  }

  reset() {
    this.handsSolution.reset()
    this.hands = {}
    this.selfieMode = false
  }

  initialize(): Promise<void> {
    return this.handsSolution.initialize()
  }
}

export type Detector = MediaPipeHandsMediaPipeDetector

export default async function() {
  const detector = new MediaPipeHandsMediaPipeDetector()
  await detector.initialize()
  return detector
}
