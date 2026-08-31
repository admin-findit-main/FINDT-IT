import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountContactLabel,
  displayName,
  shortPlaceFromProfile,
  type ShortPlace,
} from "@findit/domain";
import { spacing, typography } from "@findit/theme";
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
  ScreenTitle,
  useAppTheme,
} from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { PlaceFields } from "@/components/place-fields";
import { SettingsChoice, SettingsSection, SettingsToggle } from "@/components/settings-row";
import { useAppearance } from "@/lib/appearance";
import { deleteMyAccount, updateMyProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { profile, signOut, refreshProfile } = useAuth();
  const { scheme, setScheme } = useAppearance();
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [place, setPlace] = useState<ShortPlace>(() => shortPlaceFromProfile(profile));
  const [notifyInStock, setNotifyInStock] = useState(profile?.notify_in_stock ?? true);
  const [notifyCanOrder, setNotifyCanOrder] = useState(profile?.notify_can_order ?? true);
  const [notifyExpired, setNotifyExpired] = useState(profile?.notify_request_expired ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name || "");
    setPlace(shortPlaceFromProfile(profile));
    setNotifyInStock(profile?.notify_in_stock ?? true);
    setNotifyCanOrder(profile?.notify_can_order ?? true);
    setNotifyExpired(profile?.notify_request_expired ?? true);
  }, [
    profile?.first_name,
    profile?.default_city,
    profile?.default_state,
    profile?.default_postal_code,
    profile?.notify_in_stock,
    profile?.notify_can_order,
    profile?.notify_request_expired,
  ]);

  return (
    <AppChrome title="Profile">
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
      >
        <ScreenTitle
          title={displayName(profile || {})}
          subtitle={accountContactLabel(profile || {})}
        />

        <SettingsSection title="You" />
        <GlassCard>
          <GlassInput
            label="Name"
            value={firstName}
            onChangeText={(value) => {
              setFirstName(value);
              setSaved(false);
            }}
            autoCapitalize="words"
            placeholder="First name"
            containerStyle={{ marginBottom: 0 }}
          />
        </GlassCard>
        <GlassCard padded={false} style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Text style={[styles.contactLabel, { color: theme.inkMuted }]}>
              {profile?.email ? "Email" : "Phone"}
            </Text>
            <Text style={[styles.contactValue, { color: theme.ink }]} numberOfLines={1}>
              {accountContactLabel(profile || {})}
            </Text>
          </View>
        </GlassCard>

        <SettingsSection title="Place" />
        <GlassCard>
          <PlaceFields
            value={place}
            onChange={(next) => {
              setPlace(next);
              setSaved(false);
              setError(null);
            }}
          />
        </GlassCard>

        <SettingsSection title="Alerts" />
        <GlassCard padded={false}>
          <SettingsToggle
            label="In Stock replies"
            value={notifyInStock}
            onChange={(next) => {
              setNotifyInStock(next);
              setSaved(false);
            }}
          />
          <SettingsToggle
            label="Can Order replies"
            value={notifyCanOrder}
            onChange={(next) => {
              setNotifyCanOrder(next);
              setSaved(false);
            }}
          />
          <SettingsToggle
            label="Request expiration"
            value={notifyExpired}
            onChange={(next) => {
              setNotifyExpired(next);
              setSaved(false);
            }}
            last
          />
        </GlassCard>

        {error ? <GlassNotice>{error}</GlassNotice> : null}
        {saved ? (
          <Text style={[styles.hint, { color: theme.inkMuted }]}>Saved.</Text>
        ) : null}
        <GlassButton
          title="Save"
          loading={saving}
          disabled={saving}
          onPress={async () => {
            setSaving(true);
            setError(null);
            setSaved(false);
            const result = await updateMyProfile({
              firstName,
              city: place.city,
              state: place.state,
              postalCode: place.postalCode,
              notifyInStock,
              notifyCanOrder,
              notifyRequestExpired: notifyExpired,
            });
            setSaving(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            await refreshProfile();
            setSaved(true);
          }}
          style={styles.save}
        />

        <SettingsSection title="Appearance" />
        <GlassCard padded={false}>
          <View style={styles.choicePad}>
            <SettingsChoice
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
              value={scheme}
              onChange={(id) => setScheme(id === "light" ? "light" : "dark")}
            />
          </View>
        </GlassCard>

        <SettingsSection title="Account" />
        <GlassCard padded={false}>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.45 }]}
          >
            <Text style={[styles.signOutText, { color: theme.accentInk }]}>Sign out</Text>
          </Pressable>
        </GlassCard>
        <GlassCard style={{ marginTop: spacing.md }}>
          <Text style={[styles.contactLabel, { color: theme.inkMuted }]}>
            Type {ACCOUNT_DELETION_CONFIRMATION} to delete this account
          </Text>
          <GlassInput
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="characters"
            placeholder={ACCOUNT_DELETION_CONFIRMATION}
            containerStyle={{ marginBottom: spacing.sm, marginTop: spacing.sm }}
          />
          <GlassButton
            title={deleting ? "Deleting…" : "Delete account"}
            variant="ink"
            loading={deleting}
            disabled={deleting}
            onPress={async () => {
              setDeleting(true);
              setError(null);
              const result = await deleteMyAccount(deleteText);
              setDeleting(false);
              if (result.error) {
                setError(result.error);
                return;
              }
              await signOut();
            }}
          />
        </GlassCard>
      </ScrollView>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  contactCard: { marginTop: spacing.sm },
  contactRow: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 2,
    justifyContent: "center",
  },
  contactLabel: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  contactValue: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
  hint: {
    fontSize: typography.size.caption,
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  choicePad: { paddingVertical: spacing.xs },
  save: { marginTop: spacing.lg },
  signOut: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  signOutText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
});
