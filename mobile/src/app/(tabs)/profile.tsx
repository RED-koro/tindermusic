/* Profil — stats de swipes, genres préférés/évités, accès Espace artiste */

import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../../components/MiniPlayer";
import { useStore } from "../../lib/store";
import { C } from "../../lib/theme";
import { toast } from "../../lib/toast";
import { profileTagline } from "../../lib/voice";

export default function ProfileScreen() {
  const router = useRouter();
  const { state, resetData } = useStore();

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
      toast("Données réinitialisées");
    };
    if (Platform.OS === "web") {
      // Alert à boutons non supporté sur web
      if (window.confirm("Réinitialiser tes swipes et tes goûts ?")) doReset();
    } else {
      Alert.alert("Réinitialiser", "Tes swipes et tes goûts seront effacés.", [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: doReset },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.h1}>Profil</Text>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View>
            <Text style={styles.name}>Andy</Text>
            <Text style={styles.sub}>{profileTagline(state.swipes)}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={state.swipes} label="Swipes" />
          <Stat value={state.liked.length} label="Aimés" />
          <Stat
            value={Math.round(state.stats.listenSeconds / 60)}
            label="Minutes d'écoute"
          />
        </View>

        <Text style={styles.sectionTitle}>Tes genres préférés (algo v1)</Text>
        {liked.length === 0 ? (
          <Text style={styles.emptyGenres}>
            Swipe quelques titres pour que l'algo apprenne tes goûts.
          </Text>
        ) : (
          liked.map(([g, v]) => (
            <GenreBar key={g} name={g} ratio={Math.abs(v) / maxAbs} />
          ))
        )}

        {artistEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Tes artistes préférés</Text>
            {artistEntries.map(([a, v]) => (
              <GenreBar key={a} name={a} ratio={v / maxArtist} />
            ))}
          </>
        )}

        {avoided.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Genres évités</Text>
            {avoided.map(([g, v]) => (
              <GenreBar key={g} name={g} ratio={Math.abs(v) / maxAbs} negative />
            ))}
          </>
        )}

        <Pressable style={styles.artistBtn} onPress={() => router.push("/artist")}>
          <Text style={styles.artistBtnText}>🎤 Espace artiste — publier un titre</Text>
        </Pressable>

        <Pressable style={styles.legalBtn} onPress={() => router.push("/legal")}>
          <Text style={styles.legalText}>À propos, confidentialité & mentions légales</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={confirmReset}>
          <Text style={styles.resetText}>Réinitialiser mes données</Text>
        </Pressable>
      </ScrollView>
      <MiniPlayer />
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
  name: { color: C.text, fontSize: 19, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 2, maxWidth: 240 },
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
  artistBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,.45)",
    backgroundColor: "rgba(139,92,246,.14)",
    alignItems: "center",
  },
  artistBtnText: { color: C.accent, fontSize: 14.5, fontWeight: "700" },
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
