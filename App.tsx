import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./app/index";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0A0A0F" />
      <HomeScreen />
    </SafeAreaProvider>
  );
}
