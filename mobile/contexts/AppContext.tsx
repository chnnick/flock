import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { fetchIntroduction } from '@/lib/chat-api';

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
  status: 'queued' | 'matched' | 'completed';
  createdAt: string;
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
  chatRoomId: string;
  createdAt: string;
  maxCapacity?: number;  // e.g. 4 for groups; undefined = individual
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
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const SAMPLE_INTERESTS = [
  'Reading', 'Podcasts', 'Running', 'Cooking', 'Photography',
  'Music', 'Hiking', 'Coffee', 'Tech', 'Art', 'Yoga', 'Travel',
  'Gaming', 'Cycling', 'Movies', 'Gardening', 'Writing', 'Dance',
];

const SAMPLE_NAMES = [
  'Alex Chen', 'Jordan Rivera', 'Sam Parker', 'Morgan Lee', 'Taylor Kim',
  'Casey Brooks', 'Riley Patel', 'Quinn Johnson', 'Avery Torres', 'Drew Martinez',
  'Jamie Williams', 'Skyler Davis', 'Reese Thompson', 'Blake Anderson', 'Cameron Wright',
];

const SAMPLE_OCCUPATIONS = [
  'Software Engineer', 'Graphic Designer', 'Teacher', 'Nurse', 'Marketing Manager',
  'Data Analyst', 'Product Manager', 'Architect', 'Accountant', 'Writer',
  'Photographer', 'Researcher', 'Chef', 'Consultant', 'Student',
];

const SAMPLE_LOCATIONS = [
  { lat: 42.3601, lng: -71.0589, name: 'Downtown Crossing' },
  { lat: 42.3554, lng: -71.0640, name: 'Boston Common' },
  { lat: 42.3516, lng: -71.0666, name: 'Back Bay' },
  { lat: 42.3625, lng: -71.0567, name: 'Government Center' },
  { lat: 42.3656, lng: -71.0618, name: 'North End' },
  { lat: 42.3467, lng: -71.0972, name: 'Brookline Village' },
  { lat: 42.3519, lng: -71.0552, name: 'South Station' },
  { lat: 42.3662, lng: -71.0621, name: 'Haymarket' },
  { lat: 42.3526, lng: -71.0550, name: 'Financial District' },
  { lat: 42.3395, lng: -71.0943, name: 'Coolidge Corner' },
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateMatchProfiles(count: number, userGender?: string): MatchProfile[] {
  const genders = ['male', 'female', 'non-binary'] as const;
  const avatarColors = ['#FF6B35', '#004E64', '#25A18E', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
  const shuffledNames = [...SAMPLE_NAMES].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const baseName = shuffledNames[i % SAMPLE_NAMES.length];
    const name = i >= SAMPLE_NAMES.length ? `${baseName.split(' ')[0]} ${Math.floor(i / SAMPLE_NAMES.length) + 1}` : baseName;

    return {
      id: Crypto.randomUUID(),
      name,
      occupation: SAMPLE_OCCUPATIONS[Math.floor(Math.random() * SAMPLE_OCCUPATIONS.length)],
      gender: genders[Math.floor(Math.random() * genders.length)],
      interests: pickRandom(SAMPLE_INTERESTS, 3 + Math.floor(Math.random() * 4)),
      avatar: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    };
  });
}

