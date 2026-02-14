import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { user, commuteFriends, matches, logout } = useApp();

  const completedCommutes = matches.filter(m => m.status === 'completed' || m.status === 'active').length;

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
      router.replace('/');
      return;
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? This will clear all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await logout();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{user?.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Unknown'}</Text>
          <Text style={styles.profileOccupation}>{user?.occupation || ''}</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedCommutes}</Text>
            <Text style={styles.statLabel}>Commutes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{commuteFriends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.interests?.length || 0}</Text>
            <Text style={styles.statLabel}>Interests</Text>
          </View>
        </Animated.View>

        {user?.interests && user.interests.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestTags}>
              {user.interests.map(interest => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestChipText}>{interest}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {commuteFriends.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <Text style={styles.sectionTitle}>Commute Friends</Text>
            <View style={styles.friendsList}>
              {commuteFriends.map(friend => (
                <View key={friend.id} style={styles.friendCard}>
                  <View style={[styles.friendAvatar, { backgroundColor: friend.avatar }]}>
                    <Text style={styles.friendAvatarText}>{friend.name[0]}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendOccupation}>{friend.occupation}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <Pressable
            style={({ pressed }) => [styles.settingsItem, pressed && { backgroundColor: Colors.surface }]}
            onPress={() => router.push('/commute-setup')}
          >
            <View style={[styles.settingsIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="map-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.settingsText}>Edit Commute</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.settingsItem, pressed && { backgroundColor: Colors.surface }]}
            onPress={handleLogout}
          >
            <View style={[styles.settingsIcon, { backgroundColor: Colors.error + '15' }]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            </View>
            <Text style={[styles.settingsText, { color: Colors.error }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarLargeText: {
    fontSize: 36,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  profileName: {
    fontSize: 26,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  profileOccupation: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 14,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  interestChip: {
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: Colors.primary,
  },
  friendsList: {
    gap: 10,
    marginBottom: 28,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  friendOccupation: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    color: Colors.text,
  },
});
