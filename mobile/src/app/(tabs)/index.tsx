/* Découvrir — pile de cartes swipables (le cœur de Zicmu) */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAutoplay,
  getCurrentElapsed,
  hideMini,
  playTrack,
  setAutoplay,
  stopPlayback,
  togglePlayback,
  usePlayback,
} from "../../lib/audio";
import { hashCode, PREVIEW_SECONDS, Track } from "../../lib/catalog";
import { CoverArt } from "../../lib/covers";
import {
  ArtistSeed,
  DEEZER_GENRES,
  fetchChart,
  fetchDiscoveryFeed,
  fetchFeaturedTracks,
} from "../../lib/deezer";
import { curatedBoost, fetchBoostedArtists } from "../../lib/boost";
import { FEATURED_LABEL } from "../../lib/featured";
import { fairnessBonus, spreadArtists } from "../../lib/fairness";
import { listenLinks } from "../../lib/listen";
import { shareTrack } from "../../lib/share";
import { addLikedToSpotify } from "../../lib/spotify";
import { S } from "../../lib/strings";
import {
  deckHint,
  emptyDeckLine,
  laterToast,
  likeToast,
  loadingLine,
  nopeToast,
  undoToast,
} from "../../lib/voice";
import { Bucket, useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const sessionSeed = String(Math.floor(Math.random() * 1e6));

function buzz(bucket: Bucket) {
  if (Platform.OS === "web") return;
  if (bucket === "liked") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export default function DiscoverScreen() {
  const {
    state, hydrated, byId, bucketOf, affinity, decide, undoLastDecision,
    registerTracks, completeOnboarding, resetBuckets,
  } = useStore();
  const playback = usePlayback();

  // toujours l'état à jour dans loadFeed (évite les fermetures obsolètes)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Flux Deezer : vraie musique, chargée selon les genres préférés de l'user
  const [feed, setFeed] = useState<Track[]>([]);
  // Boost éditorial partagé (Supabase) : artistId Deezer → poids. Vide si non configuré/hors-ligne
  const [boosts, setBoosts] = useState<Map<number, number>>(new Map());
  // Filtres du deck (session) : labels de genres cochés, vide = tout
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const feedRequested = useRef(false);
  // deck infini : page courante des charts + compteur d'échecs consécutifs
  // (2 recharges sans rien de neuf = les charts sont épuisés, on arrête)
  const feedPage = useRef(0);
  const feedExhausted = useRef(0);

  const loadFeed = useCallback(
    async (perChart = 20, silent = false) => {
      setLoadingFeed(true);
      try {
        const s = stateRef.current;
        // graines de reco : les 2 derniers artistes Deezer likés
        // (hors artistes maison, déjà mis en avant)
        const seeds: ArtistSeed[] = [...s.liked]
          .reverse()
          .map(id => s.savedDeezer[id])
          .filter((t): t is Track => !!t && !!t.artistId && !t.featured)
          .slice(0, 2)
          .map(t => ({ artistId: t.artistId as number, genres: t.genres }));

        const chartIndex = feedPage.current * perChart;
        const [featured, discovery] = await Promise.all([
          // les artistes maison ne sont chargés qu'une fois (pas de pagination)
          feedPage.current === 0
            ? fetchFeaturedTracks().catch(() => [] as Track[])
            : Promise.resolve([] as Track[]),
          fetchDiscoveryFeed(s.genreScores, seeds, perChart, chartIndex).catch(
            () => [] as Track[]
          ),
        ]);
        const tracks = [...featured, ...discovery];
        if (tracks.length) {
          registerTracks(tracks);
          setFeed(prev => {
            const seen = new Set(prev.map(t => t.id));
            const fresh = tracks.filter(t => !seen.has(t.id));
            feedExhausted.current = fresh.length ? 0 : feedExhausted.current + 1;
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          feedPage.current += 1;
        } else {
          feedExhausted.current += 1;
          if (!silent) toast(S.discover.offline);
        }
      } catch {
        feedExhausted.current += 1;
        if (!silent) toast(S.discover.offline);
      } finally {
        setLoadingFeed(false);
      }
    },
    [registerTracks]
  );

  // le flux ne se charge qu'après l'onboarding (pour profiter des genres choisis)
  useEffect(() => {
    if (hydrated && state.onboarded && !feedRequested.current) {
      feedRequested.current = true;
      loadFeed();
    }
  }, [hydrated, state.onboarded, loadFeed]);

  // Boost éditorial partagé : on lit la liste Supabase une fois, à l'ouverture
  useEffect(() => {
    if (hydrated && state.onboarded) {
      fetchBoostedArtists().then(setBoosts).catch(() => {});
    }
  }, [hydrated, state.onboarded]);

  // carte tout juste « dé-swipée » (annuler) : elle doit revenir en tête
  const [undoneId, setUndoneId] = useState<string | null>(null);

  const affinityRef = useRef(affinity);
  affinityRef.current = affinity;

  // score d'une carte pour le classement (voir commentaires d'équité plus bas)
  const scoreOf = useCallback(
    (t: Track) =>
      // ⚖️ ÉQUITÉ : les artistes maison n'ont AUCUN privilège de classement.
      // Le hasard (fort) domine → chaque artiste a la même chance de sortir.
      affinityRef.current(t) + // ce que TU as appris à aimer
      fairnessBonus(t.popularity) + // découverte : coup de pouce aux moins connus
      curatedBoost(t.artistId, boosts) + // présence éditoriale douce (Supabase)
      ((hashCode(t.id + sessionSeed) % 100) / 100) * 3.5, // hasard = équité
    [boosts]
  );
  const matchesFilter = useCallback(
    (t: Track) =>
      genreFilter.length === 0 || t.genres.some(g => genreFilter.includes(g)),
    [genreFilter]
  );

  // ⚠️ ORDRE DÉFINITIF PAR AJOUT. On garde une liste d'ids figée : les
  // nouveaux titres (deck infini) sont classés entre eux puis AJOUTÉS À LA FIN
  // — jamais devant une carte déjà en place. Garantie béton : la carte aperçue
  // dessous est toujours la prochaine, même quand le flux se recharge. On ne
  // reconstruit tout que si les filtres ou les boosts changent (action voulue).
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const orderSig = useRef<string | null>(null);
  useEffect(() => {
    const sig =
      genreFilter.join(",") + "|" + [...boosts.keys()].sort().join(",");
    const build = (list: Track[]) =>
      spreadArtists(
        list
          .map(t => ({ t, s: scoreOf(t) }))
          .sort((a, b) => b.s - a.s)
          .map(x => x.t),
        4
      ).map(t => t.id);

    setOrderedIds(prev => {
      if (orderSig.current !== sig) {
        orderSig.current = sig;
        return build(feed.filter(matchesFilter));
      }
      const known = new Set(prev);
      const additions = feed.filter(t => !known.has(t.id) && matchesFilter(t));
      return additions.length ? [...prev, ...build(additions)] : prev;
    });
  }, [feed, boosts, genreFilter, scoreOf, matchesFilter]);

  // Les cartes déjà classées disparaissent, sans jamais re-mélanger l'ordre.
  // « Annuler » ramène juste la carte visée en tête, sans toucher au reste.
  const deck = useMemo(() => {
    const ids = undoneId
      ? [undoneId, ...orderedIds.filter(id => id !== undoneId)]
      : orderedIds;
    return ids
      .map(id => byId[id])
      .filter((t): t is Track => !!t && !bucketOf(t.id) && matchesFilter(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedIds, undoneId, byId, bucketOf, matchesFilter]);

  const top: Track | undefined = deck[0];
  const under: Track | undefined = deck[1];

  // Deck infini : quand il reste peu de cartes, on recharge en coulisse
  // (la suite des charts Deezer), sans que l'utilisateur ne voie rien.
  useEffect(() => {
    if (!feedRequested.current || loadingFeed) return;
    if (feedExhausted.current >= 2) return; // plus rien de neuf chez Deezer
    if (deck.length < 6) loadFeed(20, true);
  }, [deck.length, loadingFeed, loadFeed]);

  const [showInfo, setShowInfo] = useState(false);
  const deciding = useRef(false);
  const pendingPlay = useRef(false);
  // une astuce différente à chaque ouverture de l'écran
  const [hint] = useState(deckHint);
  const [emptyLine] = useState(emptyDeckLine);
  const [loadLine] = useState(loadingLine);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // La carte du dessus change : reset position + enchaînement auto éventuel
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    setShowInfo(false);
    if (pendingPlay.current && top) {
      pendingPlay.current = false;
      playTrack(top);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.id]);

  // En arrivant sur Découvrir : le mini-player laisse la place ; en partant : stop
  useFocusEffect(
    useCallback(() => {
      hideMini();
      return () => stopPlayback();
    }, [])
  );

  const flyAndDecide = useCallback(
    (bucket: Bucket) => {
      const track = deck[0];
      if (!track || deciding.current) return;
      deciding.current = true;
      const dx = bucket === "liked" ? 560 : bucket === "disliked" ? -560 : 0;
      const dy = bucket === "later" ? -820 : 40;
      buzz(bucket);
      tx.value = withTiming(dx, { duration: 260 });
      ty.value = withTiming(dy, { duration: 260 });
      setTimeout(() => {
        // temps d'écoute avant le swipe : pondère le signal de l'algo
        const listened = getCurrentElapsed(track.id);
        stopPlayback();
        if (getAutoplay()) pendingPlay.current = true;
        decide(track, bucket, listened);
        setUndoneId(prev => (prev === track.id ? null : prev));
        // si Spotify est connecté, le coup de cœur file dans sa playlist
        if (bucket === "liked") addLikedToSpotify(track);
        if (bucket === "liked") toast(likeToast(track.title));
        else if (bucket === "later") toast(laterToast(track.title));
        else toast(nopeToast(track.genres[0] ?? S.discover.styleFallback));
        deciding.current = false;
      }, 230);
    },
    [deck, decide, tx, ty]
  );

  const applyFilters = useCallback(
    async (selected: string[]) => {
      setGenreFilter(selected);
      setShowFilters(false);
      const toFetch = DEEZER_GENRES.filter(g => selected.includes(g.label));
      if (!toFetch.length) return;
      setLoadingFeed(true);
      try {
        const lists = await Promise.all(
          toFetch.map(g => fetchChart(g.id, g.label, 25).catch(() => [] as Track[]))
        );
        const tracks = lists.flat();
        if (tracks.length) {
          registerTracks(tracks);
          setFeed(prev => {
            const seen = new Set(prev.map(t => t.id));
            return [...prev, ...tracks.filter(t => !seen.has(t.id))];
          });
        }
      } finally {
        setLoadingFeed(false);
      }
    },
    [registerTracks]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(!showInfo)
        .onChange(e => {
          if (deciding.current) return;
          tx.value = e.translationX;
          ty.value = e.translationY;
        })
        .onEnd(() => {
          if (deciding.current) return;
          if (tx.value > 110) flyAndDecide("liked");
          else if (tx.value < -110) flyAndDecide("disliked");
          else if (ty.value < -130 && Math.abs(tx.value) < 80) flyAndDecide("later");
          else {
            tx.value = withSpring(0);
            ty.value = withSpring(0);
          }
        }),
    [flyAndDecide, showInfo, tx, ty]
  );

  // légère inclinaison propre à chaque carte, comme une pile de vinyles
  const topTilt = top ? ((hashCode(top.id) % 5) - 2) * 0.4 : 0;
  const underTilt = under ? ((hashCode(under.id) % 5) - 2) * 0.4 : 0;

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${topTilt + tx.value / 18}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(tx.value / 90, 1)),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(-tx.value / 90, 1)),
  }));
  const laterStyle = useAnimatedStyle(() => ({
    opacity:
      ty.value < -50 && Math.abs(tx.value) < 60
        ? Math.min(-ty.value / 130, 1)
        : 0,
  }));
  // La carte du dessous "monte" au fur et à mesure que la carte du dessus part
  const underStyle = useAnimatedStyle(() => {
    const p = Math.min((Math.abs(tx.value) + Math.abs(ty.value)) / 130, 1);
    return {
      transform: [
        { translateY: 10 - p * 10 },
        { scale: 0.965 + p * 0.035 },
        { rotate: `${underTilt * (1 - p)}deg` },
      ],
    };
  });

  const isTopPlaying = !!top && playback.playingId === top.id;

  // premier lancement : on amorce l'algo avec les goûts de l'utilisateur
  if (hydrated && !state.onboarded) {
    return <Onboarding onDone={completeOnboarding} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topbar}>
        <Pressable hitSlop={8} onPress={() => setShowFilters(true)}>
          <Ionicons
            name="options-outline"
            size={22}
            color={genreFilter.length ? C.accent : C.text}
          />
        </Pressable>
        <Text style={styles.h1}>{S.tabs.discover}</Text>
        {state.lastDecision ? (
          <Pressable
            testID="btn-undo"
            hitSlop={8}
            onPress={() => {
              if (state.lastDecision) setUndoneId(state.lastDecision.id);
              undoLastDecision();
              toast(undoToast());
            }}
          >
            <Ionicons name="arrow-undo-outline" size={22} color={C.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.deck}>
        {!top && loadingFeed && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.emptyText}>{loadLine}</Text>
          </View>
        )}

        {!top && !loadingFeed && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>💿</Text>
            <Text style={styles.emptyText}>{emptyLine}</Text>
            <Pressable
              style={styles.restartBtn}
              onPress={() => {
                feedExhausted.current = 0; // relance manuelle : on retente
                loadFeed(40);
              }}
            >
              <Text style={styles.restartText}>{S.discover.reloadFeed}</Text>
            </Pressable>
            <Pressable style={styles.restartAlt} onPress={resetBuckets}>
              <Text style={{ color: C.muted, fontSize: 13.5 }}>{S.discover.reswipeAll}</Text>
            </Pressable>
          </View>
        )}

        {under && (
          <Animated.View style={[styles.card, { pointerEvents: "none" }, underStyle]}>
            <CardFace track={under} playing={false} ratio={0} elapsed={0} />
          </Animated.View>
        )}

        {top && (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.card, cardStyle]}>
              <CardFace
                track={top}
                playing={isTopPlaying}
                ratio={isTopPlaying ? playback.ratio : 0}
                elapsed={isTopPlaying ? playback.elapsed : 0}
                onTogglePlay={() => {
                  setAutoplay(true);
                  togglePlayback(top);
                }}
                onToggleInfo={() => setShowInfo(v => !v)}
              />
              {showInfo && (
                <InfoBack track={top} onClose={() => setShowInfo(false)} />
              )}
              <Animated.View style={[styles.badge, styles.badgeLike, likeStyle]}>
                <Text style={[styles.badgeText, { color: "#5bffa0" }]}>{S.discover.like}</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeNope, nopeStyle]}>
                <Text style={[styles.badgeText, { color: C.danger }]}>{S.discover.nope}</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeLater, laterStyle]}>
                <Text style={[styles.badgeText, { color: "#ffd75b" }]}>{S.discover.later}</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      <Text style={styles.hint}>{hint}</Text>

      <View style={styles.actions}>
        <Pressable testID="btn-nope" style={[styles.actionBtn, styles.big]} onPress={() => flyAndDecide("disliked")}>
          <Ionicons name="close" size={30} color={C.accent} />
        </Pressable>
        <Pressable testID="btn-later" style={[styles.actionBtn, styles.small]} onPress={() => flyAndDecide("later")}>
          <Ionicons name="time-outline" size={20} color={C.muted} />
        </Pressable>
        <Pressable testID="btn-like" style={[styles.actionBtn, styles.big]} onPress={() => flyAndDecide("liked")}>
          <Ionicons name="heart" size={28} color={C.accent} />
        </Pressable>
      </View>

      <FiltersSheet
        visible={showFilters}
        current={genreFilter}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
      />
    </SafeAreaView>
  );
}

