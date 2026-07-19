/* État global de Zicmu : buckets (aimés / à revoir / pas pour moi), scores de
   genres et d'artistes (l'« algo » v2), bibliothèque. Persisté dans AsyncStorage. */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { setOnListenChunk } from "./audio";
import { Track } from "./catalog";

export type Bucket = "liked" | "later" | "disliked";

interface LastDecision {
  id: string;
  bucket: Bucket;
  genres: string[];
  artist?: string;
  /** delta réellement appliqué (dépend du temps d'écoute) — pour annuler exactement */
  delta?: number;
}

interface ZicmuState {
  liked: string[];
  later: string[];
  disliked: string[];
  genreScores: Record<string, number>;
  /** Algo v2 : affinité par artiste, en plus des genres */
  artistScores: Record<string, number>;
  swipes: number;
  /** Métadonnées des titres Deezer classés (bibliothèque persistante) */
  savedDeezer: Record<string, Track>;
  /** Dernier swipe, pour pouvoir l'annuler */
  lastDecision: LastDecision | null;
  /** Onboarding "choisis tes genres" terminé (amorce l'algo au 1er lancement) */
  onboarded: boolean;
  /** Statistiques d'écoute (profil) */
  stats: { listenSeconds: number };
}

const EMPTY: ZicmuState = {
  liked: [],
  later: [],
  disliked: [],
  genreScores: {},
  artistScores: {},
  swipes: 0,
  savedDeezer: {},
  lastDecision: null,
  onboarded: false,
  stats: { listenSeconds: 0 },
};

const STORAGE_KEY = "tune-state-v1";

