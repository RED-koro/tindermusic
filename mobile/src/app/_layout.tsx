import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StoreProvider } from "../lib/store";
import { C } from "../lib/theme";
import { Toaster } from "../lib/toast";

/* Filet de sécurité global : si un écran plante, on affiche une reprise
   propre au lieu d'un écran blanc. Les données (AsyncStorage) sont intactes. */
interface EBState {
  hasError: boolean;
  resetKey: number;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<EBState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // V2 : envoyer à un service de crash reporting (Sentry)
    console.error("Écran planté, reprise proposée :", error);
  }

  reset = () => {
    this.setState(s => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.crash}>
          <Text style={{ fontSize: 44 }}>😵‍💫</Text>
          <Text style={styles.crashTitle}>Oups, ça a sauté.</Text>
          <Text style={styles.crashText}>
            Rien de grave : ta bibliothèque et tes goûts sont intacts.
          </Text>
          <Pressable style={styles.crashBtn} onPress={this.reset}>
            <Text style={styles.crashBtnText}>Relancer</Text>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <ErrorBoundary>
        <StoreProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="artist-view" />
            <Stack.Screen name="legal" />
          </Stack>
          <Toaster />
        </StoreProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 36,
  },
  crashTitle: { color: C.text, fontSize: 22, fontWeight: "800" },
  crashText: { color: C.muted, fontSize: 14.5, textAlign: "center", lineHeight: 21 },
  crashBtn: {
    backgroundColor: C.accent2,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 24,
    marginTop: 8,
  },
  crashBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
});
