/* État global de Tune : buckets (aimés / à revoir / pas pour moi), scores de
   genres (l'« algo » v1), titres publiés par les artistes et modération.
   Persisté dans AsyncStorage. */

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
import { CATALOG, hashCode, SCENES, Track } from "./catalog";
import { REPORTS_TO_HIDE } from "./moderation";

export type Bucket = "liked" | "later" | "disliked";

/** Statut de modération d'un titre publié.
    "pending" est réservé à la revue serveur (V2) ; en local, la validation
    automatique tranche tout de suite entre approved et rejected. */
export type PublicationStatus = "pending" | "approved" | "rejected";

export interface CustomTrackMeta {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  description: string;
  previewStart: number;
  audioUri: string;
  coverUri: string | null;
  addedAt: number;
  status: PublicationStatus;
  rejectionReason?: string;
  reports: number;
  /** Motifs donnés par les auditeurs — exploitables par la modération (V2) */
  reportReasons?: string[];
}

interface LastDecision {
  id: string;
  bucket: Bucket;
  genres: string[];
}

interface TuneState {
  liked: string[];
  later: string[];
  disliked: string[];
  genreScores: Record<string, number>;
  swipes: number;
  customs: CustomTrackMeta[];
  /** Métadonnées des titres Deezer classés (bibliothèque persistante) */
  savedDeezer: Record<string, Track>;
  /** Dernier titre publié : mis en tête du deck Découvrir */
  freshId: string | null;
  /** Dernier swipe, pour pouvoir l'annuler */
  lastDecision: LastDecision | null;
}

const EMPTY: TuneState = {
  liked: [],
  later: [],
  disliked: [],
  genreScores: {},
  swipes: 0,
  customs: [],
  savedDeezer: {},
  freshId: null,
  lastDecision: null,
};

const STORAGE_KEY = "tune-state-v1";

export function customToTrack(meta: CustomTrackMeta): Track {
  const seed = hashCode(meta.id);
  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    genres: meta.genres,
    scene: SCENES[seed % SCENES.length],
    hue: seed % 360,
    hue2: (seed * 7) % 360,
    custom: true,
    description: meta.description,
    previewStart: meta.previewStart,
    audioUri: meta.audioUri,
    coverUri: meta.coverUri,
  };
}

