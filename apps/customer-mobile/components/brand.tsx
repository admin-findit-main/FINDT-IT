import { Image, type ImageStyle, type StyleProp } from "react-native";

type Tone = "light" | "dark";

export function BrandMark({
  tone = "light",
  style,
}: {
  tone?: Tone;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="FINDIT"
      resizeMode="contain"
      source={
        tone === "dark"
          ? require("../assets/brand/findit-mark-dark.png")
          : require("../assets/brand/findit-mark-light.png")
      }
      style={[{ height: 40, width: 43 }, style]}
    />
  );
}

export function BrandPlus({
  tone = "light",
  style,
}: {
  tone?: Tone;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="FINDIT+"
      resizeMode="contain"
      source={
        tone === "dark"
          ? require("../assets/brand/findit-plus-dark.png")
          : require("../assets/brand/findit-plus-light.png")
      }
      style={[{ height: 28, width: 120 }, style]}
    />
  );
}
