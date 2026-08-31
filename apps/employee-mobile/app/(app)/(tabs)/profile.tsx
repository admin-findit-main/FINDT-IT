import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ACCOUNT_DELETION_CONFIRMATION, displayName, roleLabel } from "@findit/domain";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassChip,
  GlassLabel,
} from "@findit/theme/native";
import { deleteMyAccount } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTabContentInset } from "@/components/useTabContentInset";

export default function ProfileScreen() {
  const { profile, activeStore, stores, setActiveStoreId, signOut } = useAuth();
  const { paddingBottom } = useTabContentInset();
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom,
        }}
      >
        <GlassCard level="strong" style={styles.identityCard}>
          <Text style={styles.name}>{displayName(profile || {})}</Text>
          <Text style={styles.meta}>{profile?.email}</Text>
          <Text style={styles.meta}>
            {activeStore?.name} · {activeStore ? roleLabel(activeStore.role) : ""}
          </Text>
        </GlassCard>

        {stores.length > 1 ? (
          <GlassCard level="base" style={styles.section}>
            <GlassLabel>Switch store</GlassLabel>
            <View style={styles.chips}>
              {stores.map((s) => (
                <GlassChip
                  key={s.id}
                  label={s.name}
                  selected={activeStore?.id === s.id}
                  onPress={() => setActiveStoreId(s.id)}
                  style={styles.chip}
                />
              ))}
            </View>
          </GlassCard>
        ) : null}

        <Text style={styles.hint}>
          Demand, team, and billing stay on the FINDIT web owner dashboard.
        </Text>

        <GlassButton
          title="Sign out"
          variant="glass"
          size="lg"
          onPress={signOut}
          style={styles.signOut}
          textStyle={styles.signOutText}
        />

        <GlassCard level="base" style={styles.section}>
          <GlassLabel>Delete account</GlassLabel>
          <Text style={styles.hint}>
            Type {ACCOUNT_DELETION_CONFIRMATION} to permanently delete this login.
          </Text>
          <TextInput
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={ACCOUNT_DELETION_CONFIRMATION}
            placeholderTextColor={theme.inkSubtle}
            style={styles.deleteInput}
          />
          {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
          <GlassButton
            title={deleting ? "Deleting…" : "Delete account"}
            variant="ink"
            loading={deleting}
            disabled={deleting}
            onPress={async () => {
              setDeleting(true);
              setDeleteError(null);
              const result = await deleteMyAccount(deleteText);
              setDeleting(false);
              if (result.error) {
                setDeleteError(result.error);
                return;
              }
              await signOut();
            }}
          />
        </GlassCard>
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  identityCard: { padding: spacing.xl },
  name: {
    color: theme.ink,
    fontSize: typography.size.title2,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.title,
  },
  meta: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    marginTop: spacing.sm,
  },
  section: { marginTop: spacing.lg },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: { minHeight: 44, justifyContent: "center" },
  hint: {
    color: theme.inkSubtle,
    fontSize: typography.size.footnote,
    lineHeight: 20,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  signOut: { marginTop: spacing.xl },
  signOutText: { color: theme.accentInk },
  deleteInput: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.hairline,
    paddingHorizontal: spacing.md,
    color: theme.ink,
    fontSize: typography.size.body,
  },
  deleteError: {
    color: theme.accentInk,
    fontSize: typography.size.footnote,
    marginBottom: spacing.sm,
  },
});
