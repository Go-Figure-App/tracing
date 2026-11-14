import type { ReactNode } from "react";
import { View } from "react-native";
import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import { useColors } from "@/theme";

export function PlanningPropertyChip({
  label,
  value,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const c = useColors();
  const content = (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.hairline,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        maxWidth: "100%",
      }}
    >
      {icon}
      <Txt variant="meta" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Txt>
    </View>
  );
  return onPress ? (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        maxWidth: "100%",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {content}
    </Touch>
  ) : (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ minHeight: 44, justifyContent: "center", maxWidth: "100%" }}
    >
      {content}
    </View>
  );
}
