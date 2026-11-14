"use client";

/**
 * One persistent WebGL canvas fixed behind the landing content. Objects cross-fade
 * and move between scenes as the visitor scrolls: radar disc (1-2), constellation (3),
 * dotted globe with flight arcs (4), fuel-gauge torus (5), theme point cloud (7).
 */
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLanding } from "@/lib/landing/motion";
import { RadarDisc } from "./radar-disc";

const SIGNAL = new THREE.Color("#6BFFC9");
const AMBER = new THREE.Color("#FFB020");
const ALARM = new THREE.Color("#FF4D5E");
const ICE = new THREE.Color("#7CC4FF");

const damp = THREE.MathUtils.damp;

/** Opacity target for an object visible in `scenes`. */
function useSceneOpacity(scenes: number[]) {
  const ref = useRef(0);
  useFrame((_, dt) => {
    const { scene, ready } = useLanding.getState();
    ref.current = damp(ref.current, ready && scenes.includes(scene) ? 1 : 0, 4, dt);
  });
  return ref;
}

function setGroupOpacity(group: THREE.Object3D | null, o: number) {
  group?.traverse((obj) => {
    const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const mats = Array.isArray(m) ? m : m ? [m] : [];
    mats.forEach((mat) => {
      if ("opacity" in mat && !(mat instanceof THREE.ShaderMaterial)) {
        mat.transparent = true;
        mat.opacity = o;
      }
    });
    obj.visible = o > 0.01;
  });
}

function Radar() {
  const group = useRef<THREE.Group>(null);
  const opacity = useSceneOpacity([1, 2]);
  const { viewport } = useThree();
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const { scene, sceneProgress } = useLanding.getState();
    const hero = scene === 1;
    const tx = hero ? viewport.width * 0.3 : -viewport.width * 0.18;
    const ty = hero ? -viewport.height * 0.18 : 0;
    const s = hero ? Math.min(viewport.width, viewport.height) * 0.3 : Math.min(viewport.width, viewport.height) * 0.42;
    g.position.x = damp(g.position.x, tx, 3, dt);
    g.position.y = damp(g.position.y, ty, 3, dt);
    g.scale.setScalar(damp(g.scale.x, s, 3, dt));
    g.rotation.x = damp(g.rotation.x, hero ? -0.55 : -0.25 - sceneProgress * 0.4, 3, dt);
    g.visible = opacity.current > 0.01;
  });
  return (
    <group ref={group} rotation={[-0.55, 0, 0]}>
      <RadarDisc opacityRef={opacity} />
    </group>
  );
}

function Constellation() {
  const group = useRef<THREE.Group>(null);
  const opacity = useSceneOpacity([3]);
  const nodes = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
    for (let i = 0; i < 22; i++) pts.push(new THREE.Vector3(rnd() * 4, rnd() * 2.6, rnd() * 2.2));
    pts[0] = new THREE.Vector3(0, 0, 0.4);
    return pts;
  }, []);
  const lines = useMemo(() => {
    const pos: number[] = [];
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach((b) => {
        if (a.distanceTo(b) < 1.45) pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      });
      if (i > 0 && i < 4) pos.push(nodes[0]!.x, nodes[0]!.y, nodes[0]!.z, a.x, a.y, a.z);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [nodes]);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.12;
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    const { sceneProgress } = useLanding.getState();
    g.scale.setScalar(damp(g.scale.x, 0.9 + sceneProgress * 0.35, 3, dt));
    setGroupOpacity(g, opacity.current);
  });
  return (
    <group ref={group} position={[1.2, 0, 0]}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={ICE} transparent opacity={0.5} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[i === 0 ? 0.11 : i < 4 ? 0.08 : 0.045, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? ALARM : i < 4 ? AMBER : SIGNAL} transparent />
        </mesh>
      ))}
    </group>
  );
}

