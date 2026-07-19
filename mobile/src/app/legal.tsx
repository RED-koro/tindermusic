/* À propos & mentions légales — requis pour la publication sur les stores :
   politique de confidentialité, CGU, attribution Deezer, contact. */

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S } from "../lib/strings";
import { C } from "../lib/theme";

export default function LegalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.h1}>{S.legal.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Section title={S.legal.aboutTitle}>
          <Text style={styles.p}>{S.legal.aboutBody}</Text>
        </Section>

        <Section title={S.legal.musicTitle}>
          <Text style={styles.p}>{S.legal.musicBody}</Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => Linking.openURL("https://www.deezer.com")}
          >
            <Ionicons name="open-outline" size={16} color={C.accent} />
            <Text style={styles.linkText}>deezer.com</Text>
          </Pressable>
        </Section>

        <Section title={S.legal.privacyTitle}>
          <Text style={styles.p}>{S.legal.privacyBody}</Text>
        </Section>

        <Section title={S.legal.contactTitle}>
          <Text style={styles.p}>{S.legal.contactBody}</Text>
        </Section>

        <Text style={styles.footer}>{S.legal.footer}</Text>
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
