import { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Platform, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp, ChatMessage } from '@/contexts/AppContext';

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chatRooms, user, sendMessage, matches, submitReview } = useApp();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const room = chatRooms.find(r => r.id === id);
  const match = room ? matches.find(m => m.chatRoomId === room.id) : null;

  if (!room || !user) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chat not found</Text>
        </View>
      </View>
    );
  }

  const reversedMessages = [...room.messages].reverse();

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    sendMessage(room.id, text);
  }, [inputText, room.id, sendMessage]);

  const handleReview = (enjoyed: boolean) => {
    if (!match) return;
    Haptics.notificationAsync(
      enjoyed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    submitReview(match.id, enjoyed);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} isOwn={item.senderId === user.id} />
  );

  const participantNames = room.participants.map(p => p.name.split(' ')[0]).join(', ');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatars}>
            {room.participants.slice(0, 2).map(p => (
              <View key={p.id} style={[styles.headerAvatar, { backgroundColor: p.avatar }]}>
                <Text style={styles.headerAvatarText}>{p.name[0]}</Text>
              </View>
            ))}
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{participantNames}</Text>
            <Text style={styles.headerSub}>
              {match?.transportMode === 'walk' ? 'Walking' : 'Transit'} buddy
            </Text>
          </View>
        </View>
        {match && match.status === 'active' && (
          <Pressable
            onPress={() => handleReview(true)}
            hitSlop={8}
            style={styles.completeButton}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.textInverse} />
          </Pressable>
        )}
      </View>

      {match && match.status === 'active' && (
        <View style={styles.routeBanner}>
          <Ionicons
            name={match.transportMode === 'walk' ? 'walk' : 'train'}
            size={16}
            color={Colors.accent}
          />
          <Text style={styles.routeBannerText}>
            {match.sharedSegmentStart.name} to {match.sharedSegmentEnd.name} ({match.estimatedTime})
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={reversedMessages.length > 0}
      />

      <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color={Colors.textInverse} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  if (message.isSystem) {
    return (
      <Animated.View entering={FadeIn.duration(500)} style={styles.systemMessage}>
        <View style={styles.systemIcon}>
          <Ionicons name="sparkles" size={14} color={Colors.primary} />
        </View>
        <Text style={styles.systemText}>{message.body}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
        {!isOwn && (
          <View style={styles.bubbleSenderAvatar}>
            <Text style={styles.bubbleSenderInitial}>{message.senderName[0]}</Text>
          </View>
        )}
        <View style={styles.bubbleContent}>
          {!isOwn && (
            <Text style={styles.senderName}>{message.senderName.split(' ')[0]}</Text>
          )}
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
              {message.body}
            </Text>
          </View>
          <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours();
  const mins = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatars: {
    flexDirection: 'row',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  headerAvatarText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  headerName: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
  completeButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.accent + '10',
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent + '20',
  },
  routeBannerText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: Colors.accent,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primary + '08',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '15',
  },
  systemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  systemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  bubbleRowOwn: {
    flexDirection: 'row-reverse',
  },
  bubbleSenderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSenderInitial: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  bubbleContent: {
    maxWidth: '75%',
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.text,
    lineHeight: 21,
  },
  bubbleTextOwn: {
    color: Colors.textInverse,
  },
  bubbleTime: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textTertiary,
    marginTop: 4,
    marginLeft: 4,
  },
  bubbleTimeOwn: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
});
