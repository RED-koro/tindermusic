/* Profil — stats de swipes, genres préférés/évités, connexion Spotify */

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../../components/MiniPlayer";
import {
  connectSpotify,
  disconnectSpotify,
  spotifyNeedsBuild,
  spotifyReady,
  useSpotifyConnected,
  useSpotifyPlaylistUrl,
} from "../../lib/spotify";
import { useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";
import { profileTagline } from "../../lib/voice";
import { S } from "../../lib/strings";

export default function ProfileScreen() {
  const router = useRouter();
  const { state, resetData, setDisplayName } = useStore();
  const spotifyConnected = useSpotifyConnected();
  const playlistUrl = useSpotifyPlaylistUrl();

  const name = state.displayName.trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const openEdit = () => {
    setDraft(name);
    setEditing(true);
  };
  const saveName = () => {
    setDisplayName(draft);
    setEditing(false);
  };

  const onSpotify = async () => {
    // Expo Go / web : la redirection OAuth ne peut pas revenir vers l'app —
    // on le dit franchement plutôt que de laisser un bouton qui semble cassé
    if (spotifyNeedsBuild) {
      toast(S.profile.spotifySoon);
      return;
    }
    if (spotifyConnected) {
      await disconnectSpotify();
      return;
    }
    const ok = await connectSpotify();
    toast(ok ? S.profile.spotifyDone : S.profile.spotifyFail);
  };

  const scores = Object.entries(state.genreScores).sort((a, b) => b[1] - a[1]);
  const liked = scores.filter(([, v]) => v > 0).slice(0, 5);
  const avoided = scores
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3);
  const maxAbs = Math.max(1, ...scores.map(([, v]) => Math.abs(v)));

  const artistEntries = Object.entries(state.artistScores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxArtist = Math.max(1, ...artistEntries.map(([, v]) => v));

  const confirmReset = () => {
    const doReset = () => {
      resetData();
      toast(S.profile.resetDone);
    };
    if (Platform.OS === "web") {
      // Alert à boutons non supporté sur web
      if (window.confirm(S.profile.resetConfirmWeb)) doReset();
    } else {
      Alert.alert(S.profile.resetTitle, S.profile.resetMsg, [
        { text: S.discover.cancel, style: "cancel" },
        { text: S.profile.resetTitle, style: "destructive", onPress: doReset },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.h1}>{S.profile.title}</Text>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.header} onPress={openEdit}>
          <View style={styles.avatar}>
            {name ? (
              <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
            ) : (
              <Ionicons name="person" size={30} color="#fff" />
            )}
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name || S.profile.namePlaceholder}</Text>
              <Ionicons name="pencil" size={14} color={C.muted} />
            </View>
            <Text style={styles.sub}>{profileTagline(state.swipes)}</Text>
          </View>
        </Pressable>

        <View style={styles.stats}>
          <Stat value={state.swipes} label={S.profile.swipes} />
          <Stat value={state.liked.length} label={S.profile.liked} />
          <Stat
            value={Math.round(state.stats.listenSeconds / 60)}
            label={S.profile.minutes}
          />
        </View>

        <Text style={styles.sectionTitle}>{S.profile.favGenres}</Text>
        {liked.length === 0 ? (
          <Text style={styles.emptyGenres}>{S.profile.emptyGenres}</Text>
        ) : (
          liked.map(([g, v]) => (
            <GenreBar key={g} name={g} ratio={Math.abs(v) / maxAbs} />
          ))
        )}

        {artistEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{S.profile.favArtists}</Text>
            {artistEntries.map(([a, v]) => (
              <GenreBar key={a} name={a} ratio={v / maxArtist} />
            ))}
          </>
        )}

        {avoided.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{S.profile.avoided}</Text>
            {avoided.map(([g, v]) => (
              <GenreBar key={g} name={g} ratio={Math.abs(v) / maxAbs} negative />
            ))}
          </>
        )}

        {spotifyReady && (
          <Pressable style={styles.spotifyBtn} onPress={onSpotify}>
            <Ionicons
              name="musical-notes"
              size={18}
              color={spotifyConnected ? "#1DB954" : C.accent}
            />
            <Text style={styles.spotifyText}>
              {spotifyConnected ? S.profile.spotifyConnected : S.profile.connectSpotify}
            </Text>
          </Pressable>
        )}

        {spotifyConnected && playlistUrl && (
          <Pressable
            style={styles.playlistLink}
            onPress={() => Linking.openURL(playlistUrl)}
          >
            <Ionicons name="open-outline" size={15} color="#1DB954" />
            <Text style={styles.playlistLinkText}>{S.profile.openPlaylist}</Text>
          </Pressable>
        )}

        <Pressable style={styles.legalBtn} onPress={() => router.push("/legal")}>
          <Text style={styles.legalText}>{S.profile.legal}</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={confirmReset}>
          <Text style={styles.resetText}>{S.profile.reset}</Text>
        </Pressable>
      </ScrollView>
      <MiniPlayer />

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditing(false)}>
          <Pressable style={styles.editSheet} onPress={() => {}}>
            <Text style={styles.editTitle}>{S.profile.nameTitle}</Text>
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={S.profile.namePlaceholder}
              placeholderTextColor={C.muted}
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <Pressable style={styles.editSave} onPress={saveName}>
              <Text style={styles.editSaveText}>{S.profile.nameSave}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function GenreBar({
  name,
  ratio,
  negative,
}: {
  name: string;
  ratio: number;
  negative?: boolean;
}) {
  return (
    <View style={styles.genreBar}>
      <Text style={styles.genreName} numberOfLines={1}>{name}</Text>
      <View style={styles.genreTrack}>
        <View
          style={[
            styles.genreFill,
            { width: `${ratio * 100}%` },
            negative && { backgroundColor: C.danger },
          ]}
        />
      </View>
    </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 100, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.accent2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { color: C.text, fontSize: 19, fontWeight: "700", flexShrink: 1 },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 2, maxWidth: 240 },
  playlistLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: -6,
    paddingVertical: 6,
  },
  playlistLinkText: { color: "#1DB954", fontSize: 13.5, fontWeight: "600" },
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.6)",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  editSheet: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
    gap: 14,
  },
  editTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  editInput: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: C.text,
    fontSize: 16,
  },
  editSave: {
    backgroundColor: C.accent2,
    borderRadius: 20,
    paddingVertical: 13,
    alignItems: "center",
  },
  editSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  stats: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  statValue: { color: C.accent, fontSize: 22, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: C.muted, fontSize: 15, fontWeight: "600", marginTop: 6 },
  emptyGenres: { color: C.muted, fontSize: 13.5 },
  genreBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  genreName: { color: C.text, fontSize: 13.5, width: 110 },
  genreTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.card2,
    overflow: "hidden",
  },
  genreFill: { height: "100%", borderRadius: 4, backgroundColor: C.accent2 },
  spotifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(29,185,84,.45)",
    backgroundColor: "rgba(29,185,84,.10)",
  },
  spotifyText: { color: C.text, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  legalBtn: { alignSelf: "center", paddingVertical: 4 },
  legalText: { color: C.muted, fontSize: 13, textDecorationLine: "underline" },
  resetBtn: {
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  resetText: { color: C.danger, fontSize: 13.5 },
});
