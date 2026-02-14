import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp, UserProfile } from '@/contexts/AppContext';

const INTEREST_TAGS = [
  'Reading', 'Podcasts', 'Running', 'Cooking', 'Photography',
  'Music', 'Hiking', 'Coffee', 'Tech', 'Art', 'Yoga', 'Travel',
  'Gaming', 'Cycling', 'Movies', 'Gardening', 'Writing', 'Dance',
  'Fitness', 'Nature', 'Design', 'Fashion', 'Sports', 'Meditation',
];

export default function InterestsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const params = useLocalSearchParams<{ name: string; occupation: string; gender: string }>();
  const { setUser, completeOnboarding } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canContinue = selected.length >= 3;

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

  const handleFinish = async () => {
    if (!canContinue || isSubmitting) return;
    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const user: UserProfile = {
      id: Crypto.randomUUID(),
      name: params.name || '',
      occupation: params.occupation || '',
      gender: (params.gender || 'prefer-not-to-say') as UserProfile['gender'],
      interests: selected,
      commuteFriends: [],
      createdAt: new Date().toISOString(),
    };

    await setUser(user);
    await completeOnboarding();
    router.dismissAll();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.step}>2 of 2</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your interests</Text>
        <Text style={styles.subtitle}>
          Pick at least 3 interests. We'll use these to find commute matches you'll actually enjoy chatting with.
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

        {selected.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedCount}>{selected.length} selected</Text>
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleFinish}
          disabled={!canContinue || isSubmitting}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Setting up...' : 'Start Commuting'}</Text>
          <Ionicons name="checkmark-circle" size={22} color={Colors.textInverse} />
        </Pressable>
        {!canContinue && (
          <Text style={styles.hint}>Select at least 3 interests to continue</Text>
        )}
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
  step: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 28,
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
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
});
