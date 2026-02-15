import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp, Match } from '@/contexts/AppContext';
import { useState } from 'react';

function isGroupMatch(match: Match): boolean {
  return match.participants.length > 1 || (match.maxCapacity != null && match.maxCapacity > 1);
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { matches, commute, acceptMatch, declineMatch, triggerMatching, joinQueue, leaveQueue } = useApp();
  const [loadingMatch, setLoadingMatch] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [isLeavingQueue, setIsLeavingQueue] = useState(false);

  const pendingMatches = matches.filter(m => m.status === 'pending');
  const activeMatches = matches.filter(m => m.status === 'active');
  const hasActiveMatch = activeMatches.length > 0;

  const handleAccept = async (matchId: string) => {
    setLoadingMatch(matchId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await acceptMatch(matchId);
    setLoadingMatch(null);
  };

  const handleDecline = async (matchId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await declineMatch(matchId);
  };

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await triggerMatching();
  };

  const handleQueue = async () => {
    if (!commute || isQueuing || hasActiveMatch || commute.status === 'queued') return;
    setIsQueuing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await joinQueue();
    setIsQueuing(false);
  };

  const handleLeaveQueue = async () => {
    if (!commute || commute.status !== 'queued' || isLeavingQueue) return;
    setIsLeavingQueue(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await leaveQueue();
    setIsLeavingQueue(false);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        {commute && (
          <Pressable onPress={handleRefresh} hitSlop={8}>
            <Ionicons name="refresh" size={24} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!commute ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="compass-outline" size={48} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No commute set up</Text>
            <Text style={styles.emptyText}>
              Set up your commute route first to start finding matches.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/commute-setup')}
            >
              <Text style={styles.emptyButtonText}>Set Up Commute</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {commute && (
              <>
                {commute.status === 'queued' ? (
                  <>
                    <View style={styles.queueStatusCard}>
                      <ActivityIndicator color={Colors.textInverse} size="small" />
                      <Text style={styles.queueButtonText}>
                        In Queue for {commute?.matchPreference === 'group' ? 'Group' : '1:1'}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.leaveQueueButton,
                        pressed && { opacity: 0.9 },
                        isLeavingQueue && styles.queueButtonDisabled,
                      ]}
                      onPress={handleLeaveQueue}
                      disabled={isLeavingQueue}
                    >
                      {isLeavingQueue ? (
                        <ActivityIndicator color={Colors.text} size="small" />
                      ) : (
                        <>
                          <Ionicons name="close-circle-outline" size={18} color={Colors.text} />
                          <Text style={styles.leaveQueueText}>Leave Queue</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.queueButton,
                      pressed && styles.queueButtonPressed,
                      (isQueuing || hasActiveMatch) && styles.queueButtonDisabled,
                    ]}
                    onPress={handleQueue}
                    disabled={isQueuing || hasActiveMatch}
                  >
                    {isQueuing ? (
                      <ActivityIndicator color={Colors.textInverse} size="small" />
                    ) : (
                      <>
                        <Ionicons
                          name={commute?.matchPreference === 'group' ? 'people' : 'person'}
                          size={20}
                          color={Colors.textInverse}
                        />
                        <Text style={styles.queueButtonText}>
                          Join Queue for {commute?.matchPreference === 'group' ? 'Group' : '1:1'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
                <Text style={styles.queueHint}>
                  {hasActiveMatch
                    ? 'Queue is closed while you have an active queue match.'
                    : commute.status === 'queued'
                    ? "We'll let you know if you have a match soon."
                    : 'Join queue to get auto-matched when a compatible rider is available.'}
                </Text>
              </>
            )}
            {pendingMatches.length === 0 && activeMatches.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptyText}>
                  Tap the search button on the home screen to find commute matches.
                </Text>
                <Pressable style={styles.emptyButton} onPress={handleRefresh}>
                  <Text style={styles.emptyButtonText}>Search Now</Text>
                </Pressable>
              </View>
            )}
            {pendingMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  New Matches ({pendingMatches.length})
                </Text>
                {pendingMatches.map((match, index) => {
                  const isGroup = isGroupMatch(match);
                  return isGroup ? (
                    <GroupMatchCard
                      key={match.id}
                      match={match}
                      index={index}
                      onAccept={() => handleAccept(match.id)}
                      onDecline={() => handleDecline(match.id)}
                      isLoading={loadingMatch === match.id}
                    />
                  ) : (
                    <MatchCard
                      key={match.id}
                      match={match}
                      index={index}
                      onAccept={() => handleAccept(match.id)}
                      onDecline={() => handleDecline(match.id)}
                      isLoading={loadingMatch === match.id}
                    />
                  );
                })}
              </View>
            )}

            {activeMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Active ({activeMatches.length})
                </Text>
                {activeMatches.map((match, index) => (
                  <ActiveMatchCard key={match.id} match={match} index={index} isGroup={isGroupMatch(match)} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function MatchCard({ match, index, onAccept, onDecline, isLoading }: {
  match: Match; index: number; onAccept: () => void; onDecline: () => void; isLoading: boolean;
}) {
  const person = match.participants[0];
  const overlapPct = Math.round(match.overlapScore * 100);

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <View style={styles.matchCard}>
        <View style={styles.matchCardHeader}>
          <View style={[styles.avatar, { backgroundColor: person.avatar }]}>
            <Text style={styles.avatarText}>{person.name[0]}</Text>
          </View>
          <View style={styles.matchCardInfo}>
            <Text style={styles.matchName}>{person.name}</Text>
            <Text style={styles.matchOccupation}>{person.occupation}</Text>
          </View>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreValue}>{overlapPct}%</Text>
            <Text style={styles.scoreLabel}>overlap</Text>
          </View>
        </View>

        <View style={styles.matchDetails}>
          <View style={styles.detailRow}>
            <Ionicons
              name={match.transportMode === 'walk' ? 'walk' : 'train'}
              size={16}
              color={match.transportMode === 'walk' ? Colors.walk : Colors.transit}
            />
            <Text style={styles.detailText}>
              {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{match.estimatedTime} shared commute</Text>
          </View>
        </View>

        {person.interests.length > 0 && (
          <View style={styles.interestTags}>
            {person.interests.slice(0, 4).map(interest => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestChipText}>{interest}</Text>
              </View>
            ))}
            {person.interests.length > 4 && (
              <Text style={styles.moreInterests}>+{person.interests.length - 4}</Text>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.declineButton, pressed && { opacity: 0.8 }]}
            onPress={onDecline}
          >
            <Ionicons name="close" size={22} color={Colors.error} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.acceptButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={onAccept}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={Colors.textInverse} />
                <Text style={styles.acceptButtonText}>Accept Match</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function GroupMatchCard({ match, index, onAccept, onDecline, isLoading }: {
  match: Match; index: number; onAccept: () => void; onDecline: () => void; isLoading: boolean;
}) {
  const groupType = match.transportMode === 'walk' ? 'Walking Group' : 'Transit Group';
  const capacity = match.maxCapacity ?? 4;
  const currentCount = match.participants.length;
  const capacityLabel = `${currentCount}/${capacity}`;
  const participantNames = match.participants.length <= 3
    ? match.participants.map(p => p.name.split(' ')[0]).join(', ')
    : `${match.participants.slice(0, 2).map(p => p.name.split(' ')[0]).join(', ')}, +${match.participants.length - 2}`;
  const allInterests = [...new Set(match.participants.flatMap(p => p.interests))];

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <View style={styles.matchCard}>
        <View style={styles.groupCardHeader}>
          <View style={[styles.groupTypeBadge, { backgroundColor: match.transportMode === 'walk' ? Colors.walk + '20' : Colors.transit + '20' }]}>
            <Ionicons
              name={match.transportMode === 'walk' ? 'walk' : 'train'}
              size={14}
              color={match.transportMode === 'walk' ? Colors.walk : Colors.transit}
            />
            <Text style={[styles.groupTypeText, { color: match.transportMode === 'walk' ? Colors.walk : Colors.transit }]}>
              {groupType}
            </Text>
          </View>
          <View style={styles.capacityBadge}>
            <Text style={styles.capacityText}>{capacityLabel}</Text>
          </View>
        </View>

        <View style={styles.groupParticipantsRow}>
          <View style={styles.groupAvatars}>
            {match.participants.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.groupAvatar,
                  { backgroundColor: p.avatar, marginLeft: i > 0 ? -10 : 0, zIndex: match.participants.length - i },
                ]}
              >
                <Text style={styles.groupAvatarText}>{p.name[0]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.groupParticipantNames} numberOfLines={1}>{participantNames}</Text>
        </View>

        <View style={styles.matchDetails}>
          <View style={styles.detailRow}>
            <Ionicons
              name={match.transportMode === 'walk' ? 'walk' : 'train'}
              size={16}
              color={match.transportMode === 'walk' ? Colors.walk : Colors.transit}
            />
            <Text style={styles.detailText}>
              {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{match.estimatedTime} shared commute</Text>
          </View>
        </View>

        {allInterests.length > 0 && (
          <View style={styles.interestTags}>
            {allInterests.slice(0, 4).map(interest => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestChipText}>{interest}</Text>
              </View>
            ))}
            {allInterests.length > 4 && (
              <Text style={styles.moreInterests}>+{allInterests.length - 4}</Text>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.declineButton, pressed && { opacity: 0.8 }]}
            onPress={onDecline}
          >
            <Ionicons name="close" size={22} color={Colors.error} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.acceptButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={onAccept}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={Colors.textInverse} />
                <Text style={styles.acceptButtonText}>Accept Match</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function ActiveMatchCard({ match, index, isGroup }: { match: Match; index: number; isGroup: boolean }) {
  const person = match.participants[0];
  const groupType = match.transportMode === 'walk' ? 'Walking Group' : 'Transit Group';
  const capacity = match.maxCapacity ?? 4;
  const currentCount = match.participants.length;
  const capacityLabel = `${currentCount}/${capacity}`;

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).duration(500)}>
      <Pressable
        style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.9 }]}
        onPress={() => {
          if (!match.chatRoomId) return;
          router.push({ pathname: '/chat/[id]', params: { id: match.chatRoomId } });
        }}
      >
        {isGroup ? (
          <>
            <View style={styles.activeGroupAvatars}>
              {match.participants.slice(0, 4).map((p, i) => (
                <View
                  key={p.id}
                  style={[
                    styles.activeGroupAvatar,
                    { backgroundColor: p.avatar, marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i },
                  ]}
                >
                  <Text style={styles.activeGroupAvatarText}>{p.name[0]}</Text>
                </View>
              ))}
            </View>
            <View style={styles.activeInfo}>
              <Text style={styles.activeName}>{groupType}</Text>
              <Text style={styles.activeRoute}>
                {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name}
              </Text>
            </View>
            <View style={styles.activeRight}>
              <Text style={styles.activeCapacity}>{capacityLabel}</Text>
              <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.avatar, { backgroundColor: person.avatar, width: 44, height: 44 }]}>
              <Text style={[styles.avatarText, { fontSize: 18 }]}>{person.name[0]}</Text>
            </View>
            <View style={styles.activeInfo}>
              <Text style={styles.activeName}>{person.name}</Text>
              <Text style={styles.activeRoute}>
                {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name}
              </Text>
            </View>
            <View style={styles.activeRight}>
              <Text style={styles.activeTime}>{match.estimatedTime}</Text>
              <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  queueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  queueButtonDisabled: {
    opacity: 0.7,
  },
  queueButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  queueStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  leaveQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  leaveQueueText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  queueHint: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  groupTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  groupTypeText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  capacityBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  capacityText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textSecondary,
  },
  groupParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  groupAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  groupAvatarText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  groupParticipantNames: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  matchCardInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  matchOccupation: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'center',
    backgroundColor: Colors.accent + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: Colors.accent,
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchDetails: {
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  interestChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  interestChipText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
  },
  moreInterests: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textTertiary,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  declineButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '12',
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  acceptButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
  },
  acceptButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  activeInfo: {
    flex: 1,
  },
  activeName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  activeRoute: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeRight: {
    alignItems: 'center',
    gap: 4,
  },
  activeTime: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
  },
  activeGroupAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeGroupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  activeGroupAvatarText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  activeCapacity: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
});
