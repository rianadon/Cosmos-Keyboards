import * as THREE from 'three'
import { MeshNormalMaterial, ShaderMaterial, Vector3 } from 'three'

export class TransparentNormalMaterial extends MeshNormalMaterial {
  constructor(opacity: number) {
    if (opacity == 1) super()
    else super({ transparent: true, opacity })
  }
}

// https://threejs.org/docs/#api/en/renderers/webgl/WebGLProgram
export const VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec4 vPosition;
varying vec4 vLightPosition;

#ifdef USE_INSTANCING
attribute float instanceBrightness;
attribute float instanceTexOffset;
varying float vBrightness;
#endif

void main() {
    vNormal = normalize( normalMatrix * vec3(normal) );
    vUv = uv;
    vPosition = modelMatrix * vec4( position, 1.0 );
    #ifdef USE_INSTANCING
    vPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vBrightness = instanceBrightness;
    vUv.x = (vUv.x + instanceTexOffset) / 1000.0;
    #endif
    vLightPosition = vec4(100, 100, 300, 1);
    gl_Position = projectionMatrix * viewMatrix * vPosition;
}
`

/** Shading is done with two components:
 *   - An HSV part which takes into account lambertian reflectance (matte/diffuse)
 *   - An irridescent-ish part which is computed from surface normals
 */
export const FRAGMENT_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec4 vPosition;
varying vec4 vLightPosition;
uniform float uOpacity;
uniform vec3 uSaturation;
uniform float uAmbient;
uniform vec3 uColor;
uniform sampler2D tLetter;

#ifdef USE_INSTANCING
varying float vBrightness;
#else
uniform float uBrightness;
#endif

// http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 r = vLightPosition - vPosition;
    vec4 l = r / length(r.xyz);
    vec4 n = vec4(vNormal, 0);

    float light = min(1.0, 90000.0 / dot(r, r));

    vec3 cnorm = vNormal.xyz * 0.5 + 0.5;
    float value = light * min(1.0, max(0.0, dot(n, l)) + uAmbient);
    vec3 letter = texture2D( tLetter, vUv ).rgb;
    #ifdef USE_INSTANCING
    vec3 hsv = vec3(uColor.r, uColor.g, uColor.b * value * vBrightness - letter.g*0.5);
    #else
    vec3 hsv = vec3(uColor.r, uColor.g, uColor.b * value * uBrightness - letter.g*0.5);
    #endif
    gl_FragColor = vec4(hsv2rgb(hsv) + cnorm*uSaturation, uOpacity);
}
`

export const VERTEX_SHADER_INSTANCED = '#define USE_INSTANCING\n' + VERTEX_SHADER
export const FRAGMENT_SHADER_INSTANCED = '#define USE_INSTANCING\n' + FRAGMENT_SHADER

export class KeyboardMaterial extends ShaderMaterial {
  constructor() {
    super()
    this.vertexShader = VERTEX_SHADER
    this.fragmentShader = FRAGMENT_SHADER
    this.uniforms = {
      uOpacity: { value: 0 },
      uBrightness: { value: new Vector3(0.6, 1, 1) },
      uSaturation: { value: new Vector3(0.4, 1, 1) },
      uAmbient: { value: 0.8 },
      uColor: { value: new Vector3(0.3, 1, 1) },
      tLetter: { value: null },
    }
  }
}

// export class KeyboardMaterial extends ShaderMaterial {
//   constructor(opts: { opacity: number; brightness: number; saturation: Vector3; color: Vector3 }) {
//     super()
//     this.vertexShader = VERTEX_SHADER
//     this.fragmentShader = FRAGMENT_SHADER
//     this.uniforms = {
//       uOpacity: { value: opts.opacity },
//       uBrightness: { value: opts.brightness },
//       uSaturation: { value: opts.saturation },
//       uAmbient: { value: 0.8 },
//       uColor: { value: opts.color },
//       tLetter: { value: null },
//     }
//     this.opacity = opts.opacity
//     if (opts.opacity < 1) this.transparent = true
//   }
// }

