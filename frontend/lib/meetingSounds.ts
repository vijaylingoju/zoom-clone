let audioCtx: AudioContext | null = null;

async function getContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Call after a user gesture so notification tones are allowed to play. */
export function primeMeetingSounds(): void {
  void getContext();
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.12): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Two-note chime when someone joins (Zoom-style). */
export async function playJoinSound(): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 523.25, t, 0.16);
  tone(ctx, 659.25, t + 0.11, 0.2);
}

/** Soft ding for an incoming chat message. */
export async function playChatSound(): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 784, t, 0.1, 0.09);
  tone(ctx, 988, t + 0.07, 0.12, 0.07);
}

/** Short chirp when someone raises their hand. */
export async function playHandSound(): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 440, t, 0.09, 0.1);
  tone(ctx, 587, t + 0.07, 0.11, 0.09);
  tone(ctx, 740, t + 0.14, 0.12, 0.08);
}
