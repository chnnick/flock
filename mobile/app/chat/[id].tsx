import { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Platform, KeyboardAvoidingView, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp, ChatMessage, MatchProfile } from '@/contexts/AppContext';
import { fetchNewQuestions, type MessageForApi } from '@/lib/chat-api';

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chatRooms, user, sendMessage, matches, addCommuteFriend, removeCommuteFriend, commuteFriends } = useApp();
  const [inputText, setInputText] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const room = chatRooms.find(r => r.id === id);
  const match = room ? matches.find(m => m.chatRoomId === room.id) : null;

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    sendMessage(room.id, text);
  }, [inputText, room, sendMessage]);

  const handleAddFriend = async (profile: MatchProfile) => {
    if (commuteFriends.some(f => f.id === profile.id)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCommuteFriend(profile);
  };

  const handleRemoveFriend = async (profileId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeCommuteFriend(profileId);
  };

  const roomToApiMessages = useCallback((r: typeof room): MessageForApi[] => {
    if (!r || !user) return [];
    return r.messages.map(m => ({
      role: m.isSystem ? ('model' as const) : ('user' as const),
      name: m.isSystem ? 'Flock' : m.senderName,
      content: m.body,
    }));
  }, [user]);

  const handleAskExcitingQuestion = useCallback(async () => {
    if (!room) return;
    setGeminiLoading(true);
    Haptics.selectionAsync();
    const messages = roomToApiMessages(room);
    console.log('loading messages from gemini');
    const questions = await fetchNewQuestions(messages);
    setGeminiLoading(false);
    setShowGeminiModal(false);

    console.log('EXPO_PUBLIC_DOMAIN:', process.env.EXPO_PUBLIC_DOMAIN);


    console.log('questions', questions);   
    if (questions) {
      setInputText(questions);
    } else {
      console.log('no questions from gemini');
    }
  }, [room, roomToApiMessages]);

  const handleGetConversationBoost = useCallback(async () => {
    if (!room) return;
    setGeminiLoading(true);
    Haptics.selectionAsync();
    const messages = roomToApiMessages(room);
    const questions = await fetchNewQuestions(messages);
    setGeminiLoading(false);
    setShowGeminiModal(false);
    if (questions) {
      setInputText(questions);
    }
  }, [room, roomToApiMessages]);

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
  const participantNames = room.participants.map(p => p.name.split(' ')[0]).join(', ');

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} isOwn={item.senderId === user.id} />
  );

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
            {room.participants.slice(0, room.type === 'group' ? 4 : 2).map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.headerAvatar,
                  { backgroundColor: p.avatar, marginLeft: i > 0 ? -8 : 0, zIndex: room.participants.length - i },
                ]}
              >
                <Text style={styles.headerAvatarText}>{p.name[0]}</Text>
              </View>
            ))}
            {room.type === 'group' && room.participants.length > 4 && (
              <View style={[styles.headerAvatar, styles.headerAvatarMore, { marginLeft: -8 }]}>
                <Text style={styles.headerAvatarMoreText}>+{room.participants.length - 4}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{participantNames}</Text>
            <Text style={styles.headerSub}>
              {match?.transportMode === 'walk' ? 'Walking' : 'Transit'}{room.type === 'group' ? ' group' : ' buddy'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setShowInfoModal(true)}
          hitSlop={8}
          style={styles.infoButton}
        >
          <Ionicons name="information-circle-outline" size={28} color={Colors.text} />
        </Pressable>
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
          <View style={styles.inputWrapper}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowGeminiModal(true);
              }}
              style={styles.geminiLogo}
            >
              <Ionicons name="sparkles" size={20} color={Colors.primary} />
            </Pressable>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={500}
            />
          </View>
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color={Colors.textInverse} />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {room.type === 'group' ? 'Group Info' : 'Contact Info'}
              </Text>
              <Pressable
                onPress={() => setShowInfoModal(false)}
                hitSlop={8}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {room.participants.map(profile => (
                <View key={profile.id} style={styles.participantCard}>
                  <View style={styles.participantHeader}>
                    <View style={[styles.participantAvatar, { backgroundColor: profile.avatar }]}>
                      <Text style={styles.participantAvatarText}>{profile.name[0]}</Text>
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{profile.name}</Text>
                      <Text style={styles.participantOccupation}>{profile.occupation}</Text>
                    </View>
                  </View>
                  {profile.interests.length > 0 && (
                    <View style={styles.interestsRow}>
                      <Text style={styles.interestsLabel}>Interests</Text>
                      <View style={styles.interestChips}>
                        {profile.interests.map(interest => (
                          <View key={interest} style={styles.interestChip}>
                            <Text style={styles.interestChipText}>{interest}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {commuteFriends.some(f => f.id === profile.id) ? (
                    <Pressable
                      style={styles.unfriendButton}
                      onPress={() => handleRemoveFriend(profile.id)}
                    >
                      <Ionicons name="person-remove-outline" size={18} color={Colors.error} />
                      <Text style={styles.unfriendButtonText}>Unfriend</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.addFriendButton}
                      onPress={() => handleAddFriend(profile)}
                    >
                      <Ionicons name="person-add-outline" size={18} color={Colors.textInverse} />
                      <Text style={styles.addFriendButtonText}>Add as friend</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGeminiModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowGeminiModal(false)}
      >
        <Pressable
          style={styles.geminiModalOverlay}
          onPress={() => setShowGeminiModal(false)}
        >
          <View style={[styles.geminiModalContent, { marginBottom: insets.bottom + 100 }]}>
            <View style={styles.geminiModalHeader}>
              <View style={styles.geminiModalIcon}>
                <Ionicons name="sparkles" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.geminiModalTitle}>Gemini</Text>
            </View>
            {geminiLoading ? (
              <View style={styles.geminiModalLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.geminiModalLoadingText}>Thinking...</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [styles.geminiModalOption, pressed && { opacity: 0.7 }]}
                  onPress={handleAskExcitingQuestion}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
                  <Text style={styles.geminiModalOptionText}>Ask an exciting question!</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.geminiModalOption, pressed && { opacity: 0.7 }]}
                  onPress={handleGetConversationBoost}
                >
                  <Ionicons name="flame-outline" size={22} color={Colors.primary} />
                  <Text style={styles.geminiModalOptionText}>Get a conversation boost</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
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
  headerAvatarMore: {
    backgroundColor: Colors.surface,
  },
  headerAvatarMoreText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
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
  infoButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalScrollContent: {
    padding: 20,
    gap: 16,
  },
  participantCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  participantOccupation: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  interestsRow: {
    marginBottom: 12,
  },
  interestsLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  interestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  interestChipText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: Colors.textSecondary,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addFriendButtonText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  unfriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.error + '15',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  unfriendButtonText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.error,
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
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  geminiLogo: {
    marginRight: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 6,
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
  geminiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  geminiModalContent: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  geminiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  geminiModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiModalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  geminiModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  geminiModalOptionText: {
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    color: Colors.text,
  },
  geminiModalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  geminiModalLoadingText: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
  },
});
