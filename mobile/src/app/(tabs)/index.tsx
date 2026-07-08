/* Découvrir — pile de cartes swipables (le cœur de Tune) */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
  hideMini,
  playTrack,
  setAutoplay,
  stopPlayback,
  togglePlayback,
  usePlayback,
} from "../../lib/audio";
import { hashCode, PREVIEW_SECONDS, Track } from "../../lib/catalog";
import { CoverArt } from "../../lib/covers";
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
    state, allTracks, bucketOf, affinity, decide, undoLastDecision,
    reportTrack, resetBuckets,
  } = useStore();
  const playback = usePlayback();

  // L'algo v1 : tri par affinité de genres + un peu de hasard stable
  const deck = useMemo(() => {
    return allTracks
      .filter(t => !bucketOf(t.id))
      .map(t => ({
        t,
        s:
          (state.freshId === t.id ? 1000 : 0) +
          affinity(t) +
          ((hashCode(t.id + sessionSeed) % 100) / 100) * 1.5,
      }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.t);
  }, [allTracks, bucketOf, affinity, state.freshId]);

  const top: Track | undefined = deck[0];
  const under: Track | undefined = deck[1];

  const [showInfo, setShowInfo] = useState(false);
  const deciding = useRef(false);
  const pendingPlay = useRef(false);

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
        stopPlayback();
        if (getAutoplay()) pendingPlay.current = true;
        decide(track, bucket);
        if (bucket === "liked") toast(`❤ « ${track.title} » ajouté à ta bibliothèque`);
        else if (bucket === "later") toast(`« ${track.title} » à réécouter plus tard`);
        else toast(`On te proposera moins de ${track.genres[0]}`);
        deciding.current = false;
      }, 230);
    },
    [deck, decide, tx, ty]
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

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${tx.value / 18}deg` },
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
      transform: [{ translateY: 10 - p * 10 }, { scale: 0.965 + p * 0.035 }],
    };
  });

  const isTopPlaying = !!top && playback.playingId === top.id;

  const reportTop = useCallback(() => {
    const track = deck[0];
    if (!track?.custom) return;
    const doReport = () => {
      stopPlayback();
      setShowInfo(false);
      reportTrack(track.id);
      toast("Merci — titre signalé et masqué en attendant vérification");
    };
    if (Platform.OS === "web") {
      // Alert à boutons non supporté sur web
      if (window.confirm(`Signaler « ${track.title} » comme inapproprié ?`)) doReport();
    } else {
      Alert.alert("Signaler", `Signaler « ${track.title} » comme inapproprié ?`, [
        { text: "Annuler", style: "cancel" },
        { text: "Signaler", style: "destructive", onPress: doReport },
      ]);
    }
  }, [deck, reportTrack]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topbar}>
        <Pressable hitSlop={8} onPress={() => toast("Filtres : bientôt disponible")}>
          <Ionicons name="options-outline" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.h1}>Découvrir</Text>
        {state.lastDecision ? (
          <Pressable
            testID="btn-undo"
            hitSlop={8}
            onPress={() => {
              undoLastDecision();
              toast("Dernier swipe annulé");
            }}
          >
            <Ionicons name="arrow-undo-outline" size={22} color={C.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.deck}>
        {!top && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🎧</Text>
            <Text style={styles.emptyText}>
              Tu as tout écouté !{"\n"}Reviens plus tard pour de nouvelles découvertes.
            </Text>
            <Pressable style={styles.restartBtn} onPress={resetBuckets}>
              <Text style={styles.restartText}>Réécouter le catalogue</Text>
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
                <InfoBack
                  track={top}
                  onClose={() => setShowInfo(false)}
                  onReport={reportTop}
                />
              )}
              <Animated.View style={[styles.badge, styles.badgeLike, likeStyle]}>
                <Text style={[styles.badgeText, { color: "#5bffa0" }]}>J'AIME</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeNope, nopeStyle]}>
                <Text style={[styles.badgeText, { color: C.danger }]}>NON</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeLater, laterStyle]}>
                <Text style={[styles.badgeText, { color: "#ffd75b" }]}>À REVOIR</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      <Text style={styles.hint}>Swipe pour découvrir de nouveaux artistes</Text>

      <View style={styles.actions}>
        <Pressable testID="btn-nope" style={[styles.actionBtn, styles.big]} onPress={() => flyAndDecide("disliked")}>
          <Ionicons name="close" size={30} color={C.accent} />
        </Pressable>
        <Pressable testID="btn-later" style={[styles.actionBtn, styles.small]} onPress={() => flyAndDecide("later")}>
          <Ionicons name="time-outline" size={20} color={C.muted} />
        </Pressable>
        <Pressable testID="btn-info" style={[styles.actionBtn, styles.small]} onPress={() => setShowInfo(v => !v)}>
          <Text style={styles.infoGlyph}>i</Text>
        </Pressable>
        <Pressable testID="btn-like" style={[styles.actionBtn, styles.big]} onPress={() => flyAndDecide("liked")}>
          <Ionicons name="heart" size={28} color={C.accent} />
        </Pressable>
      </View>
    </SafeAreaView>
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

function InfoBack({
  track,
  onClose,
  onReport,
}: {
  track: Track;
  onClose: () => void;
  onReport?: () => void;
}) {
  return (
    <View style={styles.back}>
      <Text style={styles.backTitle}>{track.title}</Text>
      <KV label="Artiste" value={track.artist} />
      <KV label="Genres" value={track.genres.join(", ")} />
      {track.custom ? (
        <KV label="Source" value="Publié par l'artiste" />
      ) : (
        <KV label="Tempo" value={`${track.bpm} BPM`} />
      )}
      <KV label="Extrait" value={`${PREVIEW_SECONDS} secondes`} />
      <Text style={styles.backText}>
        {track.custom
          ? track.description
            ? `« ${track.description} »  — ${track.artist}`
            : `Titre publié directement par ${track.artist} sur Tune. Si tu l'aimes, il rejoint ta bibliothèque et soutient l'artiste.`
          : `Artiste émergent proposé selon tes goûts. Si tu aimes ce titre, il rejoint ta bibliothèque et l'algorithme te proposera plus de ${track.genres[0]}.`}
      </Text>
      <View style={styles.backFooter}>
        {track.custom && onReport && (
          <Pressable testID="btn-report" style={styles.reportBtn} onPress={onReport}>
            <Ionicons name="flag-outline" size={15} color={C.danger} />
            <Text style={{ color: C.danger, fontSize: 13.5 }}>Signaler ce titre</Text>
          </Pressable>
        )}
        <Pressable style={styles.closeBack} onPress={onClose}>
          <Text style={{ color: C.text }}>Fermer</Text>
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
  backFooter: { marginTop: "auto", alignItems: "center", gap: 6 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
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
  infoGlyph: {
    color: C.muted,
    fontSize: 18,
    fontStyle: "italic",
    fontWeight: "600",
    fontFamily: "Georgia",
  },
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
});
