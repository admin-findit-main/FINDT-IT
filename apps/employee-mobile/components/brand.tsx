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
      style={[{ height: 36, width: 39 }, style]}
    />
  );
}

export function BrandBusiness({
  tone = "light",
  style,
}: {
  tone?: Tone;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="FINDIT Business"
      resizeMode="contain"
      source={
        tone === "dark"
          ? require("../assets/brand/findit-business-dark.png")
          : require("../assets/brand/findit-business-light.png")
      }
      style={[{ height: 28, width: 180 }, style]}
    />
  );
}
