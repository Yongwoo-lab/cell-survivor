import * as THREE from 'three';

export const time = { value: 0 };

interface GlassyOpts {
  color: number;
  opacity: number;
  rim: number;          // 림 라이트 색
  rimStrength: number;
  rimPower?: number;
  emissive?: number;
  emissiveIntensity?: number;
  wobble?: number;      // 표면 꿀렁임 진폭 (0이면 없음)
  softEdge?: boolean;   // 가장자리를 투명하게 → 초점 밖처럼 흐릿
  tint?: boolean;       // 형광색을 인스턴스 색에서 가져옴 (발광·림 모두)
  depthWrite?: boolean;
  pulse?: { from: number; amp: number; speed: number }; // 중심에서 from보다 먼 부분(돌기·가시)이 늘었다 줄었다
  flagella?: { from: number; amp: number; wave: number }; // x < -from 인 꼬리가 물결치듯 꿈틀
}

// MeshStandardMaterial + 프레넬 림 / 정점 노이즈 / 부드러운 가장자리
export function glassy(o: GlassyOpts) {
  const mat = new THREE.MeshStandardMaterial({
    color: o.color, transparent: true, opacity: o.opacity, roughness: 0.35, metalness: 0,
    emissive: o.emissive ?? 0, emissiveIntensity: o.emissiveIntensity ?? 1,
    depthWrite: o.depthWrite ?? false,
  });
  mat.defines = {};
  if (o.wobble) mat.defines.WOBBLE = '';
  if (o.softEdge) mat.defines.SOFT_EDGE = '';
  if (o.tint) mat.defines.TINT = '';
  if (o.pulse) mat.defines.PULSE = '';
  if (o.flagella) mat.defines.FLAGELLA = '';
  const uniforms = {
    uTime: time,
    uRim: { value: new THREE.Color(o.rim) },
    uRimStrength: { value: o.rimStrength },
    uRimPower: { value: o.rimPower ?? 2.5 },
    uWobble: { value: o.wobble ?? 0 },
    uPulse: { value: new THREE.Vector3(o.pulse?.from ?? 0, o.pulse?.amp ?? 0, o.pulse?.speed ?? 0) },
    uFlag: { value: new THREE.Vector3(o.flagella?.from ?? 0, o.flagella?.amp ?? 0, o.flagella?.wave ?? 0) },
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWobble; uniform vec3 uPulse; uniform vec3 uFlag;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef WOBBLE
  vec3 p = position * 2.2;
  float n = sin(p.x + uTime * 1.1) * sin(p.y * 1.3 + uTime * 0.8) * sin(p.z * 0.9 + uTime * 1.4)
          + 0.5 * sin(p.x * 2.1 - uTime * 0.7 + p.z * 1.7);
  transformed += normal * n * uWobble;
#endif
#if defined(PULSE) || defined(FLAGELLA)
  #ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3; // 개체마다 박자가 다르게
  #else
  float ph = 0.0;
  #endif
#endif
#ifdef PULSE
  float len = length(transformed);
  if (len > uPulse.x) transformed *= (uPulse.x + (len - uPulse.x) * (1.0 + uPulse.y * sin(uTime * uPulse.z + ph))) / len;
#endif
#ifdef FLAGELLA
  float tail = clamp((-position.x - uFlag.x) / uFlag.x, 0.0, 1.0);
  transformed.z += sin(position.x * uFlag.z + uTime * 16.0 + ph) * uFlag.y * tail;
  transformed.y += cos(position.x * uFlag.z * 0.7 + uTime * 11.0 + ph) * uFlag.y * 0.4 * tail;
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform float uRimStrength; uniform float uRimPower;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#if defined(TINT) && defined(USE_COLOR)
  totalEmissiveRadiance *= vColor.rgb; // r187: 인스턴스 색은 프래그먼트에서 USE_COLOR / vec4 vColor로 들어온다
#endif`)
      .replace('#include <opaque_fragment>', `
#if defined(TINT) && defined(USE_COLOR)
  vec3 rimTint = vColor.rgb;
#else
  vec3 rimTint = vec3(1.0);
#endif
  float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
#ifdef SOFT_EDGE
  diffuseColor.a *= 1.0 - smoothstep(0.1, 0.9, fr);
#else
  outgoingLight += uRim * rimTint * fr * uRimStrength;
  diffuseColor.a = min(1.0, diffuseColor.a + fr * uRimStrength * 0.5);
#endif
#include <opaque_fragment>`);
  };
  return mat;
}
