import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useApp, Commute } from '@/contexts/AppContext';

const LOCATIONS = [
  { lat: 42.3601, lng: -71.0589, name: 'Downtown Crossing' },
  { lat: 42.3554, lng: -71.0640, name: 'Boston Common' },
  { lat: 42.3516, lng: -71.0666, name: 'Back Bay' },
  { lat: 42.3625, lng: -71.0567, name: 'Government Center' },
  { lat: 42.3656, lng: -71.0618, name: 'North End' },
  { lat: 42.3467, lng: -71.0972, name: 'Brookline Village' },
  { lat: 42.3519, lng: -71.0552, name: 'South Station' },
  { lat: 42.3662, lng: -71.0621, name: 'Haymarket' },
  { lat: 42.3526, lng: -71.0550, name: 'Financial District' },
  { lat: 42.3395, lng: -71.0943, name: 'Coolidge Corner' },
  { lat: 42.3736, lng: -71.1190, name: 'Harvard Square' },
  { lat: 42.3625, lng: -71.0862, name: 'MIT Campus' },
];

export default function CommuteSetupScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { user, commute: existingCommute, setCommute } = useApp();

  const [startSearch, setStartSearch] = useState(existingCommute?.startLocation.name || '');
  const [endSearch, setEndSearch] = useState(existingCommute?.endLocation.name || '');
  const [startLocation, setStartLocation] = useState(existingCommute?.startLocation || null);
  const [endLocation, setEndLocation] = useState(existingCommute?.endLocation || null);
  const [earliestDeparture, setEarliestDeparture] = useState(existingCommute?.earliestDeparture || '7:30 AM');
  const [latestArrival, setLatestArrival] = useState(existingCommute?.latestArrival || '8:45 AM');
  const [transportMode, setTransportMode] = useState<'walk' | 'transit'>(existingCommute?.transportMode || 'walk');
  const [matchPreference, setMatchPreference] = useState<'group' | 'individual'>(existingCommute?.matchPreference || 'individual');
  const [genderPreference, setGenderPreference] = useState<'any' | 'same'>(existingCommute?.genderPreference || 'any');
  const [showStartResults, setShowStartResults] = useState(false);
  const [showEndResults, setShowEndResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredStartLocations = LOCATIONS.filter(l =>
    l.name.toLowerCase().includes(startSearch.toLowerCase()) && (!endLocation || l.name !== endLocation.name)
  );

  const filteredEndLocations = LOCATIONS.filter(l =>
    l.name.toLowerCase().includes(endSearch.toLowerCase()) && (!startLocation || l.name !== startLocation.name)
  );

  const canSave = startLocation && endLocation && earliestDeparture && latestArrival;

  const handleSave = async () => {
    if (!canSave || !user || isSaving) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newCommute: Commute = {
      id: existingCommute?.id || Crypto.randomUUID(),
      userId: user.id,
      startLocation: startLocation!,
      endLocation: endLocation!,
      earliestDeparture,
      latestArrival,
      transportMode,
      matchPreference,
      genderPreference,
      status: 'queued',
      createdAt: existingCommute?.createdAt || new Date().toISOString(),
    };

    await setCommute(newCommute);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {existingCommute ? 'Edit Commute' : 'Set Up Commute'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Start Location</Text>
          <View style={styles.locationInputWrapper}>
            <Ionicons name="radio-button-on" size={16} color={Colors.accent} />
            <TextInput
              style={styles.locationInput}
              value={startSearch}
              onChangeText={(text) => {
                setStartSearch(text);
                setShowStartResults(true);
                if (!text) setStartLocation(null);
              }}
              onFocus={() => setShowStartResults(true)}
              placeholder="Search for a location..."
              placeholderTextColor={Colors.textTertiary}
            />
            {startSearch.length > 0 && (
              <Pressable
                onPress={() => {
                  setStartSearch('');
                  setStartLocation(null);
                  setShowStartResults(false);
                  Haptics.selectionAsync();
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {showStartResults && startSearch.length > 0 && (
            <View style={styles.locationResults}>
              {filteredStartLocations.map(loc => (
                <Pressable
                  key={loc.name}
                  style={styles.locationResult}
                  onPress={() => {
                    setStartLocation(loc);
                    setStartSearch(loc.name);
                    setShowStartResults(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.locationResultText}>{loc.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>End Location</Text>
          <View style={styles.locationInputWrapper}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <TextInput
              style={styles.locationInput}
              value={endSearch}
              onChangeText={(text) => {
                setEndSearch(text);
                setShowEndResults(true);
                if (!text) setEndLocation(null);
              }}
              onFocus={() => setShowEndResults(true)}
              placeholder="Search for a location..."
              placeholderTextColor={Colors.textTertiary}
            />
            {endSearch.length > 0 && (
              <Pressable
                onPress={() => {
                  setEndSearch('');
                  setEndLocation(null);
                  setShowEndResults(false);
                  Haptics.selectionAsync();
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {showEndResults && endSearch.length > 0 && (
            <View style={styles.locationResults}>
              {filteredEndLocations.map(loc => (
                <Pressable
                  key={loc.name}
                  style={styles.locationResult}
                  onPress={() => {
                    setEndLocation(loc);
                    setEndSearch(loc.name);
                    setShowEndResults(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.locationResultText}>{loc.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.timeSection}>
          <Text style={styles.label}>Time Window</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Earliest Departure</Text>
              <TextInput
                style={styles.timeInput}
                value={earliestDeparture}
                onChangeText={setEarliestDeparture}
                placeholder="7:30 AM"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} style={{ marginTop: 24 }} />
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Latest Arrival</Text>
              <TextInput
                style={styles.timeInput}
                value={latestArrival}
                onChangeText={setLatestArrival}
                placeholder="8:45 AM"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Transport Mode</Text>
          <View style={styles.optionRow}>
            <Pressable
              style={[styles.optionButton, transportMode === 'walk' && styles.optionButtonActive]}
              onPress={() => { setTransportMode('walk'); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name="walk"
                size={22}
                color={transportMode === 'walk' ? Colors.textInverse : Colors.textSecondary}
              />
              <Text style={[styles.optionText, transportMode === 'walk' && styles.optionTextActive]}>
                Walk
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionButton, transportMode === 'transit' && styles.optionButtonActive]}
              onPress={() => { setTransportMode('transit'); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name="train"
                size={22}
                color={transportMode === 'transit' ? Colors.textInverse : Colors.textSecondary}
              />
              <Text style={[styles.optionText, transportMode === 'transit' && styles.optionTextActive]}>
                Transit
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Match Preference</Text>
          <View style={styles.optionRow}>
            <Pressable
              style={[styles.optionButton, matchPreference === 'individual' && styles.optionButtonActive]}
              onPress={() => { setMatchPreference('individual'); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name="person"
                size={20}
                color={matchPreference === 'individual' ? Colors.textInverse : Colors.textSecondary}
              />
              <Text style={[styles.optionText, matchPreference === 'individual' && styles.optionTextActive]}>
                1:1
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionButton, matchPreference === 'group' && styles.optionButtonActive]}
              onPress={() => { setMatchPreference('group'); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name="people"
                size={22}
                color={matchPreference === 'group' ? Colors.textInverse : Colors.textSecondary}
              />
              <Text style={[styles.optionText, matchPreference === 'group' && styles.optionTextActive]}>
                Group
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Gender Preference</Text>
          <View style={styles.optionRow}>
            <Pressable
              style={[styles.optionButton, genderPreference === 'any' && styles.optionButtonActive]}
              onPress={() => { setGenderPreference('any'); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.optionText, genderPreference === 'any' && styles.optionTextActive]}>
                Any
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionButton, genderPreference === 'same' && styles.optionButtonActive]}
              onPress={() => { setGenderPreference('same'); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.optionText, genderPreference === 'same' && styles.optionTextActive]}>
                Same Gender
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : existingCommute ? 'Update Commute' : 'Save Commute'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  locationInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.text,
  },
  clearButton: {
    padding: 4,
    marginRight: -4,
  },
  locationResults: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  locationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  locationResultText: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.text,
  },
  timeSection: {
    marginBottom: 24,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.textInverse,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
});
