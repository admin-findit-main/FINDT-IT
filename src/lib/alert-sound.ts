type AlertKind = "hub" | "customer";

let unlocked = false;
let listenersBound = false;
let audioCtx: AudioContext | null = null;
let hubAudio: HTMLAudioElement | null = null;
let customerAudio: HTMLAudioElement | null = null;
let pendingKind: AlertKind | null = null;
let wavCache: Partial<Record<AlertKind, string>> = {};

function encodeWavBeep(input: {
  seconds: number;
  startHz: number;
  endHz: number;
  volume: number;
}): string {
  const sampleRate = 16000;
  const n = Math.max(1, Math.floor(sampleRate * input.seconds));
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 280) * Math.min(1, (n - i) / 900);
    const freq = input.startHz + ((input.endHz - input.startHz) * i) / n;
    const sample = Math.round(
      Math.sin(2 * Math.PI * freq * t) * env * input.volume * 32767
    );
    view.setInt16(44 + i * 2, sample, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function wavFor(kind: AlertKind): string {
  const cached = wavCache[kind];
  if (cached) return cached;
  const next =
    kind === "hub"
      ? encodeWavBeep({ seconds: 0.55, startHz: 880, endHz: 1320, volume: 0.92 })
      : encodeWavBeep({ seconds: 0.32, startHz: 980, endHz: 1180, volume: 0.55 });
  wavCache[kind] = next;
  return next;
}

function audioFor(kind: AlertKind): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (kind === "hub") {
    if (!hubAudio) {
      hubAudio = new Audio(wavFor("hub"));
      hubAudio.preload = "auto";
    }
    return hubAudio;
  }
  if (!customerAudio) {
    customerAudio = new Audio(wavFor("customer"));
    customerAudio.preload = "auto";
  }
  return customerAudio;
}

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctor();
  }
  return audioCtx;
}

async function resumeAudioCtx(): Promise<void> {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
}

function nativeHubBeep(): boolean {
  const bridge = (
    window as unknown as { FinditHub?: { beep?: () => void } }
  ).FinditHub;
  if (typeof bridge?.beep !== "function") return false;
  try {
    bridge.beep();
    return true;
  } catch {
    return false;
  }
}

function vibrate(kind: AlertKind) {
  try {
    navigator.vibrate?.(kind === "hub" ? [220, 80, 220, 80, 420] : [180, 60, 180]);
  } catch {
    // Some WebViews throw if vibrate is blocked.
  }
}

function playOscillator(kind: AlertKind) {
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind === "hub" ? "square" : "triangle";
  if (kind === "hub") {
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.34);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.stop(now + 0.52);
  } else {
    osc.frequency.setValueAtTime(1040, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.stop(now + 0.26);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
}

let lastPlayAt = 0;

async function playKind(kind: AlertKind): Promise<void> {
  const now = Date.now();
  if (now - lastPlayAt < 900) return;
  lastPlayAt = now;
  vibrate(kind);
  if (kind === "hub" && nativeHubBeep()) return;
  await resumeAudioCtx();
  const el = audioFor(kind);
  if (el) {
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = kind === "hub" ? 1 : 0.8;
      await el.play();
    } catch {
      playOscillator(kind);
    }
  } else {
    playOscillator(kind);
  }
}

async function unlockFromGesture(): Promise<void> {
  unlocked = true;
  // Resume the audio context only. Do not play a chirp — shoppers should hear
  // nothing until a store answers, and Hub only chimes on a new Find.
  await resumeAudioCtx();
  if (pendingKind) {
    const kind = pendingKind;
    pendingKind = null;
    await playKind(kind);
  }
}

/** Call once from Hub / shopper shells so the first tap can enable sound. */
export function armAlertSoundUnlock(): void {
  if (typeof window === "undefined" || listenersBound) return;
  listenersBound = true;
  const onGesture = () => {
    void unlockFromGesture();
  };
  window.addEventListener("pointerdown", onGesture, { capture: true });
  window.addEventListener("keydown", onGesture, { capture: true });
  window.addEventListener("touchstart", onGesture, { capture: true });
}

export function playHubAlert(): void {
  if (typeof window === "undefined") return;
  armAlertSoundUnlock();
  if (!unlocked) {
    pendingKind = "hub";
    // Native Hub WebView can beep without a gesture. Browsers wait for unlock.
    if (nativeHubBeep()) {
      pendingKind = null;
    }
    return;
  }
  void playKind("hub");
}

export function playCustomerAlert(): void {
  if (typeof window === "undefined") return;
  armAlertSoundUnlock();
  if (!unlocked) {
    pendingKind = "customer";
    return;
  }
  void playKind("customer");
}
