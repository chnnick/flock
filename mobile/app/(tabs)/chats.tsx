import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Platform, Animated } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated2, { FadeInDown } from 'react-native-reanimated';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp, ChatRoom } from '@/contexts/AppContext';
import Avatar from '@/components/Avatar';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { chatRooms, deleteChatRoom } = useApp();

  const sortedRooms = [...chatRooms].sort((a, b) =>
    new Date(b.lastMessageTime || b.createdAt).getTime() - new Date(a.lastMessageTime || a.createdAt).getTime()
  );

  const renderItem = ({ item, index }: { item: ChatRoom; index: number }) => (
    <ChatRoomItem room={item} index={index} onDelete={() => deleteChatRoom(item.id)} />
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {sortedRooms.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Accept a commute match to start chatting with your walking buddy.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedRooms}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={sortedRooms.length > 0}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

function ChatRoomItem({ room, index, onDelete }: { room: ChatRoom; index: number; onDelete: () => void }) {
  const { user } = useApp();
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const deleteOpacity = progress.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0, 0, 1],
    });
    return (
      <View style={styles.swipeActionContainer}>
        <Animated.View style={[styles.deleteActionWrapper, { opacity: deleteOpacity }]}>
          <RectButton
            style={styles.deleteAction}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={22} color={Colors.textInverse} />
            <Text style={styles.deleteActionText}>Delete</Text>
          </RectButton>
        </Animated.View>
      </View>
    );
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  const unreadCount = room.messages.filter(
    m => m.senderId !== user?.id && m.senderId !== 'system'
  ).length > 0 ? Math.min(Math.floor(Math.random() * 3), 2) : 0;

  return (
    <Animated2.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={() => setIsSwipeOpen(true)}
        onSwipeableWillClose={() => setIsSwipeOpen(false)}
      >
        <RectButton
          style={styles.chatItem}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: room.id } })}
          underlayColor={Colors.surface}
        >
          <View style={styles.avatarRow}>
            {room.participants.slice(0, 2).map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.chatAvatarContainer,
                  i > 0 && { marginLeft: -12, zIndex: 0 },
                ]}
              >
                <Avatar uri={p.avatar} name={p.name} size={50} />
              </View>
            ))}
          </View>

          <View style={styles.chatInfo}>
            <Text style={styles.chatName} numberOfLines={1}>
              {room.participants.map(p => p.name.split(' ')[0]).join(', ')}
            </Text>
            <Text style={styles.chatLastMessage} numberOfLines={1}>
              {room.lastMessage || 'Start the conversation!'}
            </Text>
          </View>

          <View style={styles.chatMeta}>
            {!isSwipeOpen && <Text style={styles.chatTime}>{formatTime(room.lastMessageTime)}</Text>}
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </RectButton>
      </Swipeable>
    </Animated2.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  swipeActionContainer: {
    width: 80,
    justifyContent: 'center',
  },
  deleteActionWrapper: {
    flex: 1,
  },
  deleteAction: {
    flex: 1,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
    marginTop: 4,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatarContainer: {
    // width/height handled by Avatar size
    // borderRadius handled by Avatar
    borderWidth: 2,
    borderColor: Colors.background,
    borderRadius: 25,
  },
  // chatAvatarText removed
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
    marginBottom: 3,
  },
  chatLastMessage: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatTime: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textTertiary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
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
  },
});
