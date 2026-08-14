import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { privacySafeRequestPayload } from "@findit/domain";
import { radius, spacing, status, theme, typography, type StatusTone } from "@findit/theme";
import {
  GlassBackdrop,
  GlassCard,
  GlassInput,
  GlassNotice,
  GlassSurface,
  StatusPill,
  toneForResponse,
} from "@findit/theme/native";
import { fetchRequestForStore, respondToRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { captureException } from "@/lib/monitoring";
import { TABLET_WIDTH } from "@/components/useTabContentInset";

/**
 * One of the three answers. Deliberately tinted glass rather than a saturated
 * fill: the `ink` tones clear 4.5:1 on light glass at any size, and brand red
 * stays reserved for actions.
 */
function AnswerButton({
  tone,
  label,
  minHeight,
  disabled,
  onPress,
  style,
}: {
  tone: StatusTone;
  label: string;
  minHeight: number;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tokens = status[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {({ pressed }) => (
        <GlassSurface
          level="strong"
          cornerRadius={radius.xl}
          style={[
            styles.answer,
            {
              minHeight,
              borderWidth: 1.5,
              borderColor: tokens.border,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tokens.tint }]}
          />
          <View style={[styles.answerDot, { backgroundColor: tokens.solid }]} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.answerText, { color: tokens.ink }]}
          >
            {label}
          </Text>
        </GlassSurface>
      )}
    </Pressable>
  );
}

export default function RespondScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeStore } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const tablet = width >= TABLET_WIDTH;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof fetchRequestForStore>
  >>(null);

  const load = useCallback(async () => {
    if (!id || !activeStore) return;
    const data = await fetchRequestForStore(id, activeStore.id);
    setDetail(data);
    setLoading(false);
  }, [id, activeStore]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (responseType: "in_stock" | "out_of_stock" | "can_order") => {
    if (!id || !activeStore) return;
    setBusy(true);
    setError(null);
    try {
      const result = await respondToRequest({
        requestId: id,
        storeId: activeStore.id,
        responseType,
        note: note || undefined,
        price: price ? Number(price) : null,
        estimatedAvailabilityLabel:
          responseType === "can_order" ? "This week" : undefined,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.back();
    } catch (e) {
      captureException(e);
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <GlassBackdrop style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </GlassBackdrop>
    );
  }
  if (!detail) {
    return (
      <GlassBackdrop style={styles.center}>
        <Text style={styles.meta}>Request not available for this store.</Text>
      </GlassBackdrop>
    );
  }

  const safe = privacySafeRequestPayload(detail.request);
  const btnHeight = Math.max(tablet ? 110 : 88, Math.min(140, height * 0.12));

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={{
          padding: tablet ? spacing.xl : spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard level="strong" style={styles.detailCard}>
          <Text style={styles.product}>{safe.product_name}</Text>
          {safe.description ? <Text style={styles.meta}>{safe.description}</Text> : null}
          <Text style={styles.meta}>
            {safe.category || "Uncategorized"} · near {safe.area_city}
          </Text>
          {safe.image_url ? (
            <Image source={{ uri: safe.image_url }} style={styles.image} resizeMode="cover" />
          ) : null}
        </GlassCard>

        {detail.response ? (
          <GlassSurface level="subtle" cornerRadius={radius.lg} style={styles.existingWrap}>
            <StatusPill tone={toneForResponse(detail.response.response_type)} />
            <Text style={styles.existing}>
              Already responded: {detail.response.response_type.replace(/_/g, " ")}
            </Text>
          </GlassSurface>
        ) : null}

        <View style={styles.fields}>
          <GlassInput
            placeholder="Optional note"
            value={note}
            onChangeText={setNote}
          />
          <GlassInput
            placeholder="Price (optional)"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
        </View>

        {error ? <GlassNotice tone="accent">{error}</GlassNotice> : null}

        <View style={[styles.actions, tablet && styles.actionsRow]}>
          <AnswerButton
            tone="inStock"
            label="IN STOCK"
            minHeight={btnHeight}
            disabled={busy}
            onPress={() => submit("in_stock")}
            style={tablet ? styles.actionFlex : undefined}
          />
          <AnswerButton
            tone="outOfStock"
            label="OUT"
            minHeight={btnHeight}
            disabled={busy}
            onPress={() => submit("out_of_stock")}
            style={tablet ? styles.actionFlex : undefined}
          />
          <AnswerButton
            tone="canOrder"
            label="CAN ORDER"
            minHeight={btnHeight}
            disabled={busy}
            onPress={() => submit("can_order")}
            style={tablet ? styles.actionFlex : undefined}
          />
        </View>
        {busy ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: spacing.lg }} />
        ) : null}
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  detailCard: { padding: spacing.xl },
  product: {
    color: theme.ink,
    fontSize: typography.size.title1,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.hero,
  },
  meta: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    backgroundColor: theme.glass2,
  },
  existingWrap: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  existing: {
    color: theme.inkMuted,
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
    textTransform: "capitalize",
  },
  fields: { marginTop: spacing.xl },
  actions: { marginTop: spacing.md, gap: spacing.md },
  actionsRow: { flexDirection: "row" },
  actionFlex: { flex: 1 },
  answer: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  answerDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
  },
  answerText: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.overline,
    textAlign: "center",
  },
});