interface StoreValue {
  state: TuneState;
  hydrated: boolean;
  allTracks: Track[];
  byId: Record<string, Track>;
  bucketOf: (id: string) => Bucket | null;
  affinity: (track: Track) => number;
  decide: (track: Track, bucket: Bucket) => void;
  undoLastDecision: () => void;
  /** Rend des titres Deezer (flux, recherche) résolubles via byId le temps de la session */
  registerTracks: (tracks: Track[]) => void;
  /** Retire le titre de tous les buckets (retour dans Découvrir) */
  restore: (id: string) => void;
  /** Bascule aimé <-> non classé (recherche, bibliothèque) */
  toggleLiked: (track: Track) => void;
  moveToLiked: (track: Track) => void;
  publish: (meta: CustomTrackMeta) => void;
  removeCustom: (id: string) => void;
  reportTrack: (id: string, reason?: string) => void;
  resetBuckets: () => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function withoutId(state: TuneState, id: string): TuneState {
  return {
    ...state,
    liked: state.liked.filter(x => x !== id),
    later: state.later.filter(x => x !== id),
    disliked: state.disliked.filter(x => x !== id),
  };
}

function addScores(
  scores: Record<string, number>,
  genres: string[],
  delta: number
): Record<string, number> {
  const next = { ...scores };
  for (const g of genres) next[g] = (next[g] || 0) + delta;
  return next;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TuneState>(EMPTY);
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
        // migration : les titres publiés avant la modération sont considérés validés
        const customs: CustomTrackMeta[] = (parsed.customs || []).map(
          (c: Partial<CustomTrackMeta>) => ({ status: "approved", reports: 0, ...c })
        );
        setState({ ...EMPTY, ...parsed, customs });
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  // seuls les titres validés par la modération sont proposés aux auditeurs
  const allTracks = useMemo(
    () => [
      ...CATALOG,
      ...state.customs.filter(c => c.status === "approved").map(customToTrack),
    ],
    [state.customs]
  );
  const byId = useMemo(
    () => ({
      ...sessionTracks,
      ...state.savedDeezer,
      ...Object.fromEntries(allTracks.map(t => [t.id, t])),
    }),
    [allTracks, sessionTracks, state.savedDeezer]
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

  const affinity = useCallback(
    (track: Track) =>
      track.genres.reduce((s, g) => s + (state.genreScores[g] || 0), 0),
    [state.genreScores]
  );

  const decide = useCallback((track: Track, bucket: Bucket) => {
    const delta = bucket === "liked" ? 2 : bucket === "later" ? 1 : -2;
    setState(prev => {
      const next = withoutId(prev, track.id);
      return {
        ...next,
        [bucket]: [...next[bucket], track.id],
        swipes: prev.swipes + 1,
        genreScores: addScores(prev.genreScores, track.genres, delta),
        freshId: prev.freshId === track.id ? null : prev.freshId,
        lastDecision: { id: track.id, bucket, genres: track.genres },
        savedDeezer: track.deezer
          ? { ...prev.savedDeezer, [track.id]: track }
          : prev.savedDeezer,
      };
    });
  }, []);

  /** Annule le dernier swipe : la carte revient en tête du deck */
  const undoLastDecision = useCallback(() => {
    setState(prev => {
      const last = prev.lastDecision;
      if (!last) return prev;
      const delta = last.bucket === "liked" ? 2 : last.bucket === "later" ? 1 : -2;
      return {
        ...withoutId(prev, last.id),
        swipes: Math.max(0, prev.swipes - 1),
        genreScores: addScores(prev.genreScores, last.genres, -delta),
        freshId: last.id,
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
        ? { ...next, genreScores: addScores(prev.genreScores, track.genres, -2) }
        : {
            ...next,
            liked: [...next.liked, track.id],
            genreScores: addScores(prev.genreScores, track.genres, 2),
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
        savedDeezer: track.deezer
          ? { ...prev.savedDeezer, [track.id]: track }
          : prev.savedDeezer,
      };
    });
  }, []);

  const publish = useCallback((meta: CustomTrackMeta) => {
    setState(prev => ({
      ...prev,
      customs: [...prev.customs, meta],
      freshId: meta.id,
    }));
  }, []);

  const removeCustom = useCallback((id: string) => {
    setState(prev => ({
      ...withoutId(prev, id),
      customs: prev.customs.filter(c => c.id !== id),
      freshId: prev.freshId === id ? null : prev.freshId,
    }));
  }, []);

  /** Signalement par un auditeur : au-delà du seuil, le titre est masqué
      partout (deck + bibliothèque). En V2, le signalement partira au serveur. */
  const reportTrack = useCallback((id: string, reason?: string) => {
    setState(prev => {
      const meta = prev.customs.find(c => c.id === id);
      if (!meta) return prev;
      const reports = meta.reports + 1;
      const hidden = reports >= REPORTS_TO_HIDE;
      const base = hidden ? withoutId(prev, id) : prev;
      return {
        ...base,
        customs: prev.customs.map(c =>
          c.id === id
            ? {
                ...c,
                reports,
                reportReasons: reason
                  ? [...(c.reportReasons ?? []), reason]
                  : c.reportReasons,
                status: hidden ? "rejected" : c.status,
                rejectionReason: hidden
                  ? reason
                    ? `Signalé : ${reason}`
                    : "Signalé par des auditeurs"
                  : c.rejectionReason,
              }
            : c
        ),
        freshId: hidden && prev.freshId === id ? null : prev.freshId,
        lastDecision: hidden && prev.lastDecision?.id === id ? null : prev.lastDecision,
      };
    });
  }, []);

  const resetBuckets = useCallback(() => {
    setState(prev => ({ ...prev, liked: [], later: [], disliked: [] }));
  }, []);

  const resetData = useCallback(() => {
    setState(prev => ({ ...EMPTY, customs: prev.customs }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      allTracks,
      byId,
      bucketOf,
      affinity,
      decide,
      undoLastDecision,
      registerTracks,
      restore,
      toggleLiked,
      moveToLiked,
      publish,
      removeCustom,
      reportTrack,
      resetBuckets,
      resetData,
    }),
    [state, hydrated, allTracks, byId, bucketOf, affinity, decide, undoLastDecision,
     registerTracks, restore, toggleLiked, moveToLiked, publish, removeCustom,
     reportTrack, resetBuckets, resetData]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore doit être utilisé sous <StoreProvider>");
  return v;
}
