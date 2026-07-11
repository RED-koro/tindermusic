import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { S } from "../../lib/strings";
import { C } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: "rgba(8,8,13,.96)",
          borderTopColor: "#16161f",
        },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: S.tabs.discover,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: S.tabs.library,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: S.tabs.search,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: S.tabs.profile,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
