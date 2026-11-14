"use client";

/**
 * Progressive frame loader for scroll-scrubbed sequences: every 4th frame first,
 * then the gaps. The scrubber draws the nearest frame that has loaded.
 */
export interface SequenceManifest {
  id: string;
  count: number;
  width: number;
  height: number;
  pattern: string;
  pad: number;
  blur: string;
}

let manifestPromise: Promise<SequenceManifest[]> | null = null;

export function loadManifest(): Promise<SequenceManifest[]> {
  manifestPromise ??= fetch("/frames/manifest.json")
    .then((r) => (r.ok ? r.json() : { sequences: [] }))
    .then((m: { sequences: SequenceManifest[] }) => m.sequences)
    .catch(() => []);
  return manifestPromise;
}

export function frameUrl(seq: SequenceManifest, index: number): string {
  return seq.pattern.replace("{i}", String(index + 1).padStart(seq.pad, "0"));
}

export class FrameStore {
  readonly images: (HTMLImageElement | null)[];
  private loaded = 0;
  private listeners = new Set<(ratio: number) => void>();

  constructor(readonly seq: SequenceManifest) {
    this.images = Array.from({ length: seq.count }, () => null);
  }

  get ratio(): number {
    return this.loaded / this.seq.count;
  }

  onProgress(cb: (ratio: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Load `first` frames eagerly (strided), then everything else. Resolves after the eager set. */
  async load(first = 24): Promise<void> {
    const order: number[] = [];
    for (let i = 0; i < this.seq.count; i += 4) order.push(i);
    for (let i = 0; i < this.seq.count; i++) if (i % 4 !== 0) order.push(i);
    const eager = order.slice(0, first);
    const rest = order.slice(first);
    await Promise.all(eager.map((i) => this.fetch(i)));
    void (async () => {
      for (let k = 0; k < rest.length; k += 6) await Promise.all(rest.slice(k, k + 6).map((i) => this.fetch(i)));
    })();
  }

  private fetch(i: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.images[i] = img;
        this.loaded++;
        this.listeners.forEach((l) => l(this.ratio));
        resolve();
      };
      img.onerror = () => resolve();
      img.src = frameUrl(this.seq, i);
    });
  }

  nearest(index: number): HTMLImageElement | null {
    const i = Math.max(0, Math.min(this.seq.count - 1, Math.round(index)));
    for (let d = 0; d < this.seq.count; d++) {
      const a = this.images[i - d];
      if (a) return a;
      const b = this.images[i + d];
      if (b) return b;
    }
    return null;
  }
}

const stores = new Map<string, FrameStore>();

export async function getStore(id: string): Promise<FrameStore | null> {
  const seqs = await loadManifest();
  const seq = seqs.find((s) => s.id === id);
  if (!seq) return null;
  if (!stores.has(id)) stores.set(id, new FrameStore(seq));
  return stores.get(id)!;
}
