import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AGE_RESTRICTED_FIND_HINT,
  AGE_RESTRICTED_ID_BODY,
  AGE_RESTRICTED_ID_CONFIRM,
  AGE_RESTRICTED_ID_TITLE,
  CUSTOMER_PLANS,
  PRODUCT_CATEGORIES,
  createRequestSchema,
  digitsPostalCode,
  findPlaceholderForCategory,
  formatShortPlace,
  getConsumerEntitlements,
  isAgeRestrictedFind,
  isCompleteShortPlace,
  isMonthlyFindCapError,
  lookupUsZip,
  normalizeStateCode,
  reverseGeocodeUs,
  planLimitReachedMessage,
  radiusLimitMessage,
  radiusOptionsForPlan,
  REQUEST_IMAGES_BUCKET,
  shortPlaceFromProfile,
  type ShortPlace,
} from "@findit/domain";
import { radius, shadow, spacing, typography } from "@findit/theme";
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
  useAppTheme,
  useReducedMotion,
} from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { PlaceFields } from "@/components/place-fields";
import { createAndRouteRequest, fetchPlanUsage, updateMyPlace } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { captureException } from "@/lib/monitoring";
import { supabase } from "@/lib/supabase";

type Step = "query" | "id" | "radius";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeFindItScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const radiusChoices = useMemo(
    () => radiusOptionsForPlan(entitlements.maxSearchRadiusMiles),
    [entitlements.maxSearchRadiusMiles]
  );
  const [step, setStep] = useState<Step>("query");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [place, setPlace] = useState<ShortPlace>(() => shortPlaceFromProfile(profile));
  const [radiusMiles, setRadiusMiles] = useState(
    Math.min(10, entitlements.maxSearchRadiusMiles)
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);
  const [atCap, setAtCap] = useState(false);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(entitlements.monthlyRequestLimit);
  const [showDetails, setShowDetails] = useState(false);
  const [editPlace, setEditPlace] = useState(false);
  const [idFrom, setIdFrom] = useState<Step>("query");
  const [locating, setLocating] = useState(false);
  const autoLocated = useRef(false);

  const loadUsage = useCallback(async () => {
    const usage = await fetchPlanUsage();
    if (!usage) return;
    const word = usage.entitlements.planId === "plus" ? "FINDIT+ Finds" : "free Finds";
    setUsageLabel(`${usage.remaining} of ${usage.limit} ${word} left this month`);
    setAtCap(usage.remaining === 0);
    setUsed(usage.used);
    setLimit(usage.limit);
    if (usage.remaining === 0) setStep("query");
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsage();
      setPlace(shortPlaceFromProfile(profile));
    }, [loadUsage, profile?.default_city, profile?.default_state, profile?.default_postal_code])
  );

  const attachPhoto = () => {
    Alert.alert("Add a photo", "Show stores exactly what you want.", [
      {
        text: "Take photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            setError("Camera permission denied — you can still submit without a photo.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
        },
      },
      {
        text: "Photo library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            setError("Photo library permission denied — you can still submit without a photo.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const useLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location denied — enter city and ZIP manually.");
        setEditPlace(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const places = await Location.reverseGeocodeAsync(loc.coords);
      const p = places[0];
      let next: ShortPlace = {
        city: p?.city || p?.subregion || "",
        state: normalizeStateCode(p?.region) || "",
        postalCode: digitsPostalCode(p?.postalCode || ""),
      };
      if (!isCompleteShortPlace(next)) {
        const found = await reverseGeocodeUs(loc.coords.latitude, loc.coords.longitude);
        if (found) next = found;
      } else if (next.postalCode) {
        const zip = await lookupUsZip(next.postalCode);
        if (zip) next = zip;
      }
      setPlace(next);
      setEditPlace(!isCompleteShortPlace(next));
      if (!isCompleteShortPlace(next)) {
        setError("Confirm your city and ZIP so we can ask nearby stores.");
      } else {
        setError(null);
      }
    } catch {
      setError("Couldn’t get location. Enter city and ZIP manually.");
      setEditPlace(true);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (step !== "radius" || autoLocated.current) return;
    if (isCompleteShortPlace(place)) return;
    autoLocated.current = true;
    void useLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when the radius step opens
  }, [step]);

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

  const animateStep = () => {
    if (reducedMotion) return;
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };

  const goRadius = () => {
    if (atCap) {
      setError(planLimitReachedMessage(entitlements));
      setStep("query");
      return;
    }
    if (!productName.trim() && !imageUri) {
      setError("Type a product name or add a photo.");
      return;
    }
    setError(null);
    setEditPlace(!place.postalCode.trim() || !place.city.trim() || !place.state.trim());
    const restrictedFind = isAgeRestrictedFind({
      category,
      productName,
      description,
    });
    animateStep();
    if (restrictedFind && !idConfirmed) {
      setIdFrom("query");
      setStep("id");
      return;
    }
    if (restrictedFind) setShowDetails(true);
    setStep("radius");
  };

  const onSubmit = async () => {
    if (atCap) {
      setError(planLimitReachedMessage(entitlements));
      setStep("query");
      return;
    }
    if (
      isAgeRestrictedFind({ category, productName, description }) &&
      !idConfirmed
    ) {
      setIdFrom("radius");
      animateStep();
      setStep("id");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let nextPlace = place;
      if (!nextPlace.city.trim() && nextPlace.postalCode.trim()) {
        const found = await lookupUsZip(nextPlace.postalCode);
        if (found) {
          nextPlace = found;
          setPlace(found);
        }
      }
      if (!isCompleteShortPlace(nextPlace)) {
        setEditPlace(true);
        setError("Add your city, state, and ZIP so we can ask nearby stores.");
        return;
      }

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
        productName: productName.trim() || "Item in photo",
        description,
        category,
        city: nextPlace.city,
        state: nextPlace.state || profile?.default_state || "VA",
        postalCode: nextPlace.postalCode,
        radiusMiles,
        expirationHours: 24,
        imageUrl,
        imageStoragePath,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        ageRestrictedConfirmed:
          !isAgeRestrictedFind({ category, productName, description }) ||
          idConfirmed,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message || "Check your form");
        setEditPlace(true);
        return;
      }

      const result = await createAndRouteRequest(parsed.data);
      if ("error" in result) {
        if (result.code === "plan_limit" || isMonthlyFindCapError(result.error)) {
          setAtCap(true);
          setStep("query");
          await loadUsage();
        }
        setError(result.error);
        return;
      }
      router.push(`/(app)/request/${result.request.id}`);
      setProductName("");
      setDescription("");
      setCategory("");
      setIdConfirmed(false);
      setImageUri(null);
      setShowDetails(false);
      setStep("query");
      await updateMyPlace(nextPlace);
      await refreshProfile();
      loadUsage();
    } catch (e) {
      captureException(e, { where: "createRequest" });
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const plus = CUSTOMER_PLANS.plus;
  const placeLabel = formatShortPlace(place) || "Add city, state & ZIP";
  const restricted = isAgeRestrictedFind({
    category,
    productName,
    description,
  });

  return (
    <AppChrome brand>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          alwaysBounceVertical
          contentContainerStyle={[
            styles.scroll,
            step === "query" && styles.scrollHero,
            step === "id" && styles.scrollHero,
          ]}
        >
          {step === "query" ? (
            <View>
              <Text style={[styles.kicker, { color: theme.inkMuted }]}>FINDIT</Text>
              <Text style={[styles.hero, { color: theme.ink }]}>
                What are you looking for?
              </Text>
              <Text style={[styles.sub, { color: theme.inkMuted }]}>
                Ask nearby stores at once. They tell you if they have it.
              </Text>

              <View
                style={[
                  styles.search,
                  shadow.card,
                  { backgroundColor: theme.solid1, borderColor: theme.hairlineStrong },
                ]}
              >
                <TextInput
                  value={productName}
                  onChangeText={(v) => {
                    setProductName(v);
                    setIdConfirmed(false);
                    if (error) setError(null);
                  }}
                  placeholder={findPlaceholderForCategory(null)}
                  placeholderTextColor={theme.inkSubtle}
                  returnKeyType="next"
                  onSubmitEditing={atCap ? undefined : goRadius}
                  editable={!atCap}
                  autoCorrect
                  autoFocus={!atCap}
                  style={[styles.searchInput, { color: theme.ink }]}
                />
              </View>

              <Pressable
                onPress={atCap ? undefined : attachPhoto}
                style={[
                  styles.photoCard,
                  { backgroundColor: theme.solid1, borderColor: theme.hairlineStrong },
                ]}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <FontAwesome name="camera" size={18} color={theme.inkMuted} />
                    <Text style={[styles.photoLabel, { color: theme.ink }]}>
                      Add a photo
                    </Text>
                    <Text style={[styles.photoHint, { color: theme.inkMuted }]}>
                      Optional — or just type the name above
                    </Text>
                  </View>
                )}
              </Pressable>
              {imageUri ? (
                <Pressable
                  onPress={() => setImageUri(null)}
                  hitSlop={8}
                  style={styles.photoRemove}
                >
                  <Text style={[styles.link, { color: theme.inkMuted }]}>Remove photo</Text>
                </Pressable>
              ) : null}

              {atCap ? (
                <GlassNotice>
                  {`${used} / ${limit} Finds used this month. Canceling a Find does not give it back. New Finds open next month. ${plus.name} is not billing yet.`}
                </GlassNotice>
              ) : null}
              {error && !atCap ? <GlassNotice>{error}</GlassNotice> : null}

              {atCap ? (
                <>
                  <GlassButton
                    title="See plans"
                    size="lg"
                    onPress={() => router.navigate("/(app)/(tabs)/plan")}
                    style={styles.cta}
                  />
                  <GlassButton
                    title="View your Finds"
                    variant="ghost"
                    size="lg"
                    onPress={() => router.navigate("/(app)/(tabs)/requests")}
                    style={styles.cta}
                  />
                </>
              ) : (
                <GlassButton
                  title="Continue"
                  size="lg"
                  disabled={busy || (!productName.trim() && !imageUri)}
                  onPress={goRadius}
                  style={styles.cta}
                />
              )}
              {usageLabel ? (
                <Text style={[styles.usage, { color: theme.inkSubtle }]}>{usageLabel}</Text>
              ) : null}
            </View>
          ) : step === "id" ? (
            <View>
              <Pressable
                onPress={() => {
                  animateStep();
                  setStep(idFrom);
                }}
                hitSlop={8}
              >
                <Text style={[styles.link, { color: theme.inkMuted }]}>Back</Text>
              </Pressable>
              <Text style={[styles.hero, { color: theme.ink, marginTop: spacing.lg }]}>
                {AGE_RESTRICTED_ID_TITLE}
              </Text>
              <Text style={[styles.sub, { color: theme.inkMuted }]}>
                {AGE_RESTRICTED_ID_BODY}
              </Text>
              <Text style={[styles.sectionSub, { color: theme.ink, marginTop: spacing.md }]}>
                {AGE_RESTRICTED_FIND_HINT}
              </Text>
              <GlassButton
                title={AGE_RESTRICTED_ID_CONFIRM}
                size="lg"
                onPress={() => {
                  setIdConfirmed(true);
                  setShowDetails(true);
                  animateStep();
                  setStep("radius");
                }}
                style={styles.cta}
              />
            </View>
          ) : (
            <View>
              <Pressable
                onPress={() => {
                  animateStep();
                  setStep("query");
                }}
                style={({ pressed }) => [
                  styles.looking,
                  { backgroundColor: theme.solid1, borderColor: theme.hairlineStrong },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <Text style={[styles.lookingLabel, { color: theme.inkMuted }]}>
                  Looking for
                </Text>
                <Text style={[styles.lookingValue, { color: theme.ink }]} numberOfLines={2}>
                  {productName.trim() || "Item in photo"}
                </Text>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.lookingPhoto} />
                ) : null}
                <Text style={[styles.edit, { color: theme.accentInk }]}>Edit</Text>
              </Pressable>
              {restricted ? (
                <Text style={[styles.sectionSub, { color: theme.inkMuted, marginTop: -spacing.md }]}>
                  {AGE_RESTRICTED_FIND_HINT}
                </Text>
              ) : null}

              <Text style={[styles.sectionTitle, { color: theme.ink }]}>
                Category
              </Text>
              <Text style={[styles.sectionSub, { color: theme.inkMuted }]}>
                Optional — helps us ask the right stores. Tobacco & vape asks for ID first.
              </Text>
              <View style={styles.chips}>
                {PRODUCT_CATEGORIES.map((item) => {
                  const selected = category === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        const next = category === item ? "" : item;
                        setCategory(next);
                        setIdConfirmed(false);
                        if (
                          isAgeRestrictedFind({
                            category: next,
                            productName,
                            description,
                          })
                        ) {
                          setIdFrom("radius");
                          animateStep();
                          setStep("id");
                        }
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? theme.accentSoft : theme.solid1,
                          borderColor: selected ? theme.accentRing : theme.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? theme.accentInk : theme.ink,
                          fontSize: typography.size.caption,
                          fontWeight: selected
                            ? typography.weight.semibold
                            : typography.weight.medium,
                        }}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.ink }]}>
                How far should we look?
              </Text>
              <Text style={[styles.sectionSub, { color: theme.inkMuted }]}>
                {radiusLimitMessage(entitlements)}
              </Text>

              <GlassCard padded={false} style={styles.radiusCard}>
                {radiusChoices.map((o, i) => {
                  const selected = radiusMiles === o.miles;
                  return (
                    <Pressable
                      key={o.miles}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setRadiusMiles(o.miles)}
                      style={({ pressed }) => [
                        styles.radiusRow,
                        i < radiusChoices.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.hairlineStrong,
                        },
                        pressed && { backgroundColor: theme.solid3 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusLabel,
                          { color: theme.ink, fontWeight: selected ? "600" : "400" },
                        ]}
                      >
                        {o.label}
                      </Text>
                      {selected ? (
                        <FontAwesome name="check" size={16} color={theme.accent} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </GlassCard>
              {entitlements.planId !== "plus" ? (
                <Text style={[styles.planHint, { color: theme.inkSubtle }]}>
                  FINDIT+ searches up to {plus.maxRadiusMiles} miles.
                </Text>
              ) : null}

              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Near</Text>
              <GlassCard padded={false}>
                <Pressable
                  onPress={() => setEditPlace((v) => !v)}
                  style={styles.placeRow}
                >
                  <View style={styles.fill}>
                    <Text style={[styles.placeValue, { color: theme.ink }]}>{placeLabel}</Text>
                    {coords ? (
                      <Text style={[styles.placeMeta, { color: theme.inkSubtle }]}>
                        Location attached
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.edit, { color: theme.accentInk }]}>
                    {editPlace ? "Done" : "Change"}
                  </Text>
                </Pressable>
                {editPlace ? (
                  <View style={[styles.placeEdit, { borderTopColor: theme.hairlineStrong }]}>
                    <PlaceFields value={place} onChange={setPlace} />
                    <Pressable onPress={useLocation} style={styles.linkPress}>
                      <Text style={[styles.link, { color: theme.inkMuted }]}>
                        {locating ? "Getting ZIP…" : "Use my location"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </GlassCard>

              <Pressable
                onPress={() => setShowDetails((v) => !v)}
                style={styles.detailsToggle}
              >
                <Text style={[styles.link, { color: theme.inkMuted }]}>
                  {showDetails ? "Hide details" : "Add details (optional)"}
                </Text>
              </Pressable>
              {showDetails ? (
                <GlassCard>
                  <GlassInput
                    inset
                    last
                    placeholder={
                      restricted ? AGE_RESTRICTED_FIND_HINT : "Details (optional)"
                    }
                    multiline
                    value={description}
                    onChangeText={setDescription}
                  />
                </GlassCard>
              ) : null}

              {error ? <GlassNotice>{error}</GlassNotice> : null}

              <GlassButton
                title="Find it"
                size="lg"
                loading={busy}
                disabled={busy || atCap}
                onPress={onSubmit}
                style={styles.cta}
              />
              <Text style={[styles.usage, { color: theme.inkSubtle }]}>
                We’ll ask participating stores near your ZIP. Your contact stays private.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  scrollHero: {
    justifyContent: "center",
    paddingBottom: 80,
  },
  kicker: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  hero: {
    fontSize: typography.size.hero,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.hero,
    lineHeight: 42,
  },
  sub: {
    marginTop: spacing.md,
    fontSize: typography.size.callout,
    lineHeight: 24,
    maxWidth: 340,
  },
  search: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    fontSize: typography.size.callout,
    paddingVertical: 16,
  },
  photoCard: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    minHeight: 140,
  },
  photoPreview: {
    width: "100%",
    height: 180,
  },
  photoEmpty: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  photoLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  photoHint: {
    fontSize: typography.size.footnote,
    textAlign: "center",
  },
  photoRemove: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  lookingPhoto: {
    marginTop: spacing.sm,
    height: 72,
    width: 72,
    borderRadius: radius.md,
  },
  cta: { marginTop: spacing.lg },
  usage: {
    marginTop: spacing.md,
    fontSize: typography.size.caption,
    textAlign: "center",
    lineHeight: 18,
  },
  looking: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  lookingLabel: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
  },
  lookingValue: {
    marginTop: 4,
    fontSize: typography.size.title3,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.tracking.title,
  },
  edit: {
    marginTop: spacing.sm,
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
  },
  sectionTitle: {
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
  },
  sectionSub: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    fontSize: typography.size.footnote,
    lineHeight: 18,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  radiusCard: { marginBottom: spacing.sm },
  radiusRow: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  radiusLabel: { fontSize: typography.size.body },
  planHint: {
    marginBottom: spacing.xl,
    fontSize: typography.size.caption,
    paddingHorizontal: spacing.xs,
  },
  placeRow: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  placeValue: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  placeMeta: {
    marginTop: 2,
    fontSize: typography.size.caption,
  },
  placeEdit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  detailsToggle: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  linkPress: { minHeight: 44, justifyContent: "center" },
  link: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
});
