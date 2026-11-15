"use client";

/**
 * Cmd-K command palette (skeleton): jump to a flight by callsign or TBOH,
 * navigate between screens, toggle the radar ping. Ask-the-Tower NLQ plugs in later.
 */
import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { useTowerCalls } from "@/lib/stores/tower-calls";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

export function CommandPalette({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const toggleSound = useTowerCalls((s) => s.toggleSound);
  const inputRef = useRef<HTMLInputElement>(null);
  const [asked, setAsked] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setAsked(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const isPhrase =
    role !== "requester" && asked.split(/\s+/).length >= 2 && !/^(OD|TBOH)-?\d/i.test(asked);
  const nlq = useQuery({
    queryKey: ["nlq", asked],
    queryFn: async () => unwrap(await api.GET("/api/nlq", { params: { query: { q: asked } } })),
    enabled: open && isPhrase,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("opsdesk:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("opsdesk:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const commands = useMemo<Command[]>(() => {
    const q = query.trim().toUpperCase();
    const out: Command[] = [];
    if (isPhrase && nlq.data && nlq.data.chips.length > 0) {
      const params = new URLSearchParams({ ask: asked, ...nlq.data.filters });
      out.push({
        id: "ask",
        label: `Show flights: ${nlq.data.chips.map((c) => c.label).join(" · ")}`,
        hint: "ask the tower",
        run: () => go(`/tower/queue?${params.toString()}`),
      });
    }
    if (/^OD-?\d{3,}$/.test(q)) {
      const n = q.startsWith("OD-") ? q : `OD-${q.slice(2)}`;
      out.push({
        id: "jump",
        label: `Jump to flight ${n}`,
        hint: "callsign",
        run: () => go(`/tower/t/${n}`),
      });
    } else if (/^\d{4,6}$/.test(q)) {
      out.push({
        id: "jump",
        label: `Jump to flight OD-${q}`,
        hint: "callsign",
        run: () => go(`/tower/t/OD-${q}`),
      });
    }
    if (/^TBOH-?\d{3,}$/.test(q)) {
      const t = q.startsWith("TBOH-") ? q : `TBOH-${q.slice(4)}`;
      out.push({
        id: "tboh",
        label: `Flights on booking ${t}`,
        hint: "TBOH",
        run: () => go(`/tower/queue?tboh=${t}`),
      });
    }
    const nav: Command[] =
      role === "requester"
        ? [{ id: "pilot", label: "Flight board", hint: "go", run: () => go("/pilot") }]
        : [
            { id: "tower", label: "Tower overview", hint: "go", run: () => go("/tower") },
            { id: "queue", label: "My queue", hint: "go", run: () => go("/tower/queue") },
            {
              id: "triage",
              label: "Triage (unassigned)",
              hint: "go",
              run: () => go("/tower/triage"),
            },
            {
              id: "esc",
              label: "Escalation queue",
              hint: "go",
              run: () => go("/tower/escalations"),
            },
            ...(
              [
                ["ghosts", "Ghost flights (predicted tickets)", "/tower/ghosts"],
                ["storms", "Storm cells (incidents)", "/tower/storms"],
                ["roster", "Crew roster (HRMS leave)", "/tower/roster"],
                ["suppliers", "Supplier scorecard", "/tower/suppliers"],
                ["insights", "Weather radar (themes)", "/tower/insights"],
                ["data", "Black box (exports)", "/tower/data"],
                ["simulate", "Routing simulator", "/tower/simulate"],
                ["wall", "Wall mode (ops-floor TV)", "/wall"],
              ] as const
            ).map(([id, label, href]) => ({ id, label, hint: "go", run: () => go(href) })),
          ];
    nav.push({
      id: "sound",
      label: "Toggle radar ping sound",
      hint: "action",
      run: () => {
        toggleSound();
        setOpen(false);
      },
    });
    nav.push({ id: "home", label: "Landing page", hint: "go", run: () => go("/") });
    const filtered = nav.filter((c) => !q || c.label.toUpperCase().includes(q));
    return [...out, ...filtered];
  }, [query, role, go, toggleSound, isPhrase, nlq.data, asked]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      commands[index]?.run();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="bg-ink-950/70 fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-label="Command palette"
            className="hud w-full max-w-xl"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="hud-tr" aria-hidden />
            <span className="hud-bl" aria-hidden />
            <div className="border-line flex items-center gap-3 border-b px-4">
              <span className="text-signal font-mono">›</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Callsign, TBOH, command, or ask: breached P1 refunds in UAE this week"
                className="placeholder:text-text-dim h-12 flex-1 bg-transparent font-mono text-sm outline-none"
                aria-label="Command"
              />
              <kbd className="micro">esc</kbd>
            </div>
            {isPhrase && nlq.data && (
              <div className="border-line flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
                {nlq.data.chips.map((c) => (
                  <span key={c.key + c.value} title={`from “${c.because}”`} className="sign">
                    {c.label}
                  </span>
                ))}
                <span className="micro w-full pt-1">{nlq.data.reason}</span>
              </div>
            )}
            <ul className="max-h-80 overflow-auto py-1" role="listbox">
              {commands.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === index}>
                  <button
                    onMouseEnter={() => setIndex(i)}
                    onClick={c.run}
                    className={clsx(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm",
                      i === index ? "bg-ink-800 text-text" : "text-text-dim",
                    )}
                  >
                    {c.label}
                    <span className="micro">{c.hint}</span>
                  </button>
                </li>
              ))}
              {commands.length === 0 && (
                <li className="text-text-dim px-4 py-6 text-center text-sm">
                  No match on this frequency.
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
