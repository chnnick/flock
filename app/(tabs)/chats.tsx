import { View, Text, Pressable, StyleSheet, FlatList, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp, ChatRoom } from '@/contexts/AppContext';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { chatRooms } = useApp();

  const sortedRooms = [...chatRooms].sort((a, b) =>
    new Date(b.lastMessageTime || b.createdAt).getTime() - new Date(a.lastMessageTime || a.createdAt).getTime()
  );

  const renderItem = ({ item, index }: { item: ChatRoom; index: number }) => (
    <ChatRoomItem room={item} index={index} />
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

function ChatRoomItem({ room, index }: { room: ChatRoom; index: number }) {
  const { user } = useApp();

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
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <Pressable
        style={({ pressed }) => [styles.chatItem, pressed && { opacity: 0.8, backgroundColor: Colors.surface }]}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: room.id } })}
      >
        <View style={styles.avatarRow}>
          {room.participants.slice(0, 2).map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.chatAvatar,
                { backgroundColor: p.avatar },
                i > 0 && { marginLeft: -12 },
              ]}
            >
              <Text style={styles.chatAvatarText}>{p.name[0]}</Text>
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
          <Text style={styles.chatTime}>{formatTime(room.lastMessageTime)}</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
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
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  chatAvatarText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
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