function generateIcebreaker(interests: string[][]): string {
  const commonInterests = interests[0]?.filter(i =>
    interests.some((other, idx) => idx > 0 && other.includes(i))
  ) || [];

  if (commonInterests.length > 0) {
    const templates = [
      `Great news - you all share a love for ${commonInterests.slice(0, 2).join(' and ')}! What's your favorite thing about it?`,
      `Looks like ${commonInterests[0]} is something you have in common! Have any good recommendations to share?`,
      `You're matched! I noticed you're all into ${commonInterests.slice(0, 2).join(' and ')}. Perfect conversation starters for your walk together!`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  const templates = [
    "Welcome to your commute group! Why not share what you're currently reading or listening to?",
    "Hey everyone! You're matched for your commute. What's the best thing that happened to you this week?",
    "Your commute just got more interesting! Share one fun fact about yourselves to break the ice.",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateMatches(userCommute: Commute, userProfile: UserProfile): Match[] {
  const walkTimes = ['12 min', '15 min', '18 min', '22 min', '8 min', '25 min'];
  const transitTimes = ['8 min', '12 min', '15 min', '20 min', '6 min'];
  const times = userCommute.transportMode === 'walk' ? walkTimes : transitTimes;

  if (userCommute.matchPreference === 'individual') {
    const count = 3 + Math.floor(Math.random() * 4);
    const profiles = generateMatchProfiles(count, userProfile.gender);

    return profiles.map(profile => {
      const overlapScore = 0.4 + Math.random() * 0.55;
      const commonInterests = profile.interests.filter(i => userProfile.interests.includes(i));
      const union = new Set([...profile.interests, ...userProfile.interests]);
      const interestScore = commonInterests.length / union.size;
      const compositeScore = 0.8 * overlapScore + 0.2 * interestScore;

      const startIdx = Math.floor(Math.random() * SAMPLE_LOCATIONS.length);
      let endIdx = startIdx;
      while (endIdx === startIdx) {
        endIdx = Math.floor(Math.random() * SAMPLE_LOCATIONS.length);
      }

      const chatRoomId = Crypto.randomUUID();
      const matchId = Crypto.randomUUID();

      return {
        id: matchId,
        participants: [profile],
        overlapScore,
        interestScore,
        compositeScore,
        sharedSegmentStart: SAMPLE_LOCATIONS[startIdx],
        sharedSegmentEnd: SAMPLE_LOCATIONS[endIdx],
        transportMode: userCommute.transportMode,
        estimatedTime: times[Math.floor(Math.random() * times.length)],
        status: 'pending' as const,
        chatRoomId,
        createdAt: new Date().toISOString(),
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }

  // Group matches
  const groupCount = 3 + Math.floor(Math.random() * 3);  // 3–5 groups
  const allProfiles = generateMatchProfiles(groupCount * 4, userProfile.gender);  // enough for all groups
  const matches: Match[] = [];
  let profileIdx = 0;

  for (let g = 0; g < groupCount; g++) {
    const groupSize = 2 + Math.floor(Math.random() * 2);  // 2–3 participants (room for user to join; max 4)
    const groupProfiles = allProfiles.slice(profileIdx, profileIdx + groupSize);
    profileIdx += groupSize;

    const overlapScore = 0.4 + Math.random() * 0.55;
    const allInterests = groupProfiles.flatMap(p => p.interests);
    const commonWithUser = allInterests.filter(i => userProfile.interests.includes(i));
    const union = new Set([...allInterests, ...userProfile.interests]);
    const interestScore = union.size > 0 ? commonWithUser.length / union.size : 0;
    const compositeScore = 0.8 * overlapScore + 0.2 * interestScore;

    const startIdx = Math.floor(Math.random() * SAMPLE_LOCATIONS.length);
    let endIdx = startIdx;
    while (endIdx === startIdx) {
      endIdx = Math.floor(Math.random() * SAMPLE_LOCATIONS.length);
    }

    const chatRoomId = Crypto.randomUUID();
    const matchId = Crypto.randomUUID();

    matches.push({
      id: matchId,
      participants: groupProfiles,
      overlapScore,
      interestScore,
      compositeScore,
      sharedSegmentStart: SAMPLE_LOCATIONS[startIdx],
      sharedSegmentEnd: SAMPLE_LOCATIONS[endIdx],
      transportMode: userCommute.transportMode,
      estimatedTime: times[Math.floor(Math.random() * times.length)],
      status: 'pending' as const,
      chatRoomId,
      createdAt: new Date().toISOString(),
      maxCapacity: 4,
    });
  }

  return matches.sort((a, b) => b.compositeScore - a.compositeScore);
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, commuteData, matchesData, chatData, friendsData, onboarded] = await Promise.all([
        AsyncStorage.getItem('flock_user'),
        AsyncStorage.getItem('flock_commute'),
        AsyncStorage.getItem('flock_matches'),
        AsyncStorage.getItem('flock_chats'),
        AsyncStorage.getItem('flock_friends'),
        AsyncStorage.getItem('flock_onboarded'),
      ]);

      if (userData) setUserState(JSON.parse(userData));
      if (commuteData) setCommuteState(JSON.parse(commuteData));
      if (matchesData) setMatches(JSON.parse(matchesData));
      if (chatData) setChatRooms(JSON.parse(chatData));
      if (friendsData) setCommuteFriends(JSON.parse(friendsData));
      if (onboarded === 'true') setIsOnboarded(true);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setUser = useCallback(async (newUser: UserProfile) => {
    setUserState(newUser);
    await AsyncStorage.setItem('flock_user', JSON.stringify(newUser));
  }, []);

  const setCommute = useCallback(async (newCommute: Commute) => {
    setCommuteState(newCommute);
    await AsyncStorage.setItem('flock_commute', JSON.stringify(newCommute));
  }, []);

  const triggerMatching = useCallback(async () => {
    if (!commute || !user) return;
    const newMatches = generateMatches(commute, user);
    setMatches(newMatches);
    await AsyncStorage.setItem('flock_matches', JSON.stringify(newMatches));
  }, [commute, user]);

  const acceptMatch = useCallback(async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !user) return;

    const updatedMatches = matches.map(m =>
      m.id === matchId ? { ...m, status: 'active' as const } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem('flock_matches', JSON.stringify(updatedMatches));

    const users = [
      { name: user.name, occupation: user.occupation, interests: user.interests },
      ...match.participants.map(p => ({ name: p.name, occupation: p.occupation, interests: p.interests })),
    ];
    let icebreaker = await fetchIntroduction(users);
    if (!icebreaker) {
      const allInterests = [user.interests, ...match.participants.map(p => p.interests)];
      icebreaker = generateIcebreaker(allInterests);
    }

    const newChatRoom: ChatRoom = {
      id: match.chatRoomId,
      matchId,
      participants: match.participants,
      messages: [{
        id: Crypto.randomUUID(),
        senderId: 'system',
        senderName: 'Flock',
        body: icebreaker,
        timestamp: new Date().toISOString(),
        isSystem: true,
      }],
      type: match.participants.length > 1 ? 'group' : 'dm',
      lastMessage: icebreaker,
      lastMessageTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const updatedChats = [...chatRooms, newChatRoom];
    setChatRooms(updatedChats);
    await AsyncStorage.setItem('flock_chats', JSON.stringify(updatedChats));
  }, [matches, chatRooms, user]);

  const declineMatch = useCallback(async (matchId: string) => {
    const updatedMatches = matches.map(m =>
      m.id === matchId ? { ...m, status: 'declined' as const } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem('flock_matches', JSON.stringify(updatedMatches));
  }, [matches]);

  const deleteChatRoom = useCallback(async (chatRoomId: string) => {
    const updatedChats = chatRooms.filter(r => r.id !== chatRoomId);
    setChatRooms(updatedChats);
    await AsyncStorage.setItem('flock_chats', JSON.stringify(updatedChats));
    const match = matches.find(m => m.chatRoomId === chatRoomId);
    if (match) {
      const updatedMatches = matches.map(m =>
        m.chatRoomId === chatRoomId ? { ...m, status: 'declined' as const } : m
      );
      setMatches(updatedMatches);
      await AsyncStorage.setItem('flock_matches', JSON.stringify(updatedMatches));
    }
  }, [chatRooms, matches]);

  const sendMessage = useCallback(async (chatRoomId: string, body: string) => {
    if (!user) return;
    const newMessage: ChatMessage = {
      id: Crypto.randomUUID(),
      senderId: user.id,
      senderName: user.name,
      body,
      timestamp: new Date().toISOString(),
      isSystem: false,
    };

    const updatedChats = chatRooms.map(room => {
      if (room.id === chatRoomId) {
        return {
          ...room,
          messages: [...room.messages, newMessage],
          lastMessage: body,
          lastMessageTime: new Date().toISOString(),
        };
      }
      return room;
    });

    setChatRooms(updatedChats);
    await AsyncStorage.setItem('flock_chats', JSON.stringify(updatedChats));

    setTimeout(() => {
      const room = updatedChats.find(r => r.id === chatRoomId);
      if (!room || room.participants.length === 0) return;
      const responder = room.participants[Math.floor(Math.random() * room.participants.length)];

      const responses = [
        "Sounds great! Looking forward to our commute together.",
        "That's awesome! I walk that route almost every day.",
        "Nice to meet you! What time works best for you?",
        "Same here! I love that area. See you tomorrow?",
        "Perfect, let's plan for the morning commute!",
        "Great to connect! I usually head out around 8am.",
      ];

      const replyMessage: ChatMessage = {
        id: Crypto.randomUUID(),
        senderId: responder.id,
        senderName: responder.name,
        body: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toISOString(),
        isSystem: false,
      };

      setChatRooms(prev => {
        const updated = prev.map(r => {
          if (r.id === chatRoomId) {
            return {
              ...r,
              messages: [...r.messages, replyMessage],
              lastMessage: replyMessage.body,
              lastMessageTime: replyMessage.timestamp,
            };
          }
          return r;
        });
        AsyncStorage.setItem('flock_chats', JSON.stringify(updated));
        return updated;
      });
    }, 1500 + Math.random() * 2000);
  }, [chatRooms, user]);

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
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (enjoyed) {
      const newFriends = [...commuteFriends, ...match.participants.filter(
        p => !commuteFriends.some(f => f.id === p.id)
      )];
      setCommuteFriends(newFriends);
      await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));

      const updatedMatches = matches.map(m =>
        m.id === matchId ? { ...m, status: 'completed' as const } : m
      );
      setMatches(updatedMatches);
      await AsyncStorage.setItem('flock_matches', JSON.stringify(updatedMatches));
    } else {
      const updatedMatches = matches.map(m =>
        m.id === matchId ? { ...m, status: 'declined' as const } : m
      );
      setMatches(updatedMatches);
      await AsyncStorage.setItem('flock_matches', JSON.stringify(updatedMatches));
    }

    setPendingReview(null);
  }, [matches, commuteFriends]);

  const addCommuteFriend = useCallback(async (profile: MatchProfile) => {
    if (commuteFriends.some(f => f.id === profile.id)) return;
    const newFriends = [...commuteFriends, profile];
    setCommuteFriends(newFriends);
    await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));
  }, [commuteFriends]);

  const removeCommuteFriend = useCallback(async (profileId: string) => {
    const newFriends = commuteFriends.filter(f => f.id !== profileId);
    setCommuteFriends(newFriends);
    await AsyncStorage.setItem('flock_friends', JSON.stringify(newFriends));
  }, [commuteFriends]);

  const getOrCreateChatRoomForFriend = useCallback(async (friend: MatchProfile): Promise<string> => {
    const existing = chatRooms.find(r =>
      r.type === 'dm' && r.participants.length === 1 && r.participants[0].id === friend.id
    );
    if (existing) return existing.id;
    let icebreaker: string;
    if (user) {
      const intro = await fetchIntroduction([
        { name: user.name, occupation: user.occupation, interests: user.interests },
        { name: friend.name, occupation: friend.occupation, interests: friend.interests },
      ]);
      icebreaker = intro ?? generateIcebreaker([user.interests, friend.interests]);
    } else {
      icebreaker = "You're connected! Say hi and plan your next commute together.";
    }
    const systemMessage = {
      id: Crypto.randomUUID(),
      senderId: 'system',
      senderName: 'Flock',
      body: icebreaker,
      timestamp: new Date().toISOString(),
      isSystem: true,
    };
    const newRoom: ChatRoom = {
      id: Crypto.randomUUID(),
      matchId: Crypto.randomUUID(),
      participants: [friend],
      messages: [systemMessage],
      type: 'dm',
      lastMessage: icebreaker,
      lastMessageTime: systemMessage.timestamp,
      createdAt: new Date().toISOString(),
    };
    const updated = [...chatRooms, newRoom];
    setChatRooms(updated);
    AsyncStorage.setItem('flock_chats', JSON.stringify(updated));
    return newRoom.id;
  }, [chatRooms, user]);

  const completeOnboarding = useCallback(async () => {
    setIsOnboarded(true);
    await AsyncStorage.setItem('flock_onboarded', 'true');
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
    await AsyncStorage.multiRemove([
      'flock_user', 'flock_commute', 'flock_matches',
      'flock_chats', 'flock_friends', 'flock_onboarded',
    ]);
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
    logout,
  }), [user, commute, matches, chatRooms, commuteFriends, pendingReview, isLoading, isOnboarded,
    setUser, setCommute, acceptMatch, declineMatch, sendMessage, injectSystemMessage, deleteChatRoom, submitReview, addCommuteFriend, removeCommuteFriend, getOrCreateChatRoomForFriend, completeOnboarding,
    clearPendingReview, triggerMatching, logout]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
