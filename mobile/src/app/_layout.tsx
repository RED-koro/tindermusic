import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StoreProvider } from "../lib/store";
import { C } from "../lib/theme";
import { Toaster } from "../lib/toast";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <StoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="artist" />
          <Stack.Screen name="artist-view" />
          <Stack.Screen name="legal" />
        </Stack>
        <Toaster />
      </StoreProvider>
    </GestureHandlerRootView>
  );
}
