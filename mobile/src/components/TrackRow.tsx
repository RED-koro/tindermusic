/* Ligne de titre (bibliothèque, recherche, espace artiste) */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { playInMini } from "../lib/audio";
import { Track } from "../lib/catalog";
import { CoverArt } from "../lib/covers";
import { C } from "../lib/theme";

interface Action {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
}

export function TrackRow({
  track,
  subtitle,
  actions,
}: {
  track: Track;
  subtitle?: string;
  actions: Action[];
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.cover} onPress={() => playInMini(track)}>
        <CoverArt track={track} />
        <View style={styles.coverOverlay}>
          <Ionicons name="play" size={18} color="#fff" />
        </View>
      </Pressable>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
        <Text style={styles.tags} numberOfLines={1}>
          {subtitle ?? track.genres.join(" • ")}
        </Text>
      </View>
      {actions.map((a, i) => (
        <Pressable key={i} style={styles.action} onPress={a.onPress} hitSlop={8}>
          <Ionicons name={a.icon} size={21} color={a.color ?? C.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  cover: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.card2,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
  },
  meta: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 16, fontWeight: "700" },
  artist: { color: "#cfd0dd", fontSize: 14, marginTop: 1 },
  tags: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  action: { padding: 6 },
});
