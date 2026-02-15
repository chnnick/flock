import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  acceptSuggestion,
  createMeCommute,
  createMeUser,
  getActive,
  getChatRoom,
  getChats,
  getMeCommute,
  getMeUser,
  getSuggestions,
  passSuggestion,
  patchMeUser,
  queueMeCommute,
  pauseMeCommute,
  runMatching,
  sendChatMessage,
} from '@/lib/backend-api';
import { deleteAuthToken } from '@/lib/query-client';
import { ApiCommuteResponse, ApiMatchParticipantProfile, ApiMatchSuggestion, ApiUser } from '@/lib/api-types';

export interface UserProfile {
  id: string;
  name: string;
  occupation: string;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  interests: string[];
  commuteFriends: string[];
  createdAt: string;
}

export interface Commute {
  id: string;
  userId: string;
  startLocation: { lat: number; lng: number; name: string };
  endLocation: { lat: number; lng: number; name: string };
  earliestDeparture: string;
  latestArrival: string;
  transportMode: 'walk' | 'transit';
  matchPreference: 'group' | 'individual';
  genderPreference: 'any' | 'same';
  status: 'queued' | 'paused' | 'matched' | 'completed';
  createdAt: string;
  routeSegments: {
    type: 'walk' | 'transit';
    coordinates: [number, number][];
    label?: string;
    transitLine?: string;
    durationMinutes?: number;
  }[];
  routeCoordinates: [number, number][];
  otpTotalDurationMinutes?: number;
}

export interface MatchProfile {
  id: string;
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
  avatar: string;
}

export interface Match {
  id: string;
  participants: MatchProfile[];
  overlapScore: number;
  interestScore: number;
  compositeScore: number;
  sharedSegmentStart: { lat: number; lng: number; name: string };
  sharedSegmentEnd: { lat: number; lng: number; name: string };
  transportMode: 'walk' | 'transit';
  estimatedTime: string;
  status: 'pending' | 'active' | 'completed' | 'declined';
  chatRoomId?: string;
  createdAt: string;
  maxCapacity?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  timestamp: string;
  isSystem: boolean;
}

export interface ChatRoom {
  id: string;
  matchId: string;
  participants: MatchProfile[];
  messages: ChatMessage[];
  type: 'group' | 'dm';
  lastMessage?: string;
  lastMessageTime?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  matchId: string;
  enjoyed: boolean;
  createdAt: string;
}

