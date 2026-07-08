/* Mini-toast maison (RN n'en fournit pas en natif multiplateforme). */

import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { C } from "./theme";

let listener: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  listener?.(msg);
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = m => {
      setMsg(m);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          () => setMsg(null)
        );
      }, 1800);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!msg) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    backgroundColor: "rgba(30,30,44,.96)",
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: "88%",
    zIndex: 100,
  },
  text: { color: C.text, fontSize: 13.5 },
});
