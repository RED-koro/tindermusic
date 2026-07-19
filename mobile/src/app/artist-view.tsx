/* Page artiste — photo, fans, tous ses titres (données Deezer).
   Accessible depuis le dos d'une carte (« Voir l'artiste »). */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../components/MiniPlayer";
import { TrackRow } from "../components/TrackRow";
import { Track } from "../lib/catalog";
import { ArtistInfo, fetchArtistInfo, fetchArtistTop } from "../lib/deezer";
import { addLikedToSpotify } from "../lib/spotify";
import { useStore } from "../lib/store";
import { C } from "../lib/theme";
import { toast } from "../lib/toast";
import { S } from "../lib/strings";
import { likeToast } from "../lib/voice";

const fmtFans = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1).replace(".", ",")} k`
      : `${n}`;

export default function ArtistViewScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { bucketOf, toggleLiked, registerTracks } = useStore();

  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const artistId = Number(id);
    if (!artistId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [i, top] = await Promise.all([
        fetchArtistInfo(artistId),
        fetchArtistTop(artistId, "Découverte", 25).catch(() => [] as Track[]),
      ]);
      if (cancelled) return;
      setInfo(i);
      setTracks(top);
      registerTracks(top);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, registerTracks]);

  const displayName = info?.name ?? name ?? S.artistView.fallbackName;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.h1} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {info?.pictureUrl ? (
                <Image source={{ uri: info.pictureUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={40} color={C.muted} />
                </View>
              )}
              <Text style={styles.name}>{displayName}</Text>
              {info && (
                <Text style={styles.meta}>
                  {fmtFans(info.fans)} {S.artistView.fans} • {info.albums} {S.artistView.albums}
                </Text>
              )}
              <Text style={styles.sectionTitle}>{S.artistView.topTracks}</Text>
              {tracks.length === 0 && (
                <Text style={styles.empty}>{S.artistView.noPreview}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const liked = bucketOf(item.id) === "liked";
            return (
              <TrackRow
                track={item}
                subtitle={item.album}
                queue={tracks}
                actions={[
                  {
                    icon: liked ? "heart" : "heart-outline",
                    color: liked ? C.accent : C.muted,
                    onPress: () => {
                      toggleLiked(item);
                      // un cœur ajouté = il file aussi dans la playlist Spotify
                      if (!liked) addLikedToSpotify(item);
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

      <MiniPlayer queue={tracks} />
    </SafeAreaView>
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
    gap: 12,
  },
  h1: { color: C.text, fontSize: 19, fontWeight: "700", flex: 1, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { alignItems: "center", gap: 8, paddingBottom: 18 },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.card2 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: C.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  meta: { color: C.muted, fontSize: 13.5 },
  sectionTitle: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "600",
    alignSelf: "flex-start",
    marginTop: 14,
  },
  empty: { color: C.muted, fontSize: 13.5, marginTop: 10 },
});
