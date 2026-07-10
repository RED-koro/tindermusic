/* Ma bibliothèque — Aimés / À revoir / Pas pour moi */

import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../../components/MiniPlayer";
import { TrackRow } from "../../components/TrackRow";
import { Bucket, useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";

const TABS: { bucket: Bucket; label: string }[] = [
  { bucket: "liked", label: "❤ Aimés" },
  { bucket: "later", label: "⏱ À revoir" },
  { bucket: "disliked", label: "✕ Pas pour moi" },
];

const EMPTY_TEXT: Record<Bucket, string> = {
  liked: "Aucun titre aimé pour l'instant.\nSwipe à droite dans Découvrir ❤",
  later: "Rien à revoir.\nSwipe vers le haut pour garder un titre de côté ⏱",
  disliked: "Aucun titre écarté.\nSwipe à gauche pour passer un titre ✕",
};

export default function LibraryScreen() {
  const [bucket, setBucket] = useState<Bucket>("liked");
  const { state, byId, restore, toggleLiked, moveToLiked } = useStore();

  const tracks = useMemo(
    () => [...state[bucket]].reverse().map(id => byId[id]).filter(Boolean),
    [state, bucket, byId]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.h1}>Ma bibliothèque</Text>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.bucket}
            style={[styles.tab, bucket === t.bucket && styles.tabActive]}
            onPress={() => setBucket(t.bucket)}
          >
            <Text
              style={[styles.tabText, bucket === t.bucket && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tracks.length === 0 ? (
        <Text style={styles.empty}>{EMPTY_TEXT[bucket]}</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          renderItem={({ item }) => (
            <TrackRow
              track={item}
              queue={tracks}
              actions={[
                bucket === "liked"
                  ? {
                      icon: "heart",
                      color: C.accent,
                      onPress: () => {
                        toggleLiked(item);
                        toast(`« ${item.title} » retiré des aimés`);
                      },
                    }
                  : {
                      icon: "heart-outline",
                      color: C.muted,
                      onPress: () => {
                        moveToLiked(item);
                        toast(`❤ « ${item.title} » déplacé vers Aimés`);
                      },
                    },
                {
                  icon: "refresh-outline",
                  onPress: () => {
                    restore(item.id);
                    toast(`« ${item.title} » remis dans Découvrir`);
                  },
                },
              ]}
            />
          )}
        />
      )}

      <MiniPlayer queue={tracks} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: {
    color: C.text,
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 12,
  },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  tab: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22 },
  tabActive: { backgroundColor: "rgba(139,92,246,.22)" },
  tabText: { color: C.muted, fontSize: 13.5, fontWeight: "600" },
  tabTextActive: { color: C.accent },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: {
    color: C.muted,
    textAlign: "center",
    marginTop: 60,
    fontSize: 14,
    lineHeight: 23,
  },
});
