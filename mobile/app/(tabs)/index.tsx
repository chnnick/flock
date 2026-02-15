import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Modal } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Avatar from '@/components/Avatar';

function displayToMinute(value: string): number {
  const trimmed = value.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) {
    return 0;
  }
  const rawHours = Number(match[1]);
  const mins = Number(match[2] ?? 0);
  const ampm = match[3];
  let hours = rawHours % 12;
  if (ampm === 'PM') {
    hours += 12;
  }
  return Math.max(0, Math.min(1439, hours * 60 + mins));
}

function minuteToDisplay(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { user, commute, matches, triggerMatching } = useApp();
  const [showHowFlockWorks, setShowHowFlockWorks] = useState(false);
  const activeMatches = matches.filter(m => m.status === 'active');
  const pendingMatches = matches.filter(m => m.status === 'pending');
  const displayedEndTime = commute?.otpTotalDurationMinutes != null
    ? minuteToDisplay(displayToMinute(commute.earliestDeparture) + commute.otpTotalDurationMinutes)
    : commute?.latestArrival;
  const preferenceLabel = commute?.matchPreference === 'group'
    ? 'Group'
    : commute?.matchPreference === 'both'
      ? 'Both'
      : 'Individual';
  const preferenceIcon = commute?.matchPreference === 'both'
    ? 'git-compare-outline'
    : 'people-outline';

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handleFindMatches = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await triggerMatching();
    router.push('/(tabs)/matches');
  };

  const handleHelpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowHowFlockWorks(true);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <Pressable
        style={[styles.helpButton, { top: topInset + 8 }]}
        onPress={handleHelpPress}
        accessibilityLabel="How Flock Works help"
        accessibilityRole="button"
      >
        <Ionicons name="help-circle-outline" size={24} color={Colors.textSecondary} />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.greeting}>
          <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.greetingSub}>Ready for your commute?</Text>
        </View>

        {commute ? (
          <Animated.View entering={FadeInDown.duration(500)}>
            <Pressable onPress={() => router.push('/commute-detail')} style={({ pressed }) => [pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}>
              <Animated.View style={pulseStyle}>
                <LinearGradient
                  colors={['#FF7A00', '#FFB700']} // Vibrant Orange to Yellow
                  style={styles.commuteCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.commuteHeader}>
                    <View style={styles.modeTag}>
                      <Ionicons
                        name={commute.transportMode === 'walk' ? 'walk' : 'train'}
                        size={16}
                        color={Colors.secondary}
                      />
                      <Text style={styles.modeTagText}>
                        {commute.transportMode === 'walk' ? 'Walking' : 'Transit'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push('/commute-setup')}
                      hitSlop={8}
                    >
                      <Ionicons name="create-outline" size={22} color="rgba(255,255,255,0.8)" />
                    </Pressable>
                  </View>

                  <View style={styles.routeDisplay}>
                    <View style={styles.routePoint}>
                      <View style={styles.routeDotStart} />
                      <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>From</Text>
                        <Text style={styles.routeName}>{commute.startLocation.name}</Text>
                      </View>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={styles.routeDotEnd} />
                      <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>To</Text>
                        <Text style={styles.routeName}>{commute.endLocation.name}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                      <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.timeText}>
                        {commute.earliestDeparture} - {displayedEndTime}
                      </Text>
                    </View>
                    <View style={styles.timeItem}>
                      <Ionicons name={preferenceIcon as any} size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.timeText}>
                        {preferenceLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.viewMapRow}>
                    <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.viewMapText}>Tap to view route map</Text>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
                  </View>
                </LinearGradient>
              </Animated.View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.findButton, pressed && styles.findButtonPressed]}
              onPress={handleFindMatches}
            >
              <Ionicons name="search" size={22} color={Colors.textInverse} />
              <Text style={styles.findButtonText}>
                {pendingMatches.length > 0 ? 'Find New Matches' : 'Find Commute Matches'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(500)}>
            <Pressable
              style={({ pressed }) => [styles.setupCard, pressed && { opacity: 0.95 }]}
              onPress={() => router.push('/commute-setup')}
            >
              <View style={styles.setupIconContainer}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.setupIcon}
                >
                  <Ionicons name="add" size={32} color={Colors.textInverse} />
                </LinearGradient>
              </View>
              <Text style={styles.setupTitle}>Set Up Your Commute</Text>
              <Text style={styles.setupSubtitle}>
                Add your route and preferences to start finding commute matches near you.
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {activeMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Commutes</Text>
            {activeMatches.map(match => (
              <Pressable
                key={match.id}
                style={({ pressed }) => [styles.activeMatchCard, pressed && { opacity: 0.9 }]}
                onPress={() => {
                  if (!match.chatRoomId) return;
                  router.push({ pathname: '/chat/[id]', params: { id: match.chatRoomId } });
                }}
              >
                <View style={styles.matchAvatarRow}>
                  {match.participants.map((p, i) => (
                    <View key={p.id} style={[styles.miniAvatarContainer, { marginLeft: i > 0 ? -12 : 0, zIndex: 4 - i }]}>
                      <Avatar uri={p.avatar} name={p.name} size={36} />
                    </View>
                  ))}
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName}>
                    {match.participants.map(p => p.name.split(' ')[0]).join(', ')}
                  </Text>
                  <Text style={styles.matchRoute}>
                    {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}


        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={showHowFlockWorks}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHowFlockWorks(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How Flock Works</Text>
              <Pressable
                onPress={() => setShowHowFlockWorks(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
                style={({ pressed }) => [styles.modalCloseButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepsContainer}>
                <StepCard
                  icon="location-outline"
                  title="Set Your Route"
                  description="Enter your start and end points with your preferred times"
                  color={Colors.primary}
                />
                <StepCard
                  icon="git-compare-outline"
                  title="Get Matched"
                  description="Our algorithm finds commuters with overlapping routes"
                  color={Colors.accent}
                />
                <StepCard
                  icon="chatbubble-ellipses-outline"
                  title="Chat & Walk"
                  description="Introduce yourselves and plan your shared commute"
                  color={Colors.secondary}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StepCard({ icon, title, description, color }: {
  icon: string; title: string; description: string; color: string;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={[styles.stepIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  helpButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '85%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  greeting: {
    marginBottom: 24,
  },
  hello: {
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  greetingSub: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  commuteCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  viewMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
  },
  viewMapText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  commuteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeTagText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.secondary,
  },
  routeDisplay: {
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  routeDotStart: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  routeDotEnd: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginLeft: 6,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFFFFF',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 20,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.8)',
  },
  findButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  findButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  findButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  setupCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  setupIconContainer: {
    marginBottom: 16,
  },
  setupIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  setupSubtitle: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 14,
  },
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  activeMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  matchAvatarRow: {
    flexDirection: 'row',
  },
  miniAvatarContainer: {
    borderWidth: 2,
    borderColor: Colors.card,
    borderRadius: 18,
  },
  matchInfo: {
    flex: 1,
    marginLeft: 8,
  },
  matchName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  matchRoute: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
