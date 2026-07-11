/* À propos & mentions légales — requis pour la publication sur les stores :
   politique de confidentialité, CGU, attribution Deezer, contact. */

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../lib/theme";

const CONTACT_EMAIL = "andytaiebchaumont2@gmail.com";

export default function LegalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.h1}>À propos & légal</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Tune">
          <Text style={styles.p}>
            Tune est une application gratuite de découverte musicale : swipe des
            extraits de 30 secondes, aime ce qui te plaît, et l'algorithme
            apprend tes goûts. Application sans but commercial.
          </Text>
        </Section>

        <Section title="Musique — attribution Deezer">
          <Text style={styles.p}>
            Les extraits musicaux (30 secondes), pochettes d'albums, noms
            d'artistes et classements sont fournis par l'API publique de
            Deezer. Tune n'héberge aucun enregistrement du commerce et ne
            permet ni téléchargement ni écoute intégrale : pour écouter un
            titre en entier, tu choisis ta plateforme (Spotify, Apple Music,
            YouTube, Deezer…) directement depuis la fiche du morceau.
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => Linking.openURL("https://www.deezer.com")}
          >
            <Ionicons name="open-outline" size={16} color={C.accent} />
            <Text style={styles.linkText}>deezer.com</Text>
          </Pressable>
        </Section>

        <Section title="Confidentialité">
          <Text style={styles.p}>
            • Tune ne collecte aucune donnée personnelle : pas de compte, pas
            de tracker, pas de publicité.{"\n"}
            • Tes goûts (swipes, scores de genres et d'artistes) et ta
            bibliothèque sont stockés uniquement sur ton appareil.{"\n"}
            • Les recherches et le chargement des extraits interrogent l'API
            Deezer ; ces requêtes sont soumises à la politique de
            confidentialité de Deezer.{"\n"}
            • Tu peux tout effacer à tout moment : Profil → « Réinitialiser mes
            données », ou en désinstallant l'application.
          </Text>
        </Section>


        <Section title="Contact">
          <Text style={styles.p}>
            Une question, un signalement, une réclamation de droits ?
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          >
            <Ionicons name="mail-outline" size={16} color={C.accent} />
            <Text style={styles.linkText}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </Section>

        <Text style={styles.footer}>Tune v1.0.0 — fait avec ❤ en France</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  section: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { color: C.accent, fontSize: 15, fontWeight: "700" },
  p: { color: C.muted, fontSize: 13.5, lineHeight: 21 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  linkText: { color: C.accent, fontSize: 14, fontWeight: "600" },
  footer: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
