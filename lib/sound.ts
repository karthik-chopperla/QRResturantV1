"use client";

let audioCtx: AudioContext | null = null;
let unlocked = false;
let cachedAudio: HTMLAudioElement | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function getNotificationAudio(): HTMLAudioElement {
  if (!cachedAudio) {
    cachedAudio = new Audio("/notification.mp3");
    cachedAudio.preload = "auto";
    cachedAudio.volume = 0.6;
  }
  return cachedAudio;
}

export async function unlockAudio() {
  if (unlocked) return;
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();
    // Preload the audio file
    getNotificationAudio().load();
    unlocked = true;
  } catch {}
}

function playNotificationSound() {
  if (!unlocked) return;
  try {
    const audio = getNotificationAudio();
    // Clone the audio to allow overlapping plays
    const clone = audio.cloneNode(true) as HTMLAudioElement;
    clone.volume = 0.6;
    clone.play().catch(() => {});
  } catch {}
}

export function playDoorbell() {
  playNotificationSound();
}

export function playNewOrder() {
  playNotificationSound();
}
