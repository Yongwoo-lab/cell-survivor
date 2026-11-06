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
  depthWrite?: boolean;
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
  const uniforms = {
    uTime: time,
    uRim: { value: new THREE.Color(o.rim) },
    uRimStrength: { value: o.rimStrength },
    uRimPower: { value: o.rimPower ?? 2.5 },
    uWobble: { value: o.wobble ?? 0 },
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWobble;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef WOBBLE
  vec3 p = position * 2.2;
  float n = sin(p.x + uTime * 1.1) * sin(p.y * 1.3 + uTime * 0.8) * sin(p.z * 0.9 + uTime * 1.4)
          + 0.5 * sin(p.x * 2.1 - uTime * 0.7 + p.z * 1.7);
  transformed += normal * n * uWobble;
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform float uRimStrength; uniform float uRimPower;`)
      .replace('#include <opaque_fragment>', `
  float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
#ifdef SOFT_EDGE
  diffuseColor.a *= 1.0 - smoothstep(0.1, 0.9, fr);
#else
  outgoingLight += uRim * fr * uRimStrength;
  diffuseColor.a = min(1.0, diffuseColor.a + fr * uRimStrength * 0.5);
#endif
#include <opaque_fragment>`);
  };
  return mat;
}
