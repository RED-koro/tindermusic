/* ================================================================
   Tune — Point d'entrée (React Native / Expo)
   Reproduit le prototype web « Tinder de la musique ».
   ================================================================ */

import 'react-native-gesture-handler';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import { PlaybackProvider } from './src/context/PlaybackContext';
import { ToastProvider } from './src/context/ToastContext';
import RootNavigator from './src/navigation/RootNavigator';
import { COLORS } from './src/constants/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
        <ToastProvider>
          <PlaybackProvider>
            <AppProvider>
              <RootNavigator />
            </AppProvider>
          </PlaybackProvider>
        </ToastProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
