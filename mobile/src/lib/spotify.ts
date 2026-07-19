/* Connexion Spotify + « ajouter les coups de cœur à une playlist ».
   Tout est côté client (OAuth PKCE, pas de backend, pas de client secret).
   L'utilisateur connecte son Spotify une fois ; ensuite chaque titre aimé
   est ajouté à sa playlist « Zicmu — Mes découvertes ».

   Robuste : sans Client ID configuré, ou hors-ligne, tout est no-op —
   l'app marche normalement sans la fonctionnalité. */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { Track } from "./catalog";

// Sur web : quand Spotify redirige la fenêtre de connexion vers le site,
// cet appel referme la fenêtre et transmet le résultat à l'app. No-op ailleurs.
WebBrowser.maybeCompleteAuthSession();

// Client ID public de l'app Spotify (safe à embarquer — le flux PKCE n'utilise
// pas de secret). Dashboard : developer.spotify.com/dashboard → Zicmu → Settings
const SPOTIFY_CLIENT_ID = "3a38f3ac3e0c41e896f2a0c230b3aa46";

export const spotifyReady = SPOTIFY_CLIENT_ID.length > 0;

/** Où la connexion Spotify est-elle possible ?
    - Site web (zicmu.expo.app) : OUI — redirection https enregistrée au dashboard.
    - Vraie app installée (build EAS) : OUI — via zicmu://spotify-callback.
    - Expo Go : NON (vit sur son propre scheme exp://, Spotify ne peut pas y revenir). */
export const spotifyNeedsBuild =
  Platform.OS !== "web" && Constants.executionEnvironment === "storeClient";

const SCOPES = ["playlist-modify-private", "playlist-modify-public"];
const PLAYLIST_NAME = "Zicmu — Mes découvertes";
const STORAGE_KEY = "tune-spotify-v1";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

// Web : l'adresse de retour DOIT être exactement celle enregistrée au dashboard
// Spotify (https://zicmu.expo.app) — donc la connexion web ne marche qu'en prod,
// pas sur localhost. Natif : le scheme de l'app.
const redirectUri =
  Platform.OS === "web"
    ? "https://zicmu.expo.app"
    : AuthSession.makeRedirectUri({ scheme: "zicmu", path: "spotify-callback" });

interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // ms epoch
  playlistId?: string;
}

let session: Session | null = null;
let loaded = false;

/* --- état réactif (bouton Profil) --- */
const subs = new Set<() => void>();
let connectedSnapshot = false;
function emit() {
  connectedSnapshot = !!session;
  subs.forEach(fn => fn());
}
export function useSpotifyConnected(): boolean {
  return useSyncExternalStore(
    fn => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => connectedSnapshot,
    () => connectedSnapshot
  );
}

async function persist() {
  if (typeof window === "undefined") return;
  try {
    if (session) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      session = JSON.parse(raw);
      emit();
    }
  } catch {}
}
// tente de restaurer la session au démarrage
ensureLoaded();

/* --- token valide (refresh si expiré) --- */
async function validToken(): Promise<string | null> {
  await ensureLoaded();
  if (!session) return null;
  if (Date.now() < session.expiresAt - 60_000) return session.accessToken;
  if (!session.refreshToken) return null;
  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId: SPOTIFY_CLIENT_ID, refreshToken: session.refreshToken },
      discovery
    );
    session = {
      ...session,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
    };
    await persist();
    return session.accessToken;
  } catch {
    return null;
  }
}

async function api<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T | null> {
  // timeout dur : un appel Spotify ne doit jamais pendre indéfiniment
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!r.ok) return null;
    if (r.status === 204) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(deadline);
  }
}

/* --- connexion / déconnexion --- */

export function isSpotifyConnected(): boolean {
  return !!session;
}

export async function connectSpotify(): Promise<boolean> {
  if (!spotifyReady) return false;
  try {
    const request = new AuthSession.AuthRequest({
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });
    await request.makeAuthUrlAsync(discovery);
    const result = await request.promptAsync(discovery);
    if (result.type !== "success" || !result.params.code) return false;

    const token = await AuthSession.exchangeCodeAsync(
      {
        clientId: SPOTIFY_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? "" },
      },
      discovery
    );
    session = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + (token.expiresIn ?? 3600) * 1000,
    };
    await persist();
    emit();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectSpotify() {
  session = null;
  await persist();
  emit();
}

/* --- ajout d'un titre aimé à la playlist « Zicmu » --- */

async function ensurePlaylist(token: string): Promise<string | null> {
  if (session?.playlistId) return session.playlistId;
  // ⚠️ POST /me/playlists obligatoirement : l'ancienne route
  // /users/{id}/playlists renvoie 403 Forbidden en mode développement.
  const created = await api<{ id: string }>(token, `/me/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: PLAYLIST_NAME,
      public: false,
      description: "Mes découvertes swipées sur Zicmu 🎧",
    }),
  });
  if (!created?.id) return null;
  if (session) {
    session.playlistId = created.id;
    await persist();
  }
  return created.id;
}

/** Retrouve le titre sur Spotify (nos titres viennent de Deezer → match
    par artiste + titre) et l'ajoute à la playlist. Best effort, silencieux. */
export async function addLikedToSpotify(track: Track): Promise<void> {
  if (!spotifyReady) return;
  const token = await validToken();
  if (!token) return;

  const q = encodeURIComponent(`track:${track.title} artist:${track.artist}`);
  const found = await api<{ tracks?: { items?: { uri: string }[] } }>(
    token,
    `/search?q=${q}&type=track&limit=1`
  );
  let uri = found?.tracks?.items?.[0]?.uri;
  if (!uri) {
    // repli : recherche libre si la requête structurée ne donne rien
    const q2 = encodeURIComponent(`${track.title} ${track.artist}`);
    const loose = await api<{ tracks?: { items?: { uri: string }[] } }>(
      token,
      `/search?q=${q2}&type=track&limit=1`
    );
    uri = loose?.tracks?.items?.[0]?.uri;
  }
  if (!uri) return;

  const playlistId = await ensurePlaylist(token);
  if (!playlistId) return;

  // ⚠️ Route /items obligatoirement : Spotify a remplacé /tracks (qui renvoie
  // désormais 403 Forbidden) par /items en février.
  await api(token, `/playlists/${playlistId}/items`, {
    method: "POST",
    body: JSON.stringify({ uris: [uri] }),
  });
}
