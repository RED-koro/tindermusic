/* Rechercher — titre, artiste ou genre */

import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../../components/MiniPlayer";
import { TrackRow } from "../../components/TrackRow";
import { useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const { allTracks, bucketOf, toggleLiked } = useStore();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allTracks.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genres.some(g => g.toLowerCase().includes(q))
    );
  }, [query, allTracks]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.h1}>Rechercher</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Titre, artiste ou genre…"
          placeholderTextColor={C.muted}
          autoCorrect={false}
        />
      </View>

      {query.trim() === "" ? (
        <Text style={styles.empty}>Cherche un titre, un artiste ou un genre.</Text>
      ) : results.length === 0 ? (
        <Text style={styles.empty}>Aucun résultat pour « {query} »</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const liked = bucketOf(item.id) === "liked";
            return (
              <TrackRow
                track={item}
                actions={[
                  {
                    icon: liked ? "heart" : "heart-outline",
                    color: liked ? C.accent : C.muted,
                    onPress: () => {
                      toggleLiked(item);
                      toast(
                        liked
                          ? `« ${item.title} » retiré`
                          : `❤ « ${item.title} » ajouté`
                      );
                    },
                  },
                ]}
              />
            );
          }}
        />
      )}

      <MiniPlayer queue={results} />
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
  inputWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
  },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: {
    color: C.muted,
    textAlign: "center",
    marginTop: 60,
    fontSize: 14,
    lineHeight: 23,
    paddingHorizontal: 30,
  },
});