interface AppContextValue {
  user: UserProfile | null;
  commute: Commute | null;
  matches: Match[];
  chatRooms: ChatRoom[];
  commuteFriends: MatchProfile[];
  pendingReview: Match | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setUser: (user: UserProfile) => Promise<void>;
  setCommute: (commute: Commute) => Promise<void>;
  acceptMatch: (matchId: string) => Promise<void>;
  declineMatch: (matchId: string) => Promise<void>;
  sendMessage: (chatRoomId: string, body: string) => Promise<void>;
  injectSystemMessage: (chatRoomId: string, body: string) => Promise<void>;
  deleteChatRoom: (chatRoomId: string) => Promise<void>;
  submitReview: (matchId: string, enjoyed: boolean) => Promise<void>;
  addCommuteFriend: (profile: MatchProfile) => Promise<void>;
  removeCommuteFriend: (profileId: string) => Promise<void>;
  getOrCreateChatRoomForFriend: (friend: MatchProfile) => Promise<string>;
  completeOnboarding: () => Promise<void>;
  clearPendingReview: () => void;
  triggerMatching: () => Promise<void>;
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const AVATAR_COLORS = ['#FF6B35', '#004E64', '#25A18E', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('404:');
}

function minuteToDisplay(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function displayToMinute(value: string): number {
  const trimmed = value.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) {
    return 8 * 60;
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

function avatarForId(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function userFromApi(user: ApiUser): UserProfile {
  return {
    id: user.auth0_id,
    name: user.name,
    occupation: user.occupation,
    gender: (user.gender as UserProfile['gender']) ?? 'prefer-not-to-say',
    interests: user.interests ?? [],
    commuteFriends: [],
    createdAt: user.created_at,
  };
}

function commuteFromApi(commute: ApiCommuteResponse): Commute {
  return {
    id: commute.id,
    userId: commute.user_auth0_id,
    startLocation: commute.start,
    endLocation: commute.end,
    earliestDeparture: minuteToDisplay(commute.time_window.start_minute),
    latestArrival: minuteToDisplay(commute.time_window.end_minute),
    transportMode: commute.transport_mode,
    matchPreference: commute.match_preference,
    genderPreference: commute.gender_preference,
    status: commute.status,
    createdAt: commute.created_at,
    routeSegments: commute.route_segments.map((segment) => ({
      type: segment.type,
      coordinates: segment.coordinates,
      label: segment.label ?? undefined,
      transitLine: segment.transit_line ?? undefined,
      durationMinutes: segment.duration_minutes ?? undefined,
    })),
    routeCoordinates: commute.route_coordinates,
    otpTotalDurationMinutes: commute.otp_total_duration_minutes ?? undefined,
  };
}

function participantProfile(participantId: string, self: UserProfile | null): MatchProfile {
  if (self && participantId === self.id) {
    return {
      id: self.id,
      name: self.name,
      occupation: self.occupation,
      gender: self.gender,
      interests: self.interests,
      avatar: avatarForId(self.id),
    };
  }
  const suffix = participantId.slice(-4).toUpperCase();
  return {
    id: participantId,
    name: `Commuter ${suffix}`,
    occupation: 'Flock user',
    gender: 'unknown',
    interests: [],
    avatar: avatarForId(participantId),
  };
}

function participantProfileFromApi(participant: ApiMatchParticipantProfile, self: UserProfile | null): MatchProfile {
  if (self && participant.auth0_id === self.id) {
      return {
      id: self.id,
      name: self.name,
      occupation: self.occupation,
      gender: self.gender,
      interests: self.interests,
      avatar: avatarForId(self.id),
    };
  }
  return {
    id: participant.auth0_id,
    name: participant.name,
    occupation: participant.occupation,
    gender: participant.gender,
    interests: participant.interests,
    avatar: avatarForId(participant.auth0_id),
  };
}

function matchFromApi(match: ApiMatchSuggestion, self: UserProfile | null): Match {
  const others = match.participants
    .filter((participant) => participant.auth0_id !== self?.id)
    .map((participant) => participantProfileFromApi(participant, self));
  const participants = others.length > 0
    ? others
    : match.participants.map((participant) => participantProfileFromApi(participant, self));
  return {
    id: match.id,
    participants,
    overlapScore: match.scores.overlap_score,
    interestScore: match.scores.interest_score,
    compositeScore: match.scores.composite_score,
    sharedSegmentStart: match.shared_segment_start,
    sharedSegmentEnd: match.shared_segment_end,
    transportMode: match.transport_mode,
    estimatedTime: `${match.estimated_time_minutes} min`,
    status: match.status === 'active' ? 'active' : match.status === 'completed' ? 'completed' : 'pending',
    chatRoomId: match.chat_room_id ?? undefined,
    createdAt: match.created_at,
    maxCapacity: match.kind === 'group' ? 4 : undefined,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [commute, setCommuteState] = useState<Commute | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [commuteFriends, setCommuteFriends] = useState<MatchProfile[]>([]);
  const [pendingReview, setPendingReview] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const refreshMatchesAndChats = useCallback(async (currentUser: UserProfile | null) => {
    const [suggestedIndividual, suggestedGroup, activeIndividual, activeGroup] = await Promise.all([
      getSuggestions('individual'),
      getSuggestions('group'),
      getActive('individual'),
      getActive('group'),
    ]);

    const allMatches = [
      ...suggestedIndividual,
      ...suggestedGroup,
      ...activeIndividual,
      ...activeGroup,
    ];
    const mergedMatches = new Map<string, ApiMatchSuggestion>();
    allMatches.forEach((match) => mergedMatches.set(match.id, match));
    const visibleMatches = Array.from(mergedMatches.values()).filter(
      (match) => match.source === 'suggested' || (match.source === 'queue_assigned' && match.status === 'active'),
    );
    const matchById = new Map<string, ApiMatchSuggestion>(visibleMatches.map((match) => [match.id, match]));
    const mappedMatches = visibleMatches
      .map((item) => matchFromApi(item, currentUser))
      .sort((a, b) => b.compositeScore - a.compositeScore);
    setMatches(mappedMatches);

    const rooms = await getChats();
    const details = await Promise.all(rooms.map((room) => getChatRoom(room.id)));
    const mappedRooms: ChatRoom[] = details
      .filter((room) => matchById.has(room.match_id))
      .map((room) => {
        const relatedMatch = matchById.get(room.match_id);
        const roomParticipants = relatedMatch
          ? relatedMatch.participants
            .filter((participant) => participant.auth0_id !== currentUser?.id)
            .map((participant) => participantProfileFromApi(participant, currentUser))
          : room.participants
        .filter((participant) => participant !== currentUser?.id)
        .map((id) => participantProfile(id, currentUser));
      return {
        id: room.id,
        matchId: room.match_id,
        participants: roomParticipants,
        messages: room.messages.map((message) => ({
          id: message.id,
          senderId: message.sender_auth0_id ?? 'system',
          senderName: message.sender_name,
          body: message.body,
          timestamp: message.created_at,
          isSystem: message.is_system,
        })),
        type: room.type,
        lastMessage: room.last_message ?? undefined,
        lastMessageTime: room.last_message_time ?? undefined,
        createdAt: room.created_at,
      };
    });
    setChatRooms(mappedRooms.sort((a, b) => new Date(b.lastMessageTime ?? b.createdAt).getTime() - new Date(a.lastMessageTime ?? a.createdAt).getTime()));

    try {
      const latestCommute = await getMeCommute();
      setCommuteState(commuteFromApi(latestCommute));
    } catch (error) {
      if (isNotFoundError(error)) {
        setCommuteState(null);
      } else {
        console.error('Failed to refresh commute state', error);
      }
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const friendsRaw = await AsyncStorage.getItem('flock_friends');
        if (friendsRaw) {
          setCommuteFriends(JSON.parse(friendsRaw));
        }

        const apiUser = await getMeUser();
        const mappedUser = userFromApi(apiUser);
        setUserState(mappedUser);
        setIsOnboarded(true);

        try {
          const apiCommute = await getMeCommute();
          setCommuteState(commuteFromApi(apiCommute));
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
          setCommuteState(null);
        }

        await refreshMatchesAndChats(mappedUser);
      } catch (error) {
        if (isNotFoundError(error)) {
          setUserState(null);
          setCommuteState(null);
          setMatches([]);
          setChatRooms([]);
          setIsOnboarded(false);
        } else {
          console.error('Failed to initialize app data', error);
        }
    } finally {
      setIsLoading(false);
    }
  };
    load();
  }, [refreshMatchesAndChats]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const interval = setInterval(() => {
      refreshMatchesAndChats(user).catch((error) => {
        console.error('Background refresh failed', error);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshMatchesAndChats, user]);

  const setUser = useCallback(async (newUser: UserProfile) => {
    const payload = {
      name: newUser.name,
      occupation: newUser.occupation,
      gender: newUser.gender,
      interests: newUser.interests,
    };
    const saved = user ? await patchMeUser(payload) : await createMeUser(payload);
    const mapped = userFromApi(saved);
    setUserState(mapped);
    setIsOnboarded(true);
  }, [user]);

  const setCommute = useCallback(async (newCommute: Commute) => {
    const startMinute = displayToMinute(newCommute.earliestDeparture);
    const endMinute = Math.max(startMinute + 1, displayToMinute(newCommute.latestArrival));
    const saved = await createMeCommute({
      start: newCommute.startLocation,
      end: newCommute.endLocation,
      time_window: {
        start_minute: startMinute,
        end_minute: endMinute,
      },
      transport_mode: newCommute.transportMode,
      match_preference: newCommute.matchPreference,
      group_size_pref: newCommute.matchPreference === 'individual' ? { min: 2, max: 2 } : { min: 3, max: 4 },
      gender_preference: newCommute.genderPreference,
      enable_queue_flow: true,
      enable_suggestions_flow: true,
      queue_days_of_week: [0, 1, 2, 3, 4],
    });
    setCommuteState(commuteFromApi(saved));
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const triggerMatching = useCallback(async () => {
    await runMatching(false);
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const joinQueue = useCallback(async () => {
    const queued = await queueMeCommute();
    setCommuteState(commuteFromApi(queued));
    await runMatching(true);
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const leaveQueue = useCallback(async () => {
    const paused = await pauseMeCommute();
    setCommuteState(commuteFromApi(paused));
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const acceptMatch = useCallback(async (matchId: string) => {
    await acceptSuggestion(matchId);
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const declineMatch = useCallback(async (matchId: string) => {
    await passSuggestion(matchId);
    await refreshMatchesAndChats(user);
  }, [refreshMatchesAndChats, user]);

  const deleteChatRoom = useCallback(async (chatRoomId: string) => {
    setChatRooms((prev) => prev.filter((room) => room.id !== chatRoomId));
  }, []);

  const sendMessage = useCallback(async (chatRoomId: string, body: string) => {
    const text = body.trim();
    if (!text) {
      return;
    }
    await sendChatMessage(chatRoomId, text);
    const room = await getChatRoom(chatRoomId);
    const relatedMatch = matches.find((item) => item.chatRoomId === room.id);
    const roomParticipants = relatedMatch?.participants
      ?? room.participants
      .filter((participant) => participant !== user?.id)
      .map((id) => participantProfile(id, user));
    const mappedRoom: ChatRoom = {
      id: room.id,
      matchId: room.match_id,
      participants: roomParticipants,
      messages: room.messages.map((message) => ({
        id: message.id,
        senderId: message.sender_auth0_id ?? 'system',
        senderName: message.sender_name,
        body: message.body,
        timestamp: message.created_at,
        isSystem: message.is_system,
      })),
      type: room.type,
      lastMessage: room.last_message ?? undefined,
      lastMessageTime: room.last_message_time ?? undefined,
      createdAt: room.created_at,
    };
    setChatRooms((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== chatRoomId);
      return [mappedRoom, ...withoutCurrent];
    });
  }, [matches, user]);

  const injectSystemMessage = useCallback(async (chatRoomId: string, body: string) => {
    const systemMessage: ChatMessage = {
      id: Crypto.randomUUID(),
      senderId: 'system',
      senderName: 'Flock',
      body,
      timestamp: new Date().toISOString(),
      isSystem: true,
    };
    const updatedChats = chatRooms.map(room => {
      if (room.id === chatRoomId) {
        return {
          ...room,
          messages: [...room.messages, systemMessage],
          lastMessage: body,
          lastMessageTime: systemMessage.timestamp,
        };
      }
      return room;
    });
    setChatRooms(updatedChats);
    await AsyncStorage.setItem('flock_chats', JSON.stringify(updatedChats));
  }, [chatRooms]);

  const submitReview = useCallback(async (matchId: string, enjoyed: boolean) => {
    const match = matches.find((item) => item.id === matchId);
    if (!match) {
      return;
    }
    if (enjoyed) {
      const newFriends = [...commuteFriends, ...match.participants.filter((participant) => !commuteFriends.some((friend) => friend.id === participant.id))];
      setCommuteFriends(newFriends);
      await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));
    }
    setPendingReview(null);
  }, [commuteFriends, matches]);

  const addCommuteFriend = useCallback(async (profile: MatchProfile) => {
    if (commuteFriends.some((friend) => friend.id === profile.id)) {
      return;
    }
    const newFriends = [...commuteFriends, profile];
    setCommuteFriends(newFriends);
    await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));
  }, [commuteFriends]);

  const removeCommuteFriend = useCallback(async (profileId: string) => {
    const newFriends = commuteFriends.filter((friend) => friend.id !== profileId);
    setCommuteFriends(newFriends);
    await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));
  }, [commuteFriends]);

  const getOrCreateChatRoomForFriend = useCallback(async (friend: MatchProfile): Promise<string> => {
    const existing = chatRooms.find((room) => room.type === 'dm' && room.participants.some((participant) => participant.id === friend.id));
    if (existing) {
      return existing.id;
    }
    const newRoom: ChatRoom = {
      id: Crypto.randomUUID(),
      matchId: Crypto.randomUUID(),
      participants: [friend],
      messages: [],
      type: 'dm',
      createdAt: new Date().toISOString(),
    };
    setChatRooms((prev) => [newRoom, ...prev]);
    return newRoom.id;
  }, [chatRooms]);

  const completeOnboarding = useCallback(async () => {
    setIsOnboarded(true);
  }, []);

  const clearPendingReview = useCallback(() => {
    setPendingReview(null);
  }, []);

  const logout = useCallback(async () => {
    setUserState(null);
    setCommuteState(null);
    setMatches([]);
    setChatRooms([]);
    setCommuteFriends([]);
    setIsOnboarded(false);
    setPendingReview(null);
    await deleteAuthToken();
    await AsyncStorage.multiRemove(['flock_friends', 'flock_user', 'flock_commute', 'flock_matches', 'flock_chats', 'flock_onboarded']);
  }, []);

  const value = useMemo(() => ({
    user,
    commute,
    matches,
    chatRooms,
    commuteFriends,
    pendingReview,
    isLoading,
    isOnboarded,
    setUser,
    setCommute,
    acceptMatch,
    declineMatch,
    sendMessage,
    injectSystemMessage,
    deleteChatRoom,
    submitReview,
    addCommuteFriend,
    removeCommuteFriend,
    getOrCreateChatRoomForFriend,
    completeOnboarding,
    clearPendingReview,
    triggerMatching,
    joinQueue,
    leaveQueue,
    logout,
  }), [
    user,
    commute,
    matches,
    chatRooms,
    commuteFriends,
    pendingReview,
    isLoading,
    isOnboarded,
    setUser,
    setCommute,
    acceptMatch,
    declineMatch,
    sendMessage,
    deleteChatRoom,
    submitReview,
    addCommuteFriend,
    removeCommuteFriend,
    getOrCreateChatRoomForFriend,
    completeOnboarding,
    clearPendingReview,
    triggerMatching,
    joinQueue,
    leaveQueue,
    logout,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
