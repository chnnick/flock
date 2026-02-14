import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { getRouteForCommute } from '@/constants/sampleRoutes';
import CommuteMap from '@/components/CommuteMap';

export default function CommuteDetailScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { commute, matches } = useApp();

  if (!commute) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Commute Details</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No commute set up yet</Text>
        </View>
      </View>
    );
  }

  const routeData = getRouteForCommute(commute.startLocation.name, commute.endLocation.name, commute.transportMode);

  const activeMatches = matches.filter(m => m.status === 'active' || m.status === 'pending');

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Commute</Text>
        <Pressable onPress={() => router.push('/commute-setup')} hitSlop={8}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(600)}>
          <CommuteMap route={routeData} height={380} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <View style={styles.modeTag}>
              <Ionicons
                name={commute.transportMode === 'walk' ? 'walk' : 'train'}
                size={16}
                color={commute.transportMode === 'walk' ? Colors.walk : Colors.transit}
              />
              <Text style={[styles.modeTagText, { color: commute.transportMode === 'walk' ? Colors.walk : Colors.transit }]}>
                {commute.transportMode === 'walk' ? 'Walking' : 'Transit'}
              </Text>
            </View>
            <Text style={styles.totalTime}>{routeData.totalDuration}</Text>
          </View>

          <View style={styles.routePoints}>
            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, { backgroundColor: Colors.accent }]} />
              <View style={styles.routePointInfo}>
                <Text style={styles.routePointLabel}>Start</Text>
                <Text style={styles.routePointName}>{commute.startLocation.name}</Text>
              </View>
              <Text style={styles.routePointTime}>{commute.earliestDeparture}</Text>
            </View>

            <View style={styles.routeConnector}>
              {routeData.segments.map((seg, idx) => (
                <View key={idx} style={styles.segmentInfo}>
                  <View style={[
                    styles.segmentLine,
                    seg.type === 'walk' ? styles.segmentLineWalk : styles.segmentLineTransit,
                  ]} />
                  <View style={styles.segmentDetail}>
                    <Ionicons
                      name={seg.type === 'walk' ? 'walk' : 'train'}
                      size={14}
                      color={seg.type === 'walk' ? Colors.secondary : Colors.transit}
                    />
                    <Text style={styles.segmentText}>{seg.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
              <View style={styles.routePointInfo}>
                <Text style={styles.routePointLabel}>End</Text>
                <Text style={styles.routePointName}>{commute.endLocation.name}</Text>
              </View>
              <Text style={styles.routePointTime}>{commute.latestArrival}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="walk" size={22} color={Colors.walk} />
            <Text style={styles.statValue}>{routeData.walkDuration}</Text>
            <Text style={styles.statLabel}>Walking</Text>
          </View>
          {commute.transportMode === 'transit' && (
            <View style={styles.statCard}>
              <Ionicons name="train" size={22} color={Colors.transit} />
              <Text style={styles.statValue}>{routeData.transitDuration}</Text>
              <Text style={styles.statLabel}>Transit</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <Ionicons name="people" size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{routeData.matchOverlaps.length}</Text>
            <Text style={styles.statLabel}>Match{routeData.matchOverlaps.length !== 1 ? 'es' : ''}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color={Colors.secondary} />
            <Text style={styles.statValue}>{routeData.totalDuration}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </Animated.View>

        {routeData.matchOverlaps.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <Text style={styles.sectionTitle}>Commute Overlaps</Text>
            {routeData.matchOverlaps.map((overlap, idx) => {
              const overlapColors = ['#FF6B35', '#8B5CF6', '#EC4899', '#10B981'];
              const color = overlapColors[idx % overlapColors.length];

              return (
                <View key={idx} style={styles.overlapCard}>
                  <View style={styles.overlapHeader}>
                    <View style={[styles.overlapAvatar, { backgroundColor: color }]}>
                      <Text style={styles.overlapAvatarText}>{overlap.matchName[0]}</Text>
                    </View>
                    <View style={styles.overlapInfo}>
                      <Text style={styles.overlapName}>{overlap.matchName}</Text>
                      <Text style={styles.overlapSub}>Shared commute segment</Text>
                    </View>
                    <View style={[styles.overlapColorDot, { backgroundColor: color }]} />
                  </View>

                  <View style={styles.overlapRoute}>
                    <View style={styles.overlapPoint}>
                      <View style={[styles.overlapDot, { backgroundColor: Colors.accent }]} />
                      <View>
                        <Text style={styles.overlapPointLabel}>Meet at</Text>
                        <Text style={styles.overlapPointName}>{overlap.meetPointName}</Text>
                      </View>
                    </View>
                    <View style={[styles.overlapLine, { borderColor: color }]} />
                    <View style={styles.overlapPoint}>
                      <View style={[styles.overlapDot, { backgroundColor: Colors.error }]} />
                      <View>
                        <Text style={styles.overlapPointLabel}>Split at</Text>
                        <Text style={styles.overlapPointName}>{overlap.splitPointName}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
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
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  routeCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeTagText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  totalTime: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  routePoints: {},
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  routePointInfo: {
    flex: 1,
  },
  routePointLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routePointName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  routePointTime: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
  },
  routeConnector: {
    marginLeft: 6,
    paddingLeft: 18,
    paddingVertical: 6,
    gap: 2,
  },
  segmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  segmentLine: {
    width: 3,
    height: 24,
    borderRadius: 1.5,
  },
  segmentLineWalk: {
    backgroundColor: Colors.secondary,
    opacity: 0.4,
  },
  segmentLineTransit: {
    backgroundColor: Colors.transit,
    opacity: 0.8,
  },
  segmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statValue: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  overlapCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  overlapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  overlapAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlapAvatarText: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  overlapInfo: {
    flex: 1,
  },
  overlapName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  overlapSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  overlapColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  overlapRoute: {
    marginLeft: 4,
  },
  overlapPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overlapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  overlapPointLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overlapPointName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  overlapLine: {
    width: 0,
    height: 16,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    marginLeft: 4,
    marginVertical: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
});
