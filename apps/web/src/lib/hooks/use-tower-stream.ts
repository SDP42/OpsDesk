"use client";

/**
 * Live feed over SSE (/api/stream). Invalidates ticket queries on any change
 * and raises a tower call for creations, escalations and SLA state changes.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTowerCalls } from "@/lib/stores/tower-calls";

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export function useTowerStream(enabled = true) {
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<StreamEvent | null>(null);
  const recent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined;

    const invalidate = () => {
      clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["tickets"] });
        void qc.invalidateQueries({ queryKey: ["overview"] });
      }, 250);
    };

    const handle = (name: string) => (e: MessageEvent<string>) => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(e.data) as Record<string, unknown>;
      } catch {
        /* ignore malformed */
      }
      setLast({ event: name, data });
      const id = typeof data.id === "string" ? data.id : undefined;
      if (id) {
        recent.current.add(id);
        setTimeout(() => recent.current.delete(id), 1500);
        void qc.invalidateQueries({ queryKey: ["ticket", id] });
      }
      const number = String(data.number ?? "");
      if (name === "ticket.created") {
        push({
          callsign: number,
          message: `VECTORED > ${String(data.owner ?? "TRIAGE")}`,
          tone: "signal",
        });
      } else if (name === "escalation") {
        push({
          callsign: number,
          message: `ESCALATED > TOWER CHIEF ${String(data.to ?? "")}`,
          tone: "alarm",
        });
      } else if (name === "guardian") {
        push({ callsign: number, message: "THIRD CONTACT · PRIORITY RAISED", tone: "amber" });
      } else if (
        name === "ticket.updated" &&
        data.change === "sla" &&
        data.sla_state === "breached"
      ) {
        push({ callsign: number, message: "WHEELS-UP CLOCK BREACHED", tone: "alarm" });
      }
      if (name !== "hello" && name !== "sla.tick") invalidate();
      if (name === "sla.tick") invalidate();
    };

    const connect = () => {
      source = new EventSource(`${API_BASE}/stream`, { withCredentials: true });
      source.onopen = () => setConnected(true);
      source.onerror = () => {
        setConnected(false);
        source?.close();
        retry = setTimeout(connect, 3000);
      };
      for (const name of [
        "hello",
        "ticket.created",
        "ticket.updated",
        "sla.tick",
        "escalation",
        "guardian",
      ]) {
        source.addEventListener(name, handle(name) as EventListener);
      }
    };
    connect();
    return () => {
      clearTimeout(retry);
      clearTimeout(invalidateTimer);
      source?.close();
    };
  }, [enabled, qc, push]);

  return { connected, last, isFresh: (id: string) => recent.current.has(id) };
}
