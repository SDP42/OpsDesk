"use client";

/**
 * Tower Radio: chatbot + push-to-talk voice assistant for every persona.
 * Speech in and out use the browser's built-in Web Speech API (free, no API key);
 * we pick the most natural voice the device offers (neural / enhanced first).
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Mic, MicOff, Radio, Send, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SLA_COLOR } from "@/lib/format";

type Answer = Schemas["AssistantAnswer"];
interface Msg {
  id: number;
  who: "me" | "tower";
  text: string;
  answer?: Answer;
}

const PREFERRED = [
  /natural/i,
  /neural/i,
  /enhanced/i,
  /premium/i,
  /google uk english female/i,
  /google us english/i,
  /samantha/i,
  /serena/i,
  /daniel/i,
  /karen/i,
  /moira/i,
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const re of PREFERRED) {
    const v = en.find((x) => re.test(x.name));
    if (v) return v;
  }
  return en.find((v) => v.localService) ?? en[0] ?? null;
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function TowerRadio({ persona }: { persona: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const rec = useRef<Recognition | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const suggestions = useQuery({
    queryKey: ["assistant-suggestions"],
    queryFn: async () => unwrap(await api.GET("/api/assistant/suggestions")),
    enabled: open,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      setVoiceName((cur) => cur || pickVoice(list)?.name || "");
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!speakOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find((x) => x.name === voiceName);
      if (v) u.voice = v;
      u.rate = 1.02;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [speakOn, voices, voiceName],
  );

  const ask = useMutation({
    mutationFn: async (vars: { question: string; channel: "text" | "voice" }) =>
      unwrap(await api.POST("/api/assistant/ask", { body: vars })),
    onSuccess: (answer, vars) => {
      setMsgs((m) => [...m, { id: ++seq.current, who: "tower", text: answer.answer, answer }]);
      if (vars.channel === "voice" || speakOn) speak(answer.speak);
    },
    onError: () =>
      setMsgs((m) => [
        ...m,
        { id: ++seq.current, who: "tower", text: "Lost contact with the tower. Try again." },
      ]),
  });

  const send = (question: string, channel: "text" | "voice" = "text") => {
    const q = question.trim();
    if (!q) return;
    setMsgs((m) => [...m, { id: ++seq.current, who: "me", text: q }]);
    setInput("");
    ask.mutate({ question: q, channel });
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, ask.isPending]);

  const toggleMic = () => {
    const W = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setMsgs((m) => [
        ...m,
        {
          id: ++seq.current,
          who: "tower",
          text: "Voice input is not supported in this browser. Chrome, Edge and Safari support it.",
        },
      ]);
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    window.speechSynthesis?.cancel();
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        text += res[0]!.transcript;
        if (res.isFinal) finalText = text;
      }
      setInput(text);
    };
    r.onend = () => {
      setListening(false);
      if (finalText) send(finalText, "voice");
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <>
      <motion.button
        data-tour="radio"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="bg-night fixed right-5 bottom-5 z-[65] flex items-center gap-2.5 rounded-full py-3 pr-5 pl-3 text-white shadow-[var(--shadow-lift)]"
        aria-expanded={open}
        aria-label="Open Tower Radio assistant"
      >
        <span className="bg-taxi text-night relative grid size-8 place-items-center rounded-full">
          <Radio size={16} />
          <span className="animate-blip border-taxi absolute inset-0 rounded-full border-2" />
        </span>
        <span className="font-mono text-[12px] tracking-wider uppercase">Tower Radio</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label="Tower Radio"
            className="border-line bg-ink-900 fixed right-5 bottom-24 z-[66] flex h-[min(620px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[24px] border shadow-[var(--shadow-lift)]"
          >
            <header className="bg-night flex items-center justify-between px-5 py-4 text-white">
              <div>
                <p className="text-taxi font-mono text-[11px] tracking-[0.14em] uppercase">
                  Tower Radio · 118.40
                </p>
                <p className="display mt-0.5 text-2xl">Ask the tower anything</p>
                <p className="text-[12px] text-white/60">Answers tuned for the {persona}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-white/70 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 && (
                <div>
                  <p className="text-text-dim text-sm">
                    Type or hold the mic and speak. Try one of these:
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {(suggestions.data ?? []).map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="border-line bg-ink-800 hover:border-night rounded-xl border px-3 py-2 text-left text-sm transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", m.who === "me" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                      m.who === "me" ? "bg-night text-white" : "border-line bg-ink-800 border",
                    )}
                  >
                    {m.text}
                    {m.answer?.cards && m.answer.cards.length > 0 && (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {m.answer.cards.slice(0, 4).map((c) => (
                          <Link
                            key={c.number}
                            href={c.href}
                            className="border-line bg-ink-900 hover:border-night flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                          >
                            <span
                              className="h-6 w-1 rounded-full"
                              style={{ background: SLA_COLOR[c.sla_state] ?? "var(--color-line)" }}
                            />
                            <span className="min-w-0">
                              <span className="block font-mono text-[12px] font-semibold">
                                {c.number}
                              </span>
                              <span className="text-text-dim block truncate text-[12px]">
                                {c.title}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {m.answer && (
                      <p className="text-text-dim mt-2 font-mono text-[10px]">
                        understood: {m.answer.understood}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
              {ask.isPending && (
                <div className="text-text-dim flex items-center gap-2 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Tower is checking…
                </div>
              )}
            </div>

            <div className="border-line border-t p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSpeakOn((s) => !s)}
                  className="text-text-dim hover:text-text flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase"
                >
                  {speakOn ? <Volume2 size={12} /> : <VolumeX size={12} />} Voice replies{" "}
                  {speakOn ? "on" : "off"}
                </button>
                {voices.length > 0 && (
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="border-line bg-ink-800 max-w-[55%] truncate rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                    aria-label="Voice"
                  >
                    {voices
                      .filter((v) => v.lang.toLowerCase().startsWith("en"))
                      .map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Stop listening" : "Speak to the tower"}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center rounded-full transition",
                    listening ? "bg-alarm text-white" : "bg-taxi text-night hover:brightness-95",
                  )}
                >
                  {listening && (
                    <span className="animate-blip border-alarm absolute inset-0 rounded-full border-2" />
                  )}
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    listening ? "Listening…" : "Ask about a flight, booking or your queue"
                  }
                  className="field !rounded-full !py-2.5"
                  aria-label="Question"
                />
                <button
                  className="bg-night grid size-10 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
                  disabled={!input.trim() || ask.isPending}
                  aria-label="Send"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
