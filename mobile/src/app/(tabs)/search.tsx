/* Rechercher — titre, artiste ou genre, dans tout le catalogue Deezer + local */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../../components/MiniPlayer";
import { TrackRow } from "../../components/TrackRow";
import { Track } from "../../lib/catalog";
import { searchDeezer } from "../../lib/deezer";
import { useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";
import { likeToast, noResultsLine, searchPlaceholder } from "../../lib/voice";
import { S } from "../../lib/strings";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [placeholder] = useState(searchPlaceholder);
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const { bucketOf, toggleLiked, registerTracks } = useStore();
  const requestId = useRef(0);

  // recherche dans tout le catalogue Deezer, avec debounce de 450 ms
  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchDeezer(q);
        if (id !== requestId.current) return; // requête obsolète
        registerTracks(found);
        setResults(found);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, registerTracks]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.h1}>{S.search.title}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          autoCorrect={false}
        />
      </View>

      {query.trim() === "" ? (
        <Text style={styles.empty}>{S.search.emptyPrompt}</Text>
      ) : searching && results.length === 0 ? (
        <View style={{ marginTop: 60, alignItems: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : results.length === 0 ? (
        <Text style={styles.empty}>{noResultsLine(query)}</Text>
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
                subtitle={item.deezer ? item.album : undefined}
                queue={results}
                actions={[
                  {
                    icon: liked ? "heart" : "heart-outline",
                    color: liked ? C.accent : C.muted,
                    onPress: () => {
                      toggleLiked(item);
                      toast(
                        liked
                          ? S.library.removed(item.title)
                          : likeToast(item.title)
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