function Onboarding({ onDone }: { onDone: (genres: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (label: string) =>
    setSelected(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.obWrap}>
        <Text style={{ fontSize: 44 }}>🎧</Text>
        <Text style={styles.obTitle}>{S.discover.obTitle}</Text>
        <Text style={styles.obSub}>{S.discover.obSub}</Text>
        <View style={styles.obChips}>
          {DEEZER_GENRES.map(g => {
            const on = selected.includes(g.label);
            return (
              <Pressable
                key={g.id}
                testID={`ob-${g.id}`}
                style={[styles.obChip, on && styles.obChipOn]}
                onPress={() => toggle(g.label)}
              >
                <Text style={[styles.obChipText, on && { color: "#fff" }]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          testID="ob-done"
          style={[styles.obBtn, selected.length === 0 && { opacity: 0.4 }]}
          disabled={selected.length === 0}
          onPress={() => onDone(selected)}
        >
          <Text style={styles.obBtnText}>
            {S.discover.obGo}{selected.length > 0 ? ` (${selected.length})` : ""}
          </Text>
        </Pressable>
        <Pressable testID="ob-skip" onPress={() => onDone([])} hitSlop={8}>
          <Text style={styles.obSkip}>{S.discover.obSkip}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FiltersSheet({
  visible,
  current,
  onApply,
  onClose,
}: {
  visible: boolean;
  current: string[];
  onApply: (genres: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(current);
  useEffect(() => {
    if (visible) setSelected(current);
  }, [visible, current]);

  const toggle = (label: string) =>
    setSelected(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );

  const options = [FEATURED_LABEL, ...DEEZER_GENRES.map(g => g.label)];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{S.discover.filterTitle}</Text>
          <Text style={styles.sheetHint}>{S.discover.filterHint}</Text>
          <View style={styles.obChips}>
            {options.map(label => {
              const on = selected.includes(label);
              return (
                <Pressable
                  key={label}
                  testID={`filter-${label}`}
                  style={[styles.obChip, on && styles.obChipOn]}
                  onPress={() => toggle(label)}
                >
                  <Text style={[styles.obChipText, on && { color: "#fff" }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sheetActions}>
            <Pressable testID="filter-clear" style={styles.sheetClear} onPress={() => onApply([])}>
              <Text style={{ color: C.muted, fontSize: 14 }}>{S.discover.filterClear}</Text>
            </Pressable>
            <Pressable testID="filter-apply" style={styles.sheetApply} onPress={() => onApply(selected)}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                {S.discover.filterApply}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CardFace({
  track,
  playing,
  ratio,
  elapsed,
  onTogglePlay,
  onToggleInfo,
}: {
  track: Track;
  playing: boolean;
  ratio: number;
  elapsed: number;
  onTogglePlay?: () => void;
  onToggleInfo?: () => void;
}) {
  return (
    <>
      <View style={styles.cover}>
        <CoverArt track={track} />
        <View style={[styles.coverHead, { pointerEvents: "none" }]}>
          <Text style={styles.coverArtist}>{track.artist.toUpperCase()}</Text>
          <Text style={styles.coverTitle}>{track.title.toUpperCase()}</Text>
        </View>
        <View style={styles.playerRow}>
          <Pressable
            testID={onTogglePlay ? "btn-play" : undefined}
            style={styles.playBtn}
            onPress={onTogglePlay}
            hitSlop={6}
          >
            <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
          </Pressable>
          <Text style={styles.time}>
            {fmtTime(elapsed)} / 0:{PREVIEW_SECONDS}
          </Text>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{track.title}</Text>
        <Text style={styles.artist}>{track.artist.toUpperCase()}</Text>
        <Text style={styles.tags}>{track.genres.join(" • ")}</Text>
        <Pressable style={styles.moreBtn} onPress={onToggleInfo} hitSlop={6}>
          <Text style={{ color: C.muted, fontSize: 15, letterSpacing: 1 }}>•••</Text>
        </Pressable>
      </View>
    </>
  );
}

function InfoBack({ track, onClose }: { track: Track; onClose: () => void }) {
  return (
    <View style={styles.back}>
      <Text style={styles.backTitle}>{track.title}</Text>
      <KV label={S.discover.kvArtist} value={track.artist} />
      {track.album ? <KV label={S.discover.kvAlbum} value={track.album} /> : null}
      <KV label={S.discover.kvGenres} value={track.genres.join(", ")} />
      <KV
        label={S.discover.kvSource}
        value={track.featured ? S.discover.srcFeatured : "Deezer"}
      />
      <KV label={S.discover.kvExcerpt} value={`${PREVIEW_SECONDS} ${S.discover.seconds}`} />
      <Text style={styles.backText}>
        {track.featured
          ? S.discover.backFeatured(track.artist)
          : S.discover.backDeezer(track.genres[0] ?? S.discover.chartsFallback)}
      </Text>
      <View style={styles.listenBox}>
        <Text style={styles.listenLabel}>{S.discover.listenOn}</Text>
        <View style={styles.listenRow}>
          {listenLinks(track).map(l => (
            <Pressable
              key={l.id}
              style={styles.listenChip}
              onPress={() => Linking.openURL(l.url)}
            >
              <Ionicons name={l.icon as never} size={15} color={C.text} />
              <Text style={styles.listenChipText}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.backActionsRow}>
        {track.deezer && track.artistId ? (
          <Pressable
            testID="btn-artist-view"
            style={styles.backAction}
            onPress={() =>
              router.push({
                pathname: "/artist-view",
                params: { id: String(track.artistId), name: track.artist },
              })
            }
          >
            <Ionicons name="person-outline" size={15} color={C.accent} />
            <Text style={styles.backActionText}>{S.discover.seeArtist}</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="btn-share"
          style={styles.backAction}
          onPress={() => shareTrack(track)}
        >
          <Ionicons name="share-outline" size={15} color={C.accent} />
          <Text style={styles.backActionText}>{S.discover.share}</Text>
        </Pressable>
      </View>
      <View style={styles.backFooter}>
        <Pressable style={styles.closeBack} onPress={onClose}>
          <Text style={{ color: C.text }}>{S.discover.close}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={{ color: C.muted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 14, flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  h1: { color: C.text, fontSize: 21, fontWeight: "700" },
  deck: { flex: 1, marginHorizontal: 20, marginTop: 4 },
  card: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  cover: { flex: 1, backgroundColor: C.card2 },
  coverHead: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  coverArtist: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 5,
  },
  coverTitle: {
    color: "rgba(255,255,255,.85)",
    fontSize: 10,
    letterSpacing: 6,
    marginTop: 5,
  },
  playerRow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(10,10,16,.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  time: { color: "#fff", fontSize: 14, fontWeight: "600" },
  progress: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,.25)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  meta: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { color: C.text, fontSize: 26, fontWeight: "800" },
  artist: { color: C.muted, fontSize: 13, letterSpacing: 3, marginTop: 3 },
  tags: { color: C.accent, fontSize: 14, marginTop: 5 },
  moreBtn: {
    position: "absolute",
    right: 18,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,12,20,.97)",
    padding: 26,
    gap: 13,
  },
  backTitle: { color: C.text, fontSize: 24, fontWeight: "800", marginBottom: 4 },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 10,
  },
  backText: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 4 },
  listenBox: { marginTop: 6, gap: 8 },
  listenLabel: { color: C.muted, fontSize: 12.5 },
  listenRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  listenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
  },
  listenChipText: { color: C.text, fontSize: 13 },
  backActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  backAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,.45)",
  },
  backActionText: { color: C.accent, fontSize: 13 },
  backFooter: { marginTop: "auto", alignItems: "center", gap: 6 },
  closeBack: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  badge: {
    position: "absolute",
    top: 26,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 3,
  },
  badgeLike: { left: 20, borderColor: "#5bffa0", transform: [{ rotate: "-12deg" }] },
  badgeNope: { right: 20, borderColor: C.danger, transform: [{ rotate: "12deg" }] },
  badgeLater: {
    alignSelf: "center",
    top: "38%",
    borderColor: "#ffd75b",
    transform: [{ rotate: "-6deg" }],
  },
  badgeText: { fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  hint: { color: C.muted, fontSize: 14, textAlign: "center", paddingVertical: 12 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingBottom: 12,
  },
  actionBtn: {
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  big: { width: 66, height: 66, borderRadius: 33 },
  small: { width: 48, height: 48, borderRadius: 24 },
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 30,
  },
  emptyText: { color: C.muted, textAlign: "center", fontSize: 15, lineHeight: 22 },
  restartBtn: {
    backgroundColor: C.accent2,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 22,
  },
  restartText: { color: "#fff", fontWeight: "700" },
  restartAlt: { paddingHorizontal: 20, paddingVertical: 8 },
  obWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  obTitle: { color: C.text, fontSize: 26, fontWeight: "800" },
  obSub: { color: C.muted, fontSize: 14.5, textAlign: "center", lineHeight: 21 },
  obChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginVertical: 10,
  },
  obChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  obChipOn: { backgroundColor: C.accent2, borderColor: C.accent2 },
  obChipText: { color: C.text, fontSize: 14 },
  obBtn: {
    backgroundColor: C.accent2,
    paddingHorizontal: 34,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 6,
  },
  obBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
  obSkip: { color: C.muted, fontSize: 13, textDecorationLine: "underline" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
    paddingBottom: 34,
    gap: 12,
  },
  sheetTitle: { color: C.text, fontSize: 19, fontWeight: "800" },
  sheetHint: { color: C.muted, fontSize: 13.5 },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sheetClear: { paddingVertical: 10, paddingHorizontal: 6 },
  sheetApply: {
    backgroundColor: C.accent2,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 22,
  },
});
