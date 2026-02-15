import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { CommuteRoute } from '@/constants/sampleRoutes';
import CommuteMap from '@/components/CommuteMap';

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

function minutesBetween(start: string, end: string): number {
  const startMinute = displayToMinute(start);
  const endMinute = displayToMinute(end);
  const delta = (endMinute - startMinute + 1440) % 1440;
  return delta === 0 ? 1 : delta;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function segmentLengthMeters(coordinates: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    total += haversineMeters(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

function toDurationLabel(minutes: number): string {
  return `${Math.max(0, Math.round(minutes))} min`;
}

function minuteToDisplay(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function addMinutesToDisplay(start: string, deltaMinutes: number): string {
  const startMinute = displayToMinute(start);
  return minuteToDisplay(startMinute + Math.max(0, Math.round(deltaMinutes)));
}

function flattenCoordinates(route: CommuteRoute): [number, number][] {
  return route.segments.flatMap((segment) => segment.coordinates);
}

function nearestIndex(coords: [number, number][], target: [number, number]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i += 1) {
    const [lat, lng] = coords[i];
    const dLat = lat - target[0];
    const dLng = lng - target[1];
    const distanceSquared = dLat * dLat + dLng * dLng;
    if (distanceSquared < bestDistance) {
      bestDistance = distanceSquared;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function overlapCoordinatesFromRoute(
  routeCoords: [number, number][],
  meetPoint: [number, number],
  splitPoint: [number, number],
): [number, number][] {
  if (routeCoords.length < 2) {
    return [meetPoint, splitPoint];
  }
  const startIdx = nearestIndex(routeCoords, meetPoint);
  const endIdx = nearestIndex(routeCoords, splitPoint);
  const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  const sliced = routeCoords.slice(from, to + 1);
  if (sliced.length < 2) {
    return [meetPoint, splitPoint];
  }
  return [meetPoint, ...sliced, splitPoint];
}

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

  const activeMatches = matches.filter(m => m.status === 'active');
  const baseSegments = commute.routeSegments.length > 0
    ? commute.routeSegments
    : [{
      type: commute.transportMode,
      coordinates: [commute.startLocation, commute.endLocation].map((point) => [point.lat, point.lng] as [number, number]),
      label: `${commute.startLocation.name} to ${commute.endLocation.name}`,
    }];
  const routeCoords = flattenCoordinates({
    id: commute.id,
    segments: baseSegments,
    startName: commute.startLocation.name,
    endName: commute.endLocation.name,
    totalDuration: 'N/A',
    walkDuration: 'N/A',
    transitDuration: 'N/A',
    matchOverlaps: [],
  });
  const otpDurationByType = baseSegments.reduce(
    (acc, segment) => {
      if (typeof segment.durationMinutes !== 'number') {
        return acc;
      }
      acc.total += segment.durationMinutes;
      acc.knownCount += 1;
      if (segment.type === 'walk') {
        acc.walk += segment.durationMinutes;
      } else {
        acc.transit += segment.durationMinutes;
      }
      return acc;
    },
    { total: 0, walk: 0, transit: 0, knownCount: 0 },
  );
  const totalMinutes = commute.otpTotalDurationMinutes
    ?? (otpDurationByType.knownCount > 0
      ? otpDurationByType.total
      : minutesBetween(commute.earliestDeparture, commute.latestArrival));
  const usesRouteDuration = commute.otpTotalDurationMinutes != null || otpDurationByType.knownCount > 0;
  const displayedEndTime = usesRouteDuration
    ? addMinutesToDisplay(commute.earliestDeparture, totalMinutes)
    : commute.latestArrival;
  const lengthsByType = baseSegments.reduce(
    (acc, segment) => {
      const length = segmentLengthMeters(segment.coordinates);
      acc.total += length;
      if (segment.type === 'walk') {
        acc.walk += length;
      } else {
        acc.transit += length;
      }
      return acc;
    },
    { total: 0, walk: 0, transit: 0 },
  );
  const walkMinutes = otpDurationByType.knownCount > 0
    ? otpDurationByType.walk
    : lengthsByType.total > 0
      ? (totalMinutes * lengthsByType.walk) / lengthsByType.total
      : commute.transportMode === 'walk' ? totalMinutes : 0;
  const transitMinutes = otpDurationByType.knownCount > 0
    ? otpDurationByType.transit
    : lengthsByType.total > 0
      ? (totalMinutes * lengthsByType.transit) / lengthsByType.total
      : commute.transportMode === 'transit' ? totalMinutes : 0;
  const routeData: CommuteRoute = {
    id: commute.id,
    segments: baseSegments,
    startName: commute.startLocation.name,
    endName: commute.endLocation.name,
    totalDuration: toDurationLabel(totalMinutes),
    walkDuration: toDurationLabel(walkMinutes),
    transitDuration: toDurationLabel(transitMinutes),
    matchOverlaps: activeMatches.map((match) => {
      const participant = match.participants[0];
      const meetPoint: [number, number] = [match.sharedSegmentStart.lat, match.sharedSegmentStart.lng];
      const splitPoint: [number, number] = [match.sharedSegmentEnd.lat, match.sharedSegmentEnd.lng];
      const overlapCoords = overlapCoordinatesFromRoute(routeCoords, meetPoint, splitPoint);
      return {
        matchName: participant?.name ?? 'Commuter',
        matchAvatar: participant?.avatar ?? Colors.primary,
        coordinates: overlapCoords,
        meetPoint,
        splitPoint,
        meetPointName: match.sharedSegmentStart.name,
        splitPointName: match.sharedSegmentEnd.name,
      };
    }),
  };

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
              <Text style={styles.routePointTime}>{displayedEndTime}</Text>
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