interface StoreValue {
  state: ZicmuState;
  hydrated: boolean;
  byId: Record<string, Track>;
  bucketOf: (id: string) => Bucket | null;
  affinity: (track: Track) => number;
  decide: (track: Track, bucket: Bucket, listenSeconds?: number) => void;
  undoLastDecision: () => void;
  /** Rend des titres Deezer (flux, recherche) résolubles via byId le temps de la session */
  registerTracks: (tracks: Track[]) => void;
  /** Retire le titre de tous les buckets (retour dans Découvrir) */
  restore: (id: string) => void;
  /** Bascule aimé <-> non classé (recherche, bibliothèque) */
  toggleLiked: (track: Track) => void;
  moveToLiked: (track: Track) => void;
  completeOnboarding: (genres: string[]) => void;
  resetBuckets: () => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function withoutId(state: ZicmuState, id: string): ZicmuState {
  return {
    ...state,
    liked: state.liked.filter(x => x !== id),
    later: state.later.filter(x => x !== id),
    disliked: state.disliked.filter(x => x !== id),
  };
}

function addScores(
  scores: Record<string, number>,
  keys: string[],
  delta: number
): Record<string, number> {
  const next = { ...scores };
  for (const k of keys) next[k] = Math.round(((next[k] || 0) + delta) * 1000) / 1000;
  return next;
}

/** Oubli progressif : chaque swipe atténue légèrement les goûts anciens
    (−2 % par swipe → un score se réduit de moitié en ~35 swipes). */
function decayScores(scores: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    const d = Math.round(v * 0.98 * 1000) / 1000;
    if (Math.abs(d) >= 0.05) next[k] = d;
  }
  return next;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ZicmuState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);
  // titres Deezer vus pendant la session (flux Découvrir, recherche)
  const [sessionTracks, setSessionTracks] = useState<Record<string, Track>>({});

  const registerTracks = useCallback((tracks: Track[]) => {
    setSessionTracks(prev => {
      const fresh = tracks.filter(t => !prev[t.id]);
      if (fresh.length === 0) return prev;
      const next = { ...prev };
      for (const t of fresh) next[t.id] = t;
      return next;
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        // migration : les utilisateurs qui ont déjà swipé passent l'onboarding
        const onboarded =
          parsed.onboarded ?? ((parsed.swipes || 0) > 0 || (parsed.liked || []).length > 0);
        // bornage du stockage (AsyncStorage est limité, ~6 Mo sur Android) :
        // - la liste des rejetés est plafonnée (les plus vieux peuvent revenir
        //   dans le deck un jour, ce n'est pas un drame)
        // - les métadonnées Deezer ne sont gardées que pour les titres
        //   encore classés quelque part
        const DISLIKED_MAX = 800;
        const disliked: string[] = (parsed.disliked || []).slice(-DISLIKED_MAX);
        const referenced = new Set<string>([
          ...(parsed.liked || []),
          ...(parsed.later || []),
          ...disliked,
        ]);
        const savedDeezer: Record<string, Track> = {};
        for (const [id, t] of Object.entries(parsed.savedDeezer || {})) {
          if (referenced.has(id)) savedDeezer[id] = t as Track;
        }
        setState({ ...EMPTY, ...parsed, onboarded, disliked, savedDeezer });
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // Persistance throttlée : on n'écrit pas le disque à chaque swipe (rafale),
  // mais au plus toutes les 800 ms. Le dernier état est toujours écrit (trailing).
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingState = useRef<ZicmuState | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    pendingState.current = state;
    if (persistTimer.current) return; // une écriture est déjà programmée
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      const s = pendingState.current;
      if (s) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)).catch(() => {});
    }, 800);
  }, [state, hydrated]);

  // filet de sécurité : flush l'état si l'app passe en arrière-plan / se ferme
  useEffect(() => {
    const flush = () => {
      const s = pendingState.current;
      if (s) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)).catch(() => {});
    };
    const sub = AppState.addEventListener("change", st => {
      if (st !== "active") flush();
    });
    return () => sub.remove();
  }, []);

  // le moteur audio crédite ici le temps d'écoute (stats du profil)
  useEffect(() => {
    setOnListenChunk(seconds => {
      setState(prev => ({
        ...prev,
        stats: {
          listenSeconds: Math.round(prev.stats.listenSeconds + seconds),
        },
      }));
    });
    return () => setOnListenChunk(null);
  }, []);

  // résolution d'un titre par son id (mini-player, bibliothèque) : titres vus
  // en session (Deezer) + métadonnées des titres classés persistées.
  const byId = useMemo(
    () => ({ ...sessionTracks, ...state.savedDeezer }),
    [sessionTracks, state.savedDeezer]
  );

  const bucketOf = useCallback(
    (id: string): Bucket | null => {
      if (state.liked.includes(id)) return "liked";
      if (state.later.includes(id)) return "later";
      if (state.disliked.includes(id)) return "disliked";
      return null;
    },
    [state.liked, state.later, state.disliked]
  );

  /** Affinité v2 : genres + artiste (l'artiste pèse plus lourd qu'un genre) */
  const affinity = useCallback(
    (track: Track) =>
      track.genres.reduce((s, g) => s + (state.genreScores[g] || 0), 0) +
      1.5 * (state.artistScores[track.artist] || 0),
    [state.genreScores, state.artistScores]
  );

  /** Décision v2 : le temps d'écoute avant le swipe pondère le signal.
      Liker après 10 s d'écoute vaut plus qu'un like à la pochette ; rejeter
      après 15 s d'écoute est un vrai rejet, rejeter en 2 s un simple passage. */
  const decide = useCallback(
    (track: Track, bucket: Bucket, listenSeconds = 0) => {
      let delta: number;
      if (bucket === "liked") delta = listenSeconds >= 10 ? 3 : 2;
      else if (bucket === "later") delta = 1;
      else delta = listenSeconds >= 15 ? -3 : listenSeconds < 2 ? -1 : -2;

      setState(prev => {
        const next = withoutId(prev, track.id);
        return {
          ...next,
          [bucket]: [...next[bucket], track.id],
          swipes: prev.swipes + 1,
          genreScores: addScores(decayScores(prev.genreScores), track.genres, delta),
          artistScores: addScores(decayScores(prev.artistScores), [track.artist], delta),
          lastDecision: {
            id: track.id,
            bucket,
            genres: track.genres,
            artist: track.artist,
            delta,
          },
          savedDeezer: track.deezer
            ? { ...prev.savedDeezer, [track.id]: track }
            : prev.savedDeezer,
        };
      });
    },
    []
  );

  /** Annule le dernier swipe : la carte revient en tête du deck */
  const undoLastDecision = useCallback(() => {
    setState(prev => {
      const last = prev.lastDecision;
      if (!last) return prev;
      const delta =
        last.delta ?? (last.bucket === "liked" ? 2 : last.bucket === "later" ? 1 : -2);
      return {
        ...withoutId(prev, last.id),
        swipes: Math.max(0, prev.swipes - 1),
        genreScores: addScores(prev.genreScores, last.genres, -delta),
        artistScores: last.artist
          ? addScores(prev.artistScores, [last.artist], -delta)
          : prev.artistScores,
        lastDecision: null,
      };
    });
  }, []);

  const restore = useCallback((id: string) => {
    setState(prev => withoutId(prev, id));
  }, []);

  const toggleLiked = useCallback((track: Track) => {
    setState(prev => {
      const wasLiked = prev.liked.includes(track.id);
      const next = withoutId(prev, track.id);
      return wasLiked
        ? {
            ...next,
            genreScores: addScores(prev.genreScores, track.genres, -2),
            artistScores: addScores(prev.artistScores, [track.artist], -2),
          }
        : {
            ...next,
            liked: [...next.liked, track.id],
            genreScores: addScores(prev.genreScores, track.genres, 2),
            artistScores: addScores(prev.artistScores, [track.artist], 2),
            savedDeezer: track.deezer
              ? { ...prev.savedDeezer, [track.id]: track }
              : prev.savedDeezer,
          };
    });
  }, []);

  const moveToLiked = useCallback((track: Track) => {
    setState(prev => {
      const next = withoutId(prev, track.id);
      return {
        ...next,
        liked: [...next.liked, track.id],
        genreScores: addScores(prev.genreScores, track.genres, 2),
        artistScores: addScores(prev.artistScores, [track.artist], 2),
        savedDeezer: track.deezer
          ? { ...prev.savedDeezer, [track.id]: track }
          : prev.savedDeezer,
      };
    });
  }, []);

  /** Fin de l'onboarding : les genres choisis amorcent l'algo (+3 chacun) */
  const completeOnboarding = useCallback((genres: string[]) => {
    setState(prev => ({
      ...prev,
      onboarded: true,
      genreScores: addScores(prev.genreScores, genres, 3),
    }));
  }, []);

  const resetBuckets = useCallback(() => {
    setState(prev => ({ ...prev, liked: [], later: [], disliked: [] }));
  }, []);

  const resetData = useCallback(() => {
    setState({ ...EMPTY });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      byId,
      bucketOf,
      affinity,
      decide,
      undoLastDecision,
      registerTracks,
      restore,
      toggleLiked,
      moveToLiked,
      completeOnboarding,
      resetBuckets,
      resetData,
    }),
    [state, hydrated, byId, bucketOf, affinity, decide, undoLastDecision,
     registerTracks, restore, toggleLiked, moveToLiked,
     completeOnboarding, resetBuckets, resetData]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore doit être utilisé sous <StoreProvider>");
  return v;
}
