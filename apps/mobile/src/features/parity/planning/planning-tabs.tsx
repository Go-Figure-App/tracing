import { ScrollView, View } from "react-native";
import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import { useColors } from "@/theme";

export function PlanningTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.divider }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      >
        {options.map((option) => (
          <Touch
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === option.value }}
            onPress={() => onChange(option.value)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor:
                  value === option.value ? c.fillStrong : "transparent",
              }}
            >
              <Txt
                variant="bodySm"
                weight={value === option.value ? "semibold" : "regular"}
                tone={value === option.value ? "ink" : "muted"}
              >
                {option.label}
              </Txt>
            </View>
          </Touch>
        ))}
      </ScrollView>
    </View>
  );
}
