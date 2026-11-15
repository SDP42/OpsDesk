"use client";

/** Constellation: a 3D force-directed graph of every flight linked to a booking, with a list mode. */
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { List, Orbit, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SLA_COLOR, STATUS_LABEL } from "@/lib/format";

type Node = {
  id: string;
  number: string;
  title: string;
  status: string;
  sla_state: string;
  agency: string;
  seed: boolean;
};
type Edge = { a: string; b: string; type: string; strength: number; reason: string };
const EDGE_COLOR: Record<string, string> = {
  tboh: "#FF5A1F",
  agency_intent: "#2D5BFF",
  semantic: "#6F4CF6",
  manual: "#0D1117",
};

/** Small deterministic 3D force layout: springs on links, repulsion between all nodes. */
function layout(nodes: Node[], edges: Edge[]): Record<string, [number, number, number]> {
  const pos: Record<string, [number, number, number]> = {};
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    pos[n.id] = [Math.cos(a) * 3, Math.sin(a) * 3, ((i % 5) - 2) * 0.6];
  });
  const rep = 0.6 * Math.min(1, 12 / Math.max(nodes.length, 1));
  for (let it = 0; it < 220; it++) {
    const f: Record<string, [number, number, number]> = Object.fromEntries(
      nodes.map((n) => [n.id, [0, 0, 0]]),
    );
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const p = pos[nodes[i]!.id]!,
          q = pos[nodes[j]!.id]!;
        const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
        const dist2 = Math.max(d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2, 0.05);
        for (let k = 0; k < 3; k++) {
          f[nodes[i]!.id]![k]! += (d[k]! / dist2) * rep;
          f[nodes[j]!.id]![k]! -= (d[k]! / dist2) * rep;
        }
      }
    for (const e of edges) {
      const p = pos[e.a],
        q = pos[e.b];
      if (!p || !q) continue;
      for (let k = 0; k < 3; k++) {
        const pull = (q[k]! - p[k]!) * 0.05 * (0.5 + e.strength);
        f[e.a]![k]! += pull;
        f[e.b]![k]! -= pull;
      }
    }
    for (const n of nodes)
      for (let k = 0; k < 3; k++)
        pos[n.id]![k]! += Math.max(-0.3, Math.min(0.3, f[n.id]![k]! - pos[n.id]![k]! * 0.01));
  }
  // Recentre and scale so the whole constellation fits the view, however dense the graph.
  const ids = Object.keys(pos);
  const c = [0, 1, 2].map(
    (k) => ids.reduce((a, id) => a + pos[id]![k]!, 0) / Math.max(ids.length, 1),
  );
  const r = Math.max(
    ...ids.map((id) =>
      Math.hypot(pos[id]![0]! - c[0]!, pos[id]![1]! - c[1]!, pos[id]![2]! - c[2]!),
    ),
    0.001,
  );
  if (!Number.isFinite(r)) {
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      pos[n.id] = [Math.cos(a) * 4, Math.sin(a) * 4, 0];
    });
    return pos;
  }
  for (const id of ids)
    pos[id] = [0, 1, 2].map((k) => ((pos[id]![k]! - c[k]!) / r) * 4.2) as [number, number, number];
  return pos;
}

function Graph({
  nodes,
  edges,
  onOpen,
  hover,
  setHover,
}: {
  nodes: Node[];
  edges: Edge[];
  onOpen: (n: Node) => void;
  hover: string | null;
  setHover: (id: string | null) => void;
}) {
  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);
  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 50 }}
      dpr={[1, 1.75]}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.8} />
      <OrbitControls enableDamping autoRotate autoRotateSpeed={0.6} />
      {edges.map((e, i) =>
        pos[e.a] && pos[e.b] ? (
          <Line
            key={i}
            points={[pos[e.a]!, pos[e.b]!]}
            color={EDGE_COLOR[e.type] ?? "#999"}
            lineWidth={1 + e.strength * 2}
            transparent
            opacity={0.75}
          />
        ) : null,
      )}
      {nodes.map((n) => (
        <mesh
          key={n.id}
          position={pos[n.id]!}
          onClick={() => onOpen(n)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(n.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(null);
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[n.seed ? 0.32 : 0.2, 24, 24]} />
          <meshStandardMaterial
            color={n.seed ? "#FF5A1F" : getComputedColor(n.sla_state)}
            emissive={hover === n.id ? "#FFC629" : "#000000"}
          />
        </mesh>
      ))}
    </Canvas>
  );
}

