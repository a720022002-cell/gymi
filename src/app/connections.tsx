import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { type ArtKind, DeviceArt } from "@/components/DeviceArt";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useToast } from "@/components/Toast";
import { Card, Row } from "@/components/ui";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { phoneSource, useDevices } from "@/lib/devices";
import {
  type WearableProvider,
  wearableStatus,
  type WearableStatus,
} from "@/lib/wearables";
import { useSettings } from "@/theme/settings";

/** Connections: what links straight to Gymi, and what comes in through the phone's health app. */
export default function Connections() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const [ws, setWs] = useState<WearableStatus | null>(null);
  useEffect(() => {
    wearableStatus().then(setWs);
  }, []);

  const hub = Platform.OS === "android" ? "Health Connect" : "Apple Health";

  const linked = (p: WearableProvider) =>
    ws?.links.find((l) => l.provider === p);
  const wearState = (p: WearableProvider) => {
    const l = linked(p);
    return l
      ? l.status === "ok"
        ? "Connected"
        : "Sign in again"
      : ws?.configured[p]
        ? "Connect"
        : "Coming soon";
  };
  const direct: {
    name: string;
    art: ArtKind;
    state: string;
    on?: boolean;
    go?: () => void;
  }[] = [
    {
      name: phoneSource ? hub : "Apple Health",
      art: phoneSource === "health_connect" ? "health_connect" : "health",
      state: phoneSource
        ? dev.connected
          ? "Connected"
          : "Connect"
        : "Phone app",
      on: dev.connected,
      go: () => router.push("/devices"),
    },
    {
      name: "WHOOP",
      art: "whoop",
      state: wearState("whoop"),
      on: linked("whoop")?.status === "ok",
      go: () => router.push("/devices"),
    },
    {
      name: "Oura Ring",
      art: "oura",
      state: wearState("oura"),
      on: linked("oura")?.status === "ok",
      go: () => router.push("/devices"),
    },
    { name: "Google Fitbit Air", art: "fitbitair", state: "Coming soon" },
    { name: "Polar", art: "polar", state: "Coming soon" },
    { name: "Fitbit", art: "fitbit", state: "Coming soon" },
  ];

  const section = (title: string, color: string, sub?: string) => (
    <View style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
      <Text
        variant="xs"
        weight={700}
        color={color}
        style={{ letterSpacing: 1.2, textTransform: "uppercase" }}
      >
        {title}
      </Text>
      {sub ? (
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen title={t("Connections")} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t(
          "Some things connect straight to Gymi. Everything else comes in through Apple Health or Health Connect.",
        )}
      </Text>
      {section(t("Connects straight to Gymi"), c.cobalt)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {direct.map((d) => (
          <Card
            key={d.name}
            onPress={
              d.go ??
              (() =>
                toast(
                  t(
                    "{n} is coming soon. Until then, it reaches Gymi through {h}.",
                    { n: d.name, h: hub },
                  ),
                  { icon: "watch" },
                ))
            }
            style={{
              width: "48%",
              flexGrow: 1,
              marginBottom: 0,
              minHeight: 150,
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: -6,
                marginEnd: -6,
              }}
            >
              <DeviceArt kind={d.art} size={68} />
            </View>
            <View style={{ marginTop: 4 }}>
              <Text weight={700}>{d.name}</Text>
              <Text
                variant="xs"
                weight={700}
                color={d.on ? "up" : "sec"}
                style={{ marginTop: 2 }}
              >
                {t(d.state)}
              </Text>
            </View>
          </Card>
        ))}
      </View>
      <Text
        variant="xs"
        color="sec"
        style={{ marginTop: 8, marginHorizontal: 4 }}
      >
        {t("More direct connections are coming soon.")}
      </Text>

      {section(
        t("Everything else already works"),
        c.up,
        t(
          "Most watches, rings, scales and fitness apps reach Gymi through {h}. Yours is almost surely one of them.",
          { h: hub },
        ),
      )}
      <Card onPress={() => router.push("/devices")}>
        <Row style={{ alignItems: "center" }}>
          <Icon name="heart" size={26} color={c.down} />
          <View style={{ flex: 1 }}>
            <Text weight={700} size={17}>
              {phoneSource ? hub : "Apple Health · Health Connect"}
            </Text>
            <Text variant="small" color="sec">
              {t(
                dev.connected
                  ? "Connected. Your readings come in by themselves."
                  : "Connect to bring in your health data",
              )}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </Row>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
          }}
        >
          {[t("Your device"), t("Its own app"), hub, "Gymi"].map((s, i, a) => (
            <Row key={s} gap={6} style={{ alignItems: "center" }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: i === a.length - 1 ? c.cobalt : c.inset,
                }}
              >
                <Text
                  variant="xs"
                  weight={700}
                  color={i === a.length - 1 ? "#FFFFFF" : c.sec}
                >
                  {s}
                </Text>
              </View>
              {i < a.length - 1 ? (
                <Icon
                  name={lang === "ar" ? "back" : "chev"}
                  size={12}
                  color={c.sec}
                />
              ) : null}
            </Row>
          ))}
        </View>
        <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
          {t(
            "Like Garmin, Galaxy Watch, Polar, COROS, Suunto, Huawei, Amazfit, Withings, Strava and many more.",
          )}
        </Text>
      </Card>
    </Screen>
  );
}
