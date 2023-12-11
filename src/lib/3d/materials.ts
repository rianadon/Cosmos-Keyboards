import * as THREE from 'three'
import { MeshNormalMaterial, ShaderMaterial, Vector3 } from 'three'

export class TransparentNormalMaterial extends MeshNormalMaterial {
  constructor(opacity: number) {
    if (opacity == 1) super()
    else super({ transparent: true, opacity })
  }
}

const VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec4 vPosition;
varying vec4 vLightPosition;

void main() {
    vNormal = normalize( normalMatrix * vec3(normal) );
    vUv = uv;
    vPosition = modelViewMatrix * vec4( position, 1.0 );
    vLightPosition = modelViewMatrix * vec4(100, -80, 200, 1);
    gl_Position = projectionMatrix * vPosition;
}
`
const FRAGMENT_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec4 vPosition;
varying vec4 vLightPosition;
uniform float uOpacity;
uniform float uBrightness;
uniform vec3 uSaturation;
uniform float uAmbient;
uniform vec3 uColor;
uniform sampler2D tLetter;

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

    float light = min(1.0, 50000.0 / dot(r, r));

    vec3 cnorm = vNormal.xyz * 0.5 + 0.5;
    float value = light * min(1.0, max(0.0, dot(n, l)) + uAmbient);
    vec3 letter = texture2D( tLetter, vUv ).rgb;
vec3 hsv = vec3(uColor.r, uColor.g, uColor.b * value * uBrightness - letter.g*0.5);
    gl_FragColor = vec4(hsv2rgb(hsv) + cnorm*uSaturation, uOpacity);
}
`

export class KeyboardMaterial extends ShaderMaterial {
  constructor(opts: { opacity: number; brightness: number; saturation: Vector3; color: Vector3 }) {
    super()
    this.vertexShader = VERTEX_SHADER
    this.fragmentShader = FRAGMENT_SHADER
    this.uniforms = {
      uOpacity: { value: opts.opacity },
      uBrightness: { value: opts.brightness },
      uSaturation: { value: opts.saturation },
      uAmbient: { value: 0.8 },
      uColor: { value: opts.color },
      tLetter: { value: null },
    }
    this.opacity = opts.opacity
    if (opts.opacity < 1) this.transparent = true
  }
}

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
    caseColor: new Vector3(0.15, 1, 0.95),
    caseSaturation: new Vector3(0.2, 0.2, 0.2),
    keyColor: new Vector3(0.15, 0.8, 1),
    keySaturation: new Vector3(0.2, 0.2, 0.2),
  },
}
type ColorScheme = keyof typeof COLORCONFIG

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
      const ctx = canvas.getContext('2d')!
      if (flip) ctx.scale(-1, 1)
      ctx.font = '168px "Segoe UI", Candara, "Bitstream Vera Sans", "DejaVu Sans", "Bitstream Vera Sans", "Trebuchet MS", Verdana, "Verdana Ref", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'white'
      ctx.fillText(letter, flip ? -256 : 256, 315)
      this.uniforms.tLetter.value = new THREE.CanvasTexture(canvas)
    }
  }
}

export function letterTexture(letter: string, flip: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  if (flip) ctx.scale(-1, 1)
  ctx.font = '168px "Segoe UI", Candara, "Bitstream Vera Sans", "DejaVu Sans", "Bitstream Vera Sans", "Trebuchet MS", Verdana, "Verdana Ref", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'white'
  ctx.fillText(letter, flip ? -256 : 256, 315)
  return new THREE.CanvasTexture(canvas)
}
