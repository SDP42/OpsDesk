"use client";

/** Black Box and Hangar: uncapped streaming exports with a live counter, retention and scale path. */
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Archive, Download, Square } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Num, Sign } from "@/components/ui/primitives";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useTowerCalls } from "@/lib/stores/tower-calls";

const STEPS = [
  ["Postgres WAL", "every change is already logged"],
  ["Debezium CDC", "streams row changes out"],
  ["Kafka", "durable event backbone"],
  ["ClickHouse / BigQuery", "analytics without touching ops DB"],
  ["Nightly Parquet", "cheap cold storage"],
  ["Signed URLs", "async exports above 1M rows"],
];

export default function DataPage() {
  const push = useTowerCalls((s) => s.push);
  const [format, setFormat] = useState<"csv" | "ndjson">("csv");
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [rows, setRows] = useState(0);
  const [total, setTotal] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    const params = new URLSearchParams({
      format,
      ...(status && { status }),
      ...(region && { region }),
    });
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRows(0);
    setBytes(0);
    setState("running");
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/export/tickets?${params}`, {
        credentials: "include",
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      setTotal(Number(res.headers.get("x-total-count") ?? 0));
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let lines = 0;
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
        for (let i = 0; i < value.length; i++) if (value[i] === 10) lines++;
        setRows(format === "csv" ? Math.max(0, lines - 1) : lines);
        setBytes(size);
        setElapsed((performance.now() - t0) / 1000);
      }
      const blob = new Blob(chunks as BlobPart[], {
        type: format === "csv" ? "text/csv" : "application/x-ndjson",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `opsdesk-blackbox.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setState("done");
      push({
        callsign: "BLACK BOX",
        message: `${(format === "csv" ? lines - 1 : lines).toLocaleString()} ROWS EXPORTED · NO CAP`,
        tone: "signal",
      });
    } catch (e) {
      setState((e as Error).name === "AbortError" ? "idle" : "error");
    }
  };

  const archive = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/admin/archive-run", { body: {} })),
    onSuccess: (r) =>
      push({ callsign: "HANGAR", message: `${r.archived} CLOSED FLIGHTS ARCHIVED`, tone: "ice" }),
  });

  const pct = total ? Math.min(100, (rows / total) * 100) : 0;
  const rate = elapsed > 0 ? Math.round(rows / elapsed) : 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="F2"
        eyebrow="Black box · hangar"
        title={
          <>
            Your data, <em className="text-signal">uncapped.</em>
          </>
        }
        plain="Download every case you need, not the first 3,000. The export streams straight from the database in small pages, so it never runs out of memory, and the counter shows rows arriving live. Old closed cases move to an archive automatically, so the live tower stays fast."
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Hud title="Export builder">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="micro">Format</span>
              <select
                className="field"
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "ndjson")}
              >
                <option value="csv">CSV (spreadsheets)</option>
                <option value="ndjson">NDJSON (data tools)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="micro">Status</span>
              <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {["open", "pending", "escalated", "resolved", "closed"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="micro">Region</span>
              <select className="field" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">All</option>
                {[
                  ["IN", "India"],
                  ["AE", "UAE"],
                  ["UK", "UK"],
                  ["SEA", "SE Asia"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="bg-night mt-6 rounded-2xl p-6 text-white">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="micro !text-white/50">Rows streamed</p>
                <p className="display text-taxi tabular text-7xl">
                  <Num value={rows} />
                </p>
                <p className="font-mono text-[12px] text-white/60">
                  of {total.toLocaleString()} · {(bytes / 1e6).toFixed(1)} MB ·{" "}
                  {rate.toLocaleString()} rows/s · {elapsed.toFixed(1)} s
                </p>
              </div>
              <div className="flex gap-2">
                {state === "running" ? (
                  <button
                    className="btn !border-white/30 !bg-transparent !text-white"
                    onClick={() => abort.current?.abort()}
                  >
                    <Square size={13} /> Stop
                  </button>
                ) : (
                  <button className="btn btn-beacon" onClick={run}>
                    <Download size={14} /> Stream export
                  </button>
                )}
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn("h-full rounded-full", state === "error" ? "bg-alarm" : "bg-taxi")}
                animate={{ width: `${pct}%` }}
                transition={{ ease: "linear", duration: 0.2 }}
              />
            </div>
            <p className="mt-3 font-mono text-[11px] text-white/50">
              {state === "idle" &&
                "Keyset pagination: WHERE (created_at, id) > cursor ORDER BY created_at, id LIMIT 5000"}
              {state === "running" && "Streaming… memory stays flat no matter how many rows"}
              {state === "done" && "Done. File downloaded. No 3,000-row cap."}
              {state === "error" && "Export failed. Only the Airport Director can export."}
            </p>
          </div>

          <div className="mt-5">
            <p className="micro">Use it from scripts</p>
            <pre className="border-line bg-ink-900 mt-2 overflow-x-auto rounded-xl border p-3 font-mono text-[12px]">
              {`curl -N -b session.txt \\
  "http://localhost:3000/api/export/tickets?format=${format}${status ? `&status=${status}` : ""}${region ? `&region=${region}` : ""}" \\
  -o blackbox.${format}`}
            </pre>
          </div>
        </Hud>

        <div className="flex flex-col gap-6">
          <Hud title="Retention policy · hangar">
            <ol className="flex flex-col gap-3">
              {[
                [
                  "0-90 days after close",
                  "Hot: in the live tower, searchable and linkable",
                  "signal",
                ],
                ["After 90 days", "Moved to archive_tickets with a full snapshot", "ice"],
                ["After 12 months", "Cold Parquet in object storage", "beacon"],
                ["After 24 months", "Requester personal data anonymised", "alarm"],
              ].map(([when, what, tone], i) => (
                <motion.li
                  key={when}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-3"
                >
                  <Sign tone={tone as "signal"} className="shrink-0">
                    {i + 1}
                  </Sign>
                  <div>
                    <p className="text-sm">{when}</p>
                    <p className="text-text-dim text-[13px]">{what}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
            <button
              className="btn mt-5"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              <Archive size={14} /> Run archive now
            </button>
            {archive.data && (
              <p className="text-signal mt-2 font-mono text-[12px]">
                {archive.data.archived} flights archived · {archive.data.policy}
              </p>
            )}
          </Hud>

          <Hud title="How this scales">
            <ol className="flex flex-col gap-2">
              {STEPS.map(([name, why], i) => (
                <motion.li
                  key={name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <span className="bg-night text-taxi grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px]">
                    {i + 1}
                  </span>
                  <span className="text-sm">{name}</span>
                  <span className="text-text-dim text-[12px]">· {why}</span>
                </motion.li>
              ))}
            </ol>
          </Hud>
        </div>
      </div>
    </div>
  );
}
