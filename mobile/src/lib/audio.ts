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
/** File de lecture du mini-player (enchaînement auto en fin d'extrait) */
let miniQueue: Track[] = [];
let previewOffset = 0;
let fallbackStartTs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let autoplay = false;
/** Comptabilise le temps d'écoute (stats du profil) — branché par le store */
let onListenChunk: ((seconds: number) => void) | null = null;

export function setOnListenChunk(cb: ((seconds: number) => void) | null) {
  onListenChunk = cb;
}

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
  // en fin de piste, currentTime peut être NaN (web) : on l'ignore alors
  const t = Number.isFinite(player.currentTime) ? player.currentTime : 0;
  const playerElapsed = Math.max(0, t - previewOffset);
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

/** naturalEnd : fin d'extrait (30 s ou fichier terminé) → enchaîne le
    mini-player, contrairement à un stop manuel (pause, changement de titre). */
export function stopPlayback(naturalEnd = false) {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  removeStatusSubscription();
  // stats d'écoute : on crédite le temps écouté de cette session de lecture.
  // En fin d'extrait, player.currentTime peut déjà être retombé à 0 : on
  // prend l'horloge murale comme plancher (on ne met jamais en pause sans stop).
  const wall = playingId && fallbackStartTs ? (Date.now() - fallbackStartTs) / 1000 : 0;
  const listened = Math.min(Math.max(currentElapsed(), wall), PREVIEW_SECONDS);
  if (listened >= 1 && onListenChunk) onListenChunk(listened);
  fallbackStartTs = 0;
  const wasMini = naturalEnd && miniTrackId !== null && playingId === miniTrackId;
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
  if (wasMini) advanceMiniQueue();
}

function handleStatus(status: AudioStatus) {
  if (!player || !playingId) return;

  if (status.duration > 0 && previewOffset >= status.duration) {
    previewOffset = 0;
    player.seekTo(0).catch(() => {});
  }

  if (status.didJustFinish || currentElapsed() >= PREVIEW_SECONDS) {
    stopPlayback(true);
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
      // coupe à la fin de l'extrait — ou après 60 s d'horloge murale si
      // l'audio est bloqué en buffering (réseau lent), pour ne pas rester
      // en lecture fantôme
      const wallElapsed = (Date.now() - fallbackStartTs) / 1000;
      if (currentElapsed() >= PREVIEW_SECONDS || wallElapsed >= PREVIEW_SECONDS * 2) {
        stopPlayback(true);
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

export function playInMini(track: Track, queue: Track[] = []) {
  miniTrackId = track.id;
  if (queue.length) miniQueue = queue;
  void playTrack(track);
}

/** Titre suivant de la file (bouton ⏭ et enchaînement auto). */
export function advanceMiniQueue() {
  if (!miniQueue.length || !miniTrackId) return;
  const i = miniQueue.findIndex(t => t.id === miniTrackId);
  const next = miniQueue[(i + 1) % miniQueue.length];
  if (!next || next.id === miniTrackId) return;
  playInMini(next, miniQueue);
}

export function hideMini() {
  if (miniTrackId && playingId === miniTrackId) stopPlayback();
  miniTrackId = null;
  miniQueue = [];
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
