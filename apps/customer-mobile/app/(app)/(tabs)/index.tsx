import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  EXPIRATION_OPTIONS,
  PRODUCT_CATEGORIES,
  RADIUS_OPTIONS,
  createRequestSchema,
} from "@findit/domain";
import { radius, spacing } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassChip,
  GlassInput,
  GlassLabel,
  GlassNotice,
  ScreenTitle,
} from "@findit/theme/native";
import { createAndRouteRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { REQUEST_IMAGES_BUCKET } from "@findit/domain";
import { captureException } from "@/lib/monitoring";

export default function HomeFindItScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [city, setCity] = useState(profile?.default_city || "");
  const [postalCode, setPostalCode] = useState(profile?.default_postal_code || "");
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [expirationHours, setExpirationHours] = useState(24);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission denied — you can still submit without a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const useLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Location denied — enter city and ZIP manually.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    const places = await Location.reverseGeocodeAsync(loc.coords);
    const p = places[0];
    if (p?.city) setCity(p.city);
    if (p?.postalCode) setPostalCode(p.postalCode);
  };

  const uploadImage = async (uri: string, userId: string) => {
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const res = await fetch(uri);
    const blob = await res.blob();
    const { error: upErr } = await supabase.storage
      .from(REQUEST_IMAGES_BUCKET)
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(REQUEST_IMAGES_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in");
        return;
      }

      let imageUrl: string | null = null;
      let imageStoragePath: string | null = null;
      if (imageUri) {
        const uploaded = await uploadImage(imageUri, user.id);
        imageUrl = uploaded.url;
        imageStoragePath = uploaded.path;
      }

      const parsed = createRequestSchema.safeParse({
        productName,
        description,
        category: category || "",
        city,
        state: profile?.default_state || "VA",
        postalCode,
        radiusMiles,
        expirationHours,
        imageUrl,
        imageStoragePath,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message || "Check your form");
        return;
      }

      const result = await createAndRouteRequest(parsed.data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/(app)/request/${result.request.id}`);
      setProductName("");
      setDescription("");
      setImageUri(null);
    } catch (e) {
      captureException(e, { where: "createRequest" });
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle title="What are you looking for?" />

        <GlassCard level="subtle" style={styles.card}>
          <GlassInput
            placeholder="Product name"
            value={productName}
            onChangeText={setProductName}
          />
          <GlassInput
            placeholder="Details (optional)"
            multiline
            value={description}
            onChangeText={setDescription}
            containerStyle={styles.lastField}
          />

          <GlassLabel>Category</GlassLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroller}
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <GlassChip
                key={c}
                label={c}
                selected={category === c}
                onPress={() => setCategory(category === c ? "" : c)}
                style={styles.chip}
              />
            ))}
          </ScrollView>
        </GlassCard>

        <GlassCard level="subtle" style={styles.card}>
          <View style={styles.row}>
            <GlassInput
              placeholder="City"
              value={city}
              onChangeText={setCity}
              containerStyle={styles.cityField}
            />
            <GlassInput
              placeholder="ZIP"
              keyboardType="number-pad"
              value={postalCode}
              onChangeText={setPostalCode}
              containerStyle={styles.zipField}
            />
          </View>

          <GlassButton
            title="Use my location"
            variant="glass"
            onPress={useLocation}
            style={styles.secondaryAction}
          />
          <GlassButton
            title={imageUri ? "Photo attached ✓" : "Add photo (optional)"}
            variant="glass"
            onPress={pickImage}
          />
        </GlassCard>

        <GlassCard level="subtle" style={styles.card}>
          <GlassLabel>Search radius</GlassLabel>
          <View style={styles.rowWrap}>
            {RADIUS_OPTIONS.map((o) => (
              <GlassChip
                key={o.miles}
                label={o.label}
                selected={radiusMiles === o.miles}
                onPress={() => setRadiusMiles(o.miles)}
                style={styles.chip}
              />
            ))}
          </View>

          <View style={styles.fieldGap}>
            <GlassLabel>Expires</GlassLabel>
          </View>
          <View style={styles.rowWrap}>
            {EXPIRATION_OPTIONS.map((o) => (
              <GlassChip
                key={o.hours}
                label={o.label}
                selected={expirationHours === o.hours}
                onPress={() => setExpirationHours(o.hours)}
                style={styles.chip}
              />
            ))}
          </View>
        </GlassCard>

        {error ? <GlassNotice>{error}</GlassNotice> : null}

        <GlassButton
          title="FIND IT"
          size="lg"
          loading={busy}
          disabled={busy}
          onPress={onSubmit}
          style={styles.cta}
          textStyle={styles.ctaText}
        />
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  card: { marginBottom: spacing.lg },
  lastField: { marginBottom: spacing.lg },
  chipScroller: { gap: spacing.sm, paddingRight: spacing.xs },
  chip: { minHeight: 44, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  cityField: { flex: 1 },
  zipField: { width: 110, marginLeft: spacing.sm },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  fieldGap: { marginTop: spacing.lg },
  secondaryAction: { marginBottom: spacing.sm },
  cta: { marginTop: spacing.xs, borderRadius: radius.xl },
  ctaText: { fontSize: 20, fontWeight: "800", letterSpacing: 1 },
});
