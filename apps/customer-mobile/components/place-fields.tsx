import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  US_STATES,
  digitsPostalCode,
  lookupUsCity,
  lookupUsZip,
  normalizeStateCode,
  stateName,
  type ShortPlace,
} from "@findit/domain";
import { radius, spacing, typography } from "@findit/theme";
import { useAppTheme } from "@findit/theme/native";

export function PlaceFields({
  value,
  onChange,
}: {
  value: ShortPlace;
  onChange: (next: ShortPlace) => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [stateOpen, setStateOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ShortPlace[]>([]);
  const [looking, setLooking] = useState(false);
  const zipReq = useRef(0);
  const cityReq = useRef(0);

  useEffect(() => {
    const zip = digitsPostalCode(value.postalCode);
    if (zip.length !== 5) return;
    const id = ++zipReq.current;
    setLooking(true);
    const t = setTimeout(() => {
      lookupUsZip(zip).then((place) => {
        if (id !== zipReq.current) return;
        setLooking(false);
        if (!place) return;
        onChange({
          city: value.city.trim() || place.city,
          state: normalizeStateCode(value.state) || place.state,
          postalCode: place.postalCode,
        });
        setSuggestions([]);
      });
    }, 250);
    return () => clearTimeout(t);
    // Only react to ZIP digits so city typing doesn't retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitsPostalCode(value.postalCode)]);

  useEffect(() => {
    const city = value.city.trim();
    const state = normalizeStateCode(value.state);
    if (city.length < 3 || !state || digitsPostalCode(value.postalCode).length === 5) {
      setSuggestions([]);
      return;
    }
    const id = ++cityReq.current;
    const t = setTimeout(() => {
      lookupUsCity(state, city).then((places) => {
        if (id !== cityReq.current) return;
        if (places.length === 1) {
          onChange(places[0]);
          setSuggestions([]);
          return;
        }
        setSuggestions(places);
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.city, value.state]);

  const states = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    if (!q) return [...US_STATES];
    return US_STATES.filter(
      (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [stateQuery]);

  const inputStyle = {
    color: theme.ink,
    fontSize: typography.size.body,
    paddingVertical: 12,
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          placeholder="City"
          placeholderTextColor={theme.inkSubtle}
          autoCapitalize="words"
          value={value.city}
          onChangeText={(city) => onChange({ ...value, city, postalCode: "" })}
          style={[
            inputStyle,
            styles.city,
            { borderBottomColor: theme.hairlineStrong },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="State"
          onPress={() => {
            setStateQuery("");
            setStateOpen(true);
          }}
          style={[styles.stateBtn, { borderBottomColor: theme.hairlineStrong }]}
        >
          <Text style={[inputStyle, { color: value.state ? theme.ink : theme.inkSubtle }]}>
            {value.state ? `${value.state} · ${stateName(value.state)}` : "State"}
          </Text>
        </Pressable>
      </View>
      <TextInput
        placeholder="ZIP — we fill this in"
        placeholderTextColor={theme.inkSubtle}
        keyboardType="number-pad"
        maxLength={5}
        value={value.postalCode}
        onChangeText={(postalCode) =>
          onChange({ ...value, postalCode: digitsPostalCode(postalCode) })
        }
        style={[
          inputStyle,
          styles.field,
          { borderBottomColor: theme.hairlineStrong, color: theme.ink },
        ]}
      />
      {looking ? (
        <Text style={[styles.hint, { color: theme.inkSubtle }]}>Adding your ZIP…</Text>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={styles.suggest}>
          {suggestions.map((place) => (
            <Pressable
              key={`${place.postalCode}-${place.city}`}
              onPress={() => {
                onChange(place);
                setSuggestions([]);
              }}
              style={[styles.suggestItem, { backgroundColor: theme.solid3 }]}
            >
              <Text style={[styles.suggestText, { color: theme.ink }]}>
                {place.city} {place.postalCode}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={[styles.hint, { color: theme.inkSubtle }]}>
          Type your city — we’ll add the ZIP. No street address.
        </Text>
      )}

      <Modal
        visible={stateOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStateOpen(false)}
      >
        <View style={[styles.modal, { backgroundColor: theme.canvas, paddingTop: insets.top }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>State</Text>
            <Pressable onPress={() => setStateOpen(false)} style={styles.done}>
              <Text style={[styles.doneText, { color: theme.accentInk }]}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Search states"
            placeholderTextColor={theme.inkSubtle}
            value={stateQuery}
            onChangeText={setStateQuery}
            autoCorrect={false}
            style={[
              styles.search,
              {
                color: theme.ink,
                backgroundColor: theme.solid1,
                borderColor: theme.hairlineStrong,
              },
            ]}
          />
          <FlatList
            data={states}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange({ ...value, state: item.code, postalCode: "" });
                  setStateOpen(false);
                }}
                style={styles.stateRow}
              >
                <Text style={[styles.stateCode, { color: theme.ink }]}>{item.code}</Text>
                <Text style={[styles.stateName, { color: theme.inkMuted }]}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  row: { flexDirection: "row", gap: spacing.md },
  city: {
    flex: 1.4,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stateBtn: {
    flex: 0.9,
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
    lineHeight: 16,
  },
  suggest: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestItem: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    justifyContent: "center",
  },
  suggestText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  modal: { flex: 1, paddingHorizontal: spacing.lg },
  modalHead: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
  },
  done: { minHeight: 44, justifyContent: "center" },
  doneText: { fontSize: typography.size.body, fontWeight: typography.weight.semibold },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    marginBottom: spacing.md,
    fontSize: typography.size.body,
  },
  stateRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stateCode: {
    width: 36,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  stateName: { fontSize: typography.size.body },
});
