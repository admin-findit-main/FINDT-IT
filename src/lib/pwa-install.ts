"use client";

import { useEffect, useState } from "react";

/**
 * Chromium `beforeinstallprompt` is not in every TS lib.
 * We only use the bits we need.
 */
export type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = () => void;

let deferredPrompt: PwaInstallPromptEvent | null = null;
let captured = false;
let installedThisSession = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Listener failures must not break install capture.
    }
  });
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as PwaInstallPromptEvent;
  notify();
}

function onAppInstalled() {
  installedThisSession = true;
  deferredPrompt = null;
  notify();
}

/** Call once from a root client component. Safe to call repeatedly. */
export function capturePwaInstallEvents() {
  if (typeof window === "undefined") return;
  if (captured) return;
  captured = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
}

export function hasPwaInstallPrompt(): boolean {
  return Boolean(deferredPrompt);
}

export function wasPwaInstalledThisSession(): boolean {
  return installedThisSession;
}

export function subscribePwaInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type PwaInstallResult = "accepted" | "dismissed" | "unavailable";

/** Must be called from a user gesture (button tap). */
export async function promptPwaInstall(): Promise<PwaInstallResult> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      installedThisSession = true;
      notify();
      return "accepted";
    }
    return "dismissed";
  } catch (err) {
    console.error("[FINDIT] PWA install prompt failed", err);
    return "unavailable";
  }
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    capturePwaInstallEvents();
    const sync = () => {
      setCanInstall(hasPwaInstallPrompt());
      setInstalled(wasPwaInstalledThisSession());
    };
    sync();
    return subscribePwaInstall(sync);
  }, []);

  return { canInstall, installed, promptInstall: promptPwaInstall };
}
