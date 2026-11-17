import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { Button, Touch } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import { qk } from "@/lib/query";
import { useSession } from "@/lib/session";
import { useColors } from "@/theme";

export function NoWorkspace() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useSession();
  const invitations = useQuery({
    queryKey: qk.invitations,
    queryFn: api.pendingInvitations,
  });
  const pending = (invitations.data ?? []).filter(
    (i) => i.status === "pending",
  ).length;
  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 28,
          gap: 28,
        }}
      >
        <View style={{ gap: 10 }}>
          <Txt variant="title">{t("mobile:home.noWorkspace.title")}</Txt>
          <Txt variant="body" tone="muted" style={{ lineHeight: 22 }}>
            {t("mobile:home.noWorkspace.body")}
          </Txt>
        </View>
        <View style={{ gap: 10 }}>
          <Button
            label={t("mobile:home.noWorkspace.create")}
            onPress={() => router.push("/workspace/new")}
          />
          {pending ? (
            <Button
              label={t("mobile:home.noWorkspace.viewInvitations", {
                count: pending,
              })}
              kind="secondary"
              onPress={() => router.push("/invitations")}
              icon={
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.info,
                  }}
                />
              }
              style={{ flexDirection: "row-reverse" }}
            />
          ) : null}
          <Touch
            onPress={() => router.push("/invitations")}
            style={{
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt variant="bodySm" weight="medium" tone="muted">
              {t("mobile:home.noWorkspace.joinWithLink")}
            </Txt>
          </Touch>
        </View>
      </View>
      <Txt variant="meta" tone="faint" center style={{ paddingBottom: 36 }}>
        {t("mobile:home.noWorkspace.signedInAs", {
          email: session?.userEmail,
        })}
      </Txt>
    </Screen>
  );
}
