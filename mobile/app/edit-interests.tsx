import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

const INTEREST_TAGS = [
  'Reading', 'Podcasts', 'Running', 'Cooking', 'Photography',
  'Music', 'Hiking', 'Coffee', 'Tech', 'Art', 'Yoga', 'Travel',
  'Gaming', 'Cycling', 'Movies', 'Gardening', 'Writing', 'Dance',
  'Fitness', 'Nature', 'Design', 'Fashion', 'Sports', 'Meditation',
];

export default function EditInterestsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { user, setUser } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.interests) {
      setSelected(user.interests);
    }
  }, [user?.interests]);

  const toggleInterest = (interest: string) => {
    Haptics.selectionAsync();
    setSelected(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selected.includes(tag)) {
      setSelected(prev => [...prev, tag]);
      setCustomTag('');
      Haptics.selectionAsync();
    }
  };

  const handleSave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await setUser({ ...user, interests: selected });
    router.back();
    setIsSaving(false);
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Interests</Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          hitSlop={12}
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.saveButtonText, isSaving && { opacity: 0.6 }]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your interests</Text>
        <Text style={styles.subtitle}>
          Tap to add or remove interests. Add custom ones below.
        </Text>

        <View style={styles.tagsContainer}>
          {INTEREST_TAGS.map((tag, index) => (
            <Animated.View key={tag} entering={FadeIn.delay(index * 30).duration(400)}>
              <Pressable
                style={[styles.tag, selected.includes(tag) && styles.tagActive]}
                onPress={() => toggleInterest(tag)}
              >
                <Text style={[styles.tagText, selected.includes(tag) && styles.tagTextActive]}>
                  {tag}
                </Text>
                {selected.includes(tag) && (
                  <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
                )}
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <View style={styles.customSection}>
          <Text style={styles.customLabel}>Add your own</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customTag}
              onChangeText={setCustomTag}
              placeholder="Type an interest..."
              placeholderTextColor={Colors.textTertiary}
              onSubmitEditing={addCustomTag}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addButton, !customTag.trim() && styles.addButtonDisabled]}
              onPress={addCustomTag}
              disabled={!customTag.trim()}
            >
              <Ionicons name="add" size={22} color={Colors.textInverse} />
            </Pressable>
          </View>
        </View>

        {selected.filter(s => !INTEREST_TAGS.includes(s)).length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedCount}>Custom interests</Text>
            <View style={styles.selectedTags}>
              {selected.filter(s => !INTEREST_TAGS.includes(s)).map(tag => (
                <Pressable
                  key={tag}
                  style={[styles.tag, styles.tagActive]}
                  onPress={() => toggleInterest(tag)}
                >
                  <Text style={[styles.tagText, styles.tagTextActive]}>{tag}</Text>
                  <Ionicons name="close" size={14} color={Colors.textInverse} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selected.length > 0 && (
          <Text style={styles.countHint}>{selected.length} interest{selected.length !== 1 ? 's' : ''} selected</Text>
        )}
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tagActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: Colors.text,
  },
  tagTextActive: {
    color: Colors.textInverse,
  },
  customSection: {
    marginBottom: 20,
  },
  customLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  selectedSection: {
    marginTop: 4,
  },
  selectedCount: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countHint: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textTertiary,
    marginTop: 16,
  },
});
