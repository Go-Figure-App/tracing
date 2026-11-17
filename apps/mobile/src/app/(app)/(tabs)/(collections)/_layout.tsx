import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-screens/experimental";
import { useColors } from "@/theme";

export const unstable_settings = { anchor: "more" };

export default function CollectionsLayout() {
  const c = useColors();
  return (
    <SafeAreaView
      edges={{ bottom: true }}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.surface },
        }}
      >
        <Stack.Screen name="more" />
      </Stack>
    </SafeAreaView>
  );
}