export const COLORCONFIG = {
  green: {
    caseColor: new Vector3(0.5, 0.8, 0.7),
    caseSaturation: new Vector3(0.3, 0.3, 0.1),
    keyColor: new Vector3(0.5, 0.7, 0.5),
    keySaturation: new Vector3(0.5, 0.8, 0.3),
  },
  frost: {
    caseColor: new Vector3(0.4, 0.8, 0.7),
    caseSaturation: new Vector3(1, 0.3, 1),
    keyColor: new Vector3(0.55, 1, 0.8),
    keySaturation: new Vector3(0.8, 0.5, 0.6),
  },
  purple: {
    caseColor: new Vector3(0.81, 0.4, 0.8),
    caseSaturation: new Vector3(1, 0.3, 0.7),
    keyColor: new Vector3(1, 0.6, 0.8),
    keySaturation: new Vector3(0.5, 0.5, 0.6),
  },
  red: {
    caseColor: new Vector3(0, 1, 0.95),
    caseSaturation: new Vector3(0.2, 0.2, 0.25),
    keyColor: new Vector3(0, 0.9, 0.8),
    keySaturation: new Vector3(0.2, 0.2, 0.25),
  },
  orange: {
    caseColor: new Vector3(0.08, 1, 0.95),
    caseSaturation: new Vector3(1, 0.2, 0.4),
    keyColor: new Vector3(0.05, 0.8, 1),
    keySaturation: new Vector3(0.5, 0.2, 0.25),
  },
  yellow: {
    caseColor: new Vector3(0.14, 0.9, 0.95),
    caseSaturation: new Vector3(0.2, 0.2, 0.2),
    keyColor: new Vector3(0.15, 0.8, 0.95),
    keySaturation: new Vector3(0.2, 0.2, 0.2),
  },
  normals: {
    caseColor: new Vector3(0, 0, 0),
    caseSaturation: new Vector3(1, 1, 1),
    keyColor: new Vector3(0, 0, 0),
    keySaturation: new Vector3(1, 1, 1),
  },
}
export type ColorScheme = keyof typeof COLORCONFIG

export class CaseMaterial extends KeyboardMaterial {
  constructor(opacity: number, brightness = 1, colorScheme: ColorScheme) {
    super({
      opacity,
      brightness,
      color: COLORCONFIG[colorScheme].caseColor,
      saturation: COLORCONFIG[colorScheme].caseSaturation,
    })
  }
}

export function drawLetter(canvas: HTMLCanvasElement, letter: string, flip: boolean, color = 'white') {
  const ctx = canvas.getContext('2d')!
  if (flip) ctx.scale(-1, 1)
  ctx.font = '168px "Segoe UI", Candara, "Bitstream Vera Sans", "DejaVu Sans", "Bitstream Vera Sans", "Trebuchet MS", Verdana, "Verdana Ref", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.fillText(letter, flip ? -256 : 256, 315)
}

export class KeyMaterial extends KeyboardMaterial {
  constructor(opacity: number, brightness = 1, colorScheme: ColorScheme, letter = '', flip = false) {
    super({
      opacity,
      brightness,
      color: COLORCONFIG[colorScheme].keyColor,
      saturation: COLORCONFIG[colorScheme].keySaturation,
    })
    if (letter) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      drawLetter(canvas, letter, flip)
      this.uniforms.tLetter.value = new THREE.CanvasTexture(canvas)
    }
  }
}

export function drawLetterToTex(letter: string | undefined, tex: THREE.CanvasTexture, flip: boolean) {
  tex.needsUpdate = true
  const canvas = tex.image as OffscreenCanvas
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!letter) return
  if (flip) ctx.scale(-1, 1)
  ctx.font = '168px "Segoe UI", Candara, "Bitstream Vera Sans", "DejaVu Sans", "Bitstream Vera Sans", "Trebuchet MS", Verdana, "Verdana Ref", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'white'
  ctx.fillText(letter, flip ? -256 : 256, 315)
}

export function letterTexture(letter: string | undefined, flip: boolean) {
  const tex = new THREE.CanvasTexture(new OffscreenCanvas(512, 512))
  drawLetterToTex(letter, tex, flip)
  return tex
}