function getComputedColor(state: string): string {
  return (
    { ok: "#0C9F6A", met: "#0C9F6A", at_risk: "#D97A06", critical: "#EF4F23", breached: "#DF1C47" }[
      state
    ] ?? "#5A6270"
  );
}

function Constellation() {
  const router = useRouter();
  const params = useSearchParams();
  const [input, setInput] = useState(params.get("tboh") ?? "TBOH-88213");
  const [tboh, setTboh] = useState(params.get("tboh") ?? "TBOH-88213");
  const [mode, setMode] = useState<"3d" | "list">("3d");
  const [hover, setHover] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["constellation", tboh],
    queryFn: async () =>
      unwrap(await api.GET("/api/constellation", { params: { query: { tboh } } })),
    retry: false,
  });
  const nodes = (q.data?.nodes ?? []) as Node[];
  const edges = (q.data?.edges ?? []) as Edge[];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="B2"
        eyebrow="Constellation"
        title={
          <>
            One booking. <em className="text-ice">One picture.</em>
          </>
        }
        plain="Every case connected to a booking, drawn as a star map: orange is the booking itself, lines are links (same booking, same agency and problem, or similar meaning). Drag to orbit, hover to read, click a star to open that case. Prefer a list? Switch to list mode."
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTboh(input.trim().toUpperCase());
            }}
          >
            <input
              className="field !w-48 font-mono uppercase"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Booking TBOH"
            />
            <button className="btn btn-signal">
              <Search size={14} /> Map
            </button>
          </form>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(EDGE_COLOR).map(([k, c]) => (
          <Sign key={k} tone="outline">
            <span className="size-2 rounded-full" style={{ background: c }} />{" "}
            {k.replace("_", " + ")}
          </Sign>
        ))}
        <span className="ml-auto flex gap-1">
          {(["3d", "list"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("btn !py-1.5", mode === m && "!bg-night !text-taxi")}
            >
              {m === "3d" ? <Orbit size={13} /> : <List size={13} />} {m === "3d" ? "3D" : "List"}
            </button>
          ))}
        </span>
      </div>
      {q.isLoading ? (
        <div className="skeleton h-[560px]" />
      ) : q.error ? (
        (q.error as ApiError).status === 404 ? (
          <EmptyState
            title="No flights on this booking"
            body={`Nothing has been filed against ${tboh}.`}
          />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )
      ) : mode === "3d" ? (
        <Hud title={q.data?.reason ?? ""} bodyClassName="p-0">
          <div className="relative h-[560px] cursor-grab active:cursor-grabbing">
            <Graph
              nodes={nodes}
              edges={edges}
              hover={hover}
              setHover={setHover}
              onOpen={(n) => router.push(`/tower/t/${n.number}`)}
            />
            {(() => {
              const n = nodes.find((x) => x.id === hover);
              return n ? (
                <div className="bg-night pointer-events-none absolute top-4 left-4 rounded-xl px-3 py-2 font-mono text-[12px] text-white shadow">
                  <span className="text-taxi">{n.number}</span> · {n.agency} ·{" "}
                  {STATUS_LABEL[n.status] ?? n.status}
                  <p className="max-w-xs truncate text-white/70">{n.title}</p>
                </div>
              ) : (
                <p className="micro pointer-events-none absolute top-4 left-4">
                  Hover a star to read it · click to open
                </p>
              );
            })()}
          </div>
        </Hud>
      ) : (
        <Hud title={q.data?.reason ?? ""}>
          <ul className="flex flex-col gap-2">
            {nodes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => router.push(`/tower/t/${n.number}`)}
                  className="border-line hover:border-night flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left"
                >
                  <span
                    className="h-8 w-1.5 rounded-full"
                    style={{ background: n.seed ? "var(--color-beacon)" : SLA_COLOR[n.sla_state] }}
                  />
                  <span className="w-24 font-mono text-sm font-semibold">{n.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{n.title}</span>
                  <span className="micro">
                    {n.agency} · {STATUS_LABEL[n.status] ?? n.status} ·{" "}
                    {edges.filter((e) => e.a === n.id || e.b === n.id).length} links
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Hud>
      )}
    </div>
  );
}

export default function LinksPage() {
  return (
    <Suspense>
      <Constellation />
    </Suspense>
  );
}
