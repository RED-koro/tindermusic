/* Moteur de lecture des extraits (30 s max).
   - Titres du catalogue : assets pré-générés (assets/previews/*.m4a)
   - Titres publiés par un artiste : leur vrai fichier importé */

import {
  AudioPlayer,
  AudioSource,
  AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from "expo-audio";
import { EventSubscription } from "expo-modules-core";
import { useSyncExternalStore } from "react";
import { PREVIEW_SECONDS, Track } from "./catalog";
import { refreshPreviewUrl } from "./deezer";

export interface PlaybackSnapshot {
  playingId: string | null;
  elapsed: number;
  ratio: number;
  miniTrackId: string | null;
}

let player: AudioPlayer | null = null;
let statusSubscription: EventSubscription | null = null;
let playingId: string | null = null;
let miniTrackId: string | null = null;
let previewOffset = 0;
let fallbackStartTs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let autoplay = false;

let snapshot: PlaybackSnapshot = {
  playingId: null,
  elapsed: 0,
  ratio: 0,
  miniTrackId: null,
};
const subscribers = new Set<() => void>();

// iOS : jouer même quand le téléphone est en mode silencieux
const audioModeReady = setAudioModeAsync({
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
}).catch(() => {});

async function ensureAudioReady() {
  await audioModeReady;
  await setIsAudioActiveAsync(true).catch(() => {});
}

function currentElapsed() {
  if (!playingId || !player) return 0;
  const playerElapsed = Math.max(0, player.currentTime - previewOffset);
  if (playerElapsed > 0 || player.playing) return playerElapsed;
  return Math.max(0, (Date.now() - fallbackStartTs) / 1000);
}

function emit() {
  const elapsed = currentElapsed();
  snapshot = {
    playingId,
    elapsed,
    ratio: Math.min(elapsed / PREVIEW_SECONDS, 1),
    miniTrackId,
  };
  subscribers.forEach(fn => fn());
}

// URLs d'extraits Deezer déjà rafraîchies pendant cette session
const freshPreviews = new Map<string, string>();

async function sourceFor(track: Track): Promise<AudioSource | null> {
  if (track.deezer) {
    // les URLs d'extraits Deezer expirent : on prend une URL fraîche
    const cached = freshPreviews.get(track.id);
    if (cached) return { uri: cached };
    const fresh = await refreshPreviewUrl(track.id);
    const url = fresh || track.previewUrl;
    if (!url) return null;
    freshPreviews.set(track.id, url);
    return { uri: url };
  }
  if (track.custom && track.audioUri) return { uri: track.audioUri };
  return null;
}

function removeStatusSubscription() {
  statusSubscription?.remove();
  statusSubscription = null;
}

export function stopPlayback() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  removeStatusSubscription();
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {}
    player = null;
  }
  playingId = null;
  previewOffset = 0;
  emit();
}

function handleStatus(status: AudioStatus) {
  if (!player || !playingId) return;

  if (status.duration > 0 && previewOffset >= status.duration) {
    previewOffset = 0;
    player.seekTo(0).catch(() => {});
  }

  if (status.didJustFinish || currentElapsed() >= PREVIEW_SECONDS) {
    stopPlayback();
    return;
  }

  emit();
}

let playRequestId = 0;

export async function playTrack(track: Track) {
  const requestId = ++playRequestId;
  stopPlayback();
  const source = await sourceFor(track);
  // une autre lecture a été demandée pendant le rafraîchissement de l'URL
  if (requestId !== playRequestId) return;
  if (source == null) return;

  try {
    await ensureAudioReady();
    const nextPlayer = createAudioPlayer(source, {
      updateInterval: 200,
      keepAudioSessionActive: true,
    });

    player = nextPlayer;
    player.muted = false;
    player.volume = 1;
    previewOffset = Math.max(0, track.previewStart || 0);
    playingId = track.id;
    fallbackStartTs = Date.now();

    statusSubscription = player.addListener("playbackStatusUpdate", handleStatus);

    if (previewOffset > 0) {
      try {
        await player.seekTo(previewOffset);
      } catch {
        previewOffset = 0;
      }
    }

    player.play();
    timer = setInterval(() => {
      if (currentElapsed() >= PREVIEW_SECONDS) {
        stopPlayback();
        return;
      }
      emit();
    }, 200);
    emit();
  } catch {
    stopPlayback();
  }
}

export function togglePlayback(track: Track) {
  if (playingId === track.id) stopPlayback();
  else void playTrack(track);
}

export function isPlaying(id: string) {
  return playingId === id;
}

/** Secondes écoutées du titre en cours (0 si pas en lecture) —
    utilisé par l'algo pour pondérer le signal d'un swipe. */
export function getCurrentElapsed(trackId: string): number {
  return playingId === trackId ? snapshot.elapsed : 0;
}

/* --- Mini-player (bibliothèque, recherche, profil, espace artiste) --- */

export function playInMini(track: Track) {
  miniTrackId = track.id;
  void playTrack(track);
}

export function hideMini() {
  if (miniTrackId && playingId === miniTrackId) stopPlayback();
  miniTrackId = null;
  emit();
}

/* --- Enchaînement auto dans Découvrir après le premier play manuel --- */

export function setAutoplay(v: boolean) {
  autoplay = v;
}
export function getAutoplay() {
  return autoplay;
}

/* --- Hook React --- */

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function usePlayback(): PlaybackSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