/** Lat/lon in degrees -> point on a sphere. */
function latLon(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const CITIES = {
  Mumbai: [19.07, 72.88],
  Dubai: [25.2, 55.27],
  London: [51.5, -0.12],
  Singapore: [1.35, 103.82],
} as const;

function Globe() {
  const group = useRef<THREE.Group>(null);
  const opacity = useSceneOpacity([4]);
  const R = 1.6;
  const dots = useMemo(() => {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const t = golden * i;
      pos.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const arcs = useMemo(() => {
    const pairs: [keyof typeof CITIES, keyof typeof CITIES][] = [
      ["Mumbai", "Dubai"],
      ["Dubai", "London"],
      ["Singapore", "Mumbai"],
      ["London", "Singapore"],
      ["Dubai", "Singapore"],
    ];
    return pairs.map(([a, b]) => {
      const va = latLon(...CITIES[a], R);
      const vb = latLon(...CITIES[b], R);
      const mid = va.clone().add(vb).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.35);
      return new THREE.QuadraticBezierCurve3(va, mid, vb);
    });
  }, []);
  const travellers = useRef<THREE.Mesh[]>([]);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const { sceneProgress } = useLanding.getState();
    g.rotation.y = damp(g.rotation.y, -1.2 + sceneProgress * 1.6, 2, dt);
    g.rotation.x = 0.35;
    travellers.current.forEach((m, i) => {
      const t = (state.clock.elapsedTime * 0.18 + i * 0.21) % 1;
      m.position.copy(arcs[i]!.getPoint(t));
    });
    setGroupOpacity(g, opacity.current);
  });
  return (
    <group ref={group} position={[1.3, -0.1, 0]}>
      <points geometry={dots}>
        <pointsMaterial size={0.018} color={SIGNAL} transparent opacity={0.55} sizeAttenuation />
      </points>
      {arcs.map((curve, i) => (
        <group key={i}>
          <mesh>
            <tubeGeometry args={[curve, 48, 0.006, 6, false]} />
            <meshBasicMaterial color={AMBER} transparent opacity={0.8} />
          </mesh>
          <mesh
            ref={(m) => {
              if (m) travellers.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={ICE} transparent />
          </mesh>
        </group>
      ))}
      {Object.values(CITIES).map(([lat, lon], i) => (
        <mesh key={i} position={latLon(lat, lon, R * 1.01)}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={ALARM} transparent />
        </mesh>
      ))}
    </group>
  );
}

function FuelTorus() {
  const group = useRef<THREE.Group>(null);
  const fuel = useRef<THREE.Mesh>(null);
  const opacity = useSceneOpacity([5]);
  const lastLeft = useRef(1);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g || !fuel.current) return;
    const { sceneProgress } = useLanding.getState();
    const left = Math.max(0.02, 1 - sceneProgress);
    if (Math.abs(left - lastLeft.current) > 0.004) {
      lastLeft.current = left;
      fuel.current.geometry.dispose();
      fuel.current.geometry = new THREE.TorusGeometry(1.25, 0.09, 16, 120, Math.PI * 1.5 * left);
    }
    color.copy(left > 0.4 ? SIGNAL : left > 0.15 ? AMBER : ALARM);
    (fuel.current.material as THREE.MeshBasicMaterial).color.copy(color);
    g.rotation.x = -0.4 + Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    g.rotation.y = 0.3;
    setGroupOpacity(g, opacity.current * (left < 0.15 ? 0.6 + 0.4 * Math.abs(Math.sin(state.clock.elapsedTime * 6)) : 1));
  });
  return (
    <group ref={group} position={[1.4, 0, 0]}>
      <group rotation={[0, 0, Math.PI * 1.25]}>
        <mesh>
          <torusGeometry args={[1.25, 0.06, 16, 120, Math.PI * 1.5]} />
          <meshBasicMaterial color="#16233A" transparent />
        </mesh>
        <mesh ref={fuel}>
          <torusGeometry args={[1.25, 0.09, 16, 120, Math.PI * 1.5]} />
          <meshBasicMaterial color={SIGNAL} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function ThemeCloud() {
  const group = useRef<THREE.Group>(null);
  const opacity = useSceneOpacity([7]);
  const clusters = useMemo(() => {
    const centers = [
      [-1.2, 0.5, 0, SIGNAL, 160],
      [0.9, 0.7, -0.4, ICE, 140],
      [0.2, -0.8, 0.3, AMBER, 220],
      [1.6, -0.5, 0.2, ALARM, 90],
    ] as const;
    return centers.map(([x, y, z, c, n], k) => {
      const pos = new Float32Array(n * 3);
      let s = 11 + k;
      const g = () => {
        s = (s * 16807) % 2147483647;
        const u = s / 2147483647;
        s = (s * 16807) % 2147483647;
        const v = s / 2147483647;
        return Math.sqrt(-2 * Math.log(u + 1e-6)) * Math.cos(2 * Math.PI * v);
      };
      for (let i = 0; i < n; i++) pos.set([x + g() * 0.28, y + g() * 0.28, z + g() * 0.28], i * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return { geo, color: c };
    });
  }, []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.08;
    const { sceneProgress } = useLanding.getState();
    g.scale.setScalar(damp(g.scale.x, 1 + sceneProgress * 0.6, 2, dt));
    g.children[2]?.scale.setScalar(1 + 0.15 * Math.sin(state.clock.elapsedTime * 3));
    setGroupOpacity(g, opacity.current);
  });
  return (
    <group ref={group} position={[1.2, 0, 0]}>
      {clusters.map((c, i) => (
        <points key={i} geometry={c.geo}>
          <pointsMaterial size={0.035} color={c.color} transparent sizeAttenuation />
        </points>
      ))}
    </group>
  );
}

export default function SceneCanvas() {
  const [dpr, setDpr] = useState(1.5);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Canvas dpr={[1, Math.min(dpr, 1.75)]} camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
        <Radar />
        <Constellation />
        <Globe />
        <FuelTorus />
        <ThemeCloud />
      </Canvas>
    </div>
  );
}
