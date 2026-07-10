/* Mini-player flottant (écrans hors Découvrir) */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { playInMini, advanceMiniQueue, togglePlayback, usePlayback } from "../lib/audio";
import { Track } from "../lib/catalog";
import { CoverArt } from "../lib/covers";
import { useStore } from "../lib/store";
import { C } from "../lib/theme";

/** queue : liste utilisée par le bouton "suivant" (par défaut les aimés) */
export function MiniPlayer({ queue }: { queue?: Track[] }) {
  const { miniTrackId, playingId } = usePlayback();
  const { byId, state } = useStore();

  if (!miniTrackId) return null;
  const track = byId[miniTrackId];
  if (!track) return null;

  const isPlaying = playingId === miniTrackId;
  const list =
    queue && queue.length
      ? queue
      : state.liked.map(id => byId[id]).filter(Boolean);

  const next = () => {
    if (list.length > 1) {
      const i = list.findIndex(t => t.id === miniTrackId);
      playInMini(list[(i + 1) % list.length], list);
    } else {
      advanceMiniQueue();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.cover}>
        <CoverArt track={track} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist.toUpperCase()}</Text>
      </View>
      <Pressable style={styles.playBtn} onPress={() => togglePlayback(track)}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#000" />
      </Pressable>
      <Pressable style={styles.nextBtn} onPress={next} hitSlop={6}>
        <Ionicons name="play-skip-forward" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    backgroundColor: "rgba(20,20,30,.96)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cover: { width: 46, height: 46, borderRadius: 10, overflow: "hidden" },
  meta: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 15, fontWeight: "700" },
  artist: { color: C.muted, fontSize: 11.5, letterSpacing: 1.5, marginTop: 1 },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: { padding: 4 },
});
