"use client";

/**
 * RadarDisc: a GLSL radar scope (rings, crosshair, rotating sweep with a phosphor
 * trail, faint scanlines) plus instanced blips that flare when the sweep passes.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uSweep;
  uniform float uOpacity;
  uniform vec3 uSignal;
  uniform vec3 uLine;
  varying vec2 vUv;
  #define PI 3.14159265359

  float ring(float r, float target, float w) {
    return smoothstep(w, 0.0, abs(r - target));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float a = atan(p.y, p.x);
    float diff = mod(uSweep - a, 2.0 * PI);
    float trail = exp(-diff * 2.6) * smoothstep(1.0, 0.0, r * 0.15);
    float beam = smoothstep(0.03, 0.0, diff) * 1.4;

    float rings = ring(r, 0.25, 0.004) + ring(r, 0.5, 0.004) + ring(r, 0.75, 0.004) + ring(r, 0.995, 0.006) * 1.6;
    float cross = smoothstep(0.004, 0.0, abs(p.x)) + smoothstep(0.004, 0.0, abs(p.y));
    float ticks = step(0.94, r) * smoothstep(0.02, 0.0, abs(fract(a / (2.0 * PI) * 72.0) - 0.5) - 0.46);
    float scan = 0.04 * sin(vUv.y * 900.0 + uTime * 2.0);
    float glow = smoothstep(1.0, 0.0, r) * 0.08;

    vec3 col = vec3(0.01, 0.03, 0.035) + glow * uSignal;
    col += uLine * (rings * 0.9 + cross * 0.5 + ticks * 0.8);
    col += uSignal * (trail * 0.55 + beam);
    col += scan * uSignal * 0.3;
    float alpha = (0.85 + trail * 0.15) * uOpacity * smoothstep(1.0, 0.985, r);
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface Blip {
  angle: number;
  radius: number;
  color: string;
  size?: number;
}

export function defaultBlips(count = 26, seed = 7): Blip[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const palette = ["#6BFFC9", "#6BFFC9", "#6BFFC9", "#FFB020", "#FF7A45", "#FF4D5E"];
  return Array.from({ length: count }, () => ({
    angle: rnd() * Math.PI * 2,
    radius: 0.18 + rnd() * 0.75,
    color: palette[Math.floor(rnd() * palette.length)]!,
    size: 0.016 + rnd() * 0.014,
  }));
}

export function RadarDisc({
  radius = 1,
  blips,
  speed = 0.9,
  opacityRef,
}: {
  radius?: number;
  blips?: Blip[];
  speed?: number;
  /** Mutable opacity driven from scroll without re-rendering. */
  opacityRef?: React.RefObject<number>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => blips ?? defaultBlips(), [blips]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSweep: { value: 0 },
      uOpacity: { value: 1 },
      uSignal: { value: new THREE.Color("#6BFFC9") },
      uLine: { value: new THREE.Color("#2b4a5c") },
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = inst.current;
    if (!mesh) return;
    list.forEach((b, i) => mesh.setColorAt(i, new THREE.Color(b.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [list]);

  useFrame((_, delta) => {
    const u = uniforms;
    u.uTime.value += delta;
    u.uSweep.value = (u.uSweep.value + delta * speed) % (Math.PI * 2);
    const op = opacityRef?.current ?? 1;
    u.uOpacity.value = op;
    if (inst.current) {
      const sweep = u.uSweep.value;
      list.forEach((b, i) => {
        const diff = (((sweep - b.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const flare = Math.exp(-diff * 1.8);
        const pulse = 1 + 0.25 * Math.sin(u.uTime.value * 3 + i);
        const s = (b.size ?? 0.02) * radius * (0.7 + flare * 1.6) * pulse * op;
        dummy.position.set(
          Math.cos(b.angle) * b.radius * radius,
          Math.sin(b.angle) * b.radius * radius,
          0.002,
        );
        dummy.scale.setScalar(Math.max(s, 0.0001));
        dummy.updateMatrix();
        inst.current!.setMatrixAt(i, dummy.matrix);
      });
      inst.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh>
        <circleGeometry args={[radius, 96]} />
        <shaderMaterial
          ref={mat}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, list.length]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial transparent toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
