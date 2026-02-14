import {createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

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
  submitReview: (matchId: string, enjoyed: boolean) => Promise<void>;
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
  const usedNames = new Set<string>();

  return Array.from({ length: count }, () => {
    let name: string;
    do {
      name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    } while (usedNames.has(name));
    usedNames.add(name);

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

    const walkTimes = ['12 min', '15 min', '18 min', '22 min', '8 min', '25 min'];
    const transitTimes = ['8 min', '12 min', '15 min', '20 min', '6 min'];
    const times = userCommute.transportMode === 'walk' ? walkTimes : transitTimes;

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [commute, setCommuteState] = useState<Commute | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const wsConnections = useRef<{ [key: string]: WebSocket }>({});
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

    const allInterests = [
      user.interests,
      ...match.participants.map(p => p.interests),
    ];
    const icebreaker = generateIcebreaker(allInterests);

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

  useEffect(() => {
    if (!user || chatRooms.length === 0) return;

    chatRooms.forEach(room => {
      if (!wsConnections.current[room.id]) {
        // IMPROVED HOST DETECTION
        // 1. Check for manual override (useful for debugging)
        // 2. Try Expo hostUri (reliable for local dev with Expo Go)
        // 3. Fallback to 10.0.2.2 for Android emulator
        // 4. Ultimate fallback to localhost
        
        const host = 'flock.mzhang.dev';
        const wsUrl = `wss://${host}/api/chat/ws/chat/${room.id}`;
        console.log(`[WS] Attempting to connect to room ${room.id} at ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(`[WS] Connected to room ${room.id}`);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`[WS] Received message for room ${room.id}:`, data.type);
            if (data.type === 'message') {
              const incomingMsg: ChatMessage = {
                id: data.message.id,
                senderId: data.message.sender_id,
                senderName: data.message.sender_name,
                body: data.message.body,
                timestamp: data.message.timestamp,
                isSystem: data.message.is_system,
              };

              setChatRooms(prev => prev.map(r => {
                if (r.id === room.id) {
                  // If we already have this message (e.g. from optimistic update or previous history sync)
                  // but it has a temp ID or different ID, we should ideally deduplicate.
                  // For now, check by content and timestamp if it's from the same sender
                  const isDuplicate = r.messages.some(m => 
                    m.id === incomingMsg.id || 
                    (m.senderId === incomingMsg.senderId && m.body === incomingMsg.body && Math.abs(new Date(m.timestamp).getTime() - new Date(incomingMsg.timestamp).getTime()) < 2000)
                  );
                  
                  if (isDuplicate) {
                    // Update the optimistic message with the real ID from server if needed
                    return {
                      ...r,
                      messages: r.messages.map(m => 
                        (m.senderId === incomingMsg.senderId && m.body === incomingMsg.body && m.id.length > 30) // likely a randomUUID
                        ? { ...m, id: incomingMsg.id, timestamp: incomingMsg.timestamp } 
                        : m
                      )
                    };
                  }

                  return {
                    ...r,
                    messages: [...r.messages, incomingMsg],
                    lastMessage: incomingMsg.body,
                    lastMessageTime: incomingMsg.timestamp,
                  };
                }
                return r;
              }));
            } else if (data.type === 'history') {
              const historyMsgs: ChatMessage[] = data.messages.map((m: any) => ({
                id: m.id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                body: m.body,
                timestamp: m.timestamp,
                isSystem: m.is_system,
              }));

              setChatRooms(prev => prev.map(r => {
                if (r.id === room.id) {
                  return {
                    ...r,
                    messages: historyMsgs,
                    lastMessage: historyMsgs[historyMsgs.length - 1]?.body || r.lastMessage,
                    lastMessageTime: historyMsgs[historyMsgs.length - 1]?.timestamp || r.lastMessageTime,
                  };
                }
                return r;
              }));
            }
          } catch (e) {
            console.error(`Error parsing WebSocket message for room ${room.id}:`, e);
          }
        };

        ws.onerror = (e) => {
          console.error(`WebSocket error for room ${room.id}:`, e);
        };

        ws.onclose = (e) => {
          console.log(`WebSocket closed for room ${room.id}:`, e.code, e.reason);
          delete wsConnections.current[room.id];
        };

        wsConnections.current[room.id] = ws;
      }
    });
  }, [user, chatRooms]);

  const sendMessage = useCallback(async (chatRoomId: string, body: string) => {
    if (!user) return;

    // Optimistic Update
    const tempId = Crypto.randomUUID();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: user.id,
      senderName: user.name,
      body: body,
      timestamp: new Date().toISOString(),
      isSystem: false,
    };

    setChatRooms(prev => prev.map(r => {
      if (r.id === chatRoomId) {
        return {
          ...r,
          messages: [...r.messages, optimisticMsg],
          lastMessage: body,
          lastMessageTime: optimisticMsg.timestamp,
        };
      }
      return r;
    }));
    
    // Also update matches to keep lastMessage in sync for the list view
    setMatches(prev => prev.map(m => {
      if (m.chatRoomId === chatRoomId) {
        // Find the chat room to get its participants if needed, but here we just want to update metadata
        return { ...m };
      }
      return m;
    }));
    
    // AsyncStorage update for chatRooms
    setTimeout(async () => {
      try {
        const currentChats = await AsyncStorage.getItem('flock_chats');
        if (currentChats) {
          const parsed = JSON.parse(currentChats);
          const updated = parsed.map((r: any) => {
            if (r.id === chatRoomId) {
              return {
                ...r,
                messages: [...r.messages, optimisticMsg],
                lastMessage: body,
                lastMessageTime: optimisticMsg.timestamp,
              };
            }
            return r;
          });
          await AsyncStorage.setItem('flock_chats', JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Failed to update AsyncStorage in sendMessage:', e);
      }
    }, 0);

    let ws = wsConnections.current[chatRoomId];
    
    // If not connected, try to reconnect once
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log(`[WS] WebSocket not open for room ${chatRoomId}. Attempting to reconnect...`);
      const host = 'flock.mzhang.dev';
      const wsUrl = `wss://${host}/api/chat/ws/chat/${chatRoomId}`;
      console.log(`[WS] Reconnecting at ${wsUrl}`);
      ws = new WebSocket(wsUrl);
      
      // We'll have to wait for it to open to send the message, 
      // or just fail this time and let the next one succeed.
      // For a better UX, we can queue the message or wait a bit.
      // But for now, let's at least trigger the reconnection.
      wsConnections.current[chatRoomId] = ws;
      
      // Re-setup listeners (simplified)
      ws.onopen = () => {
        console.log(`Re-connected to room ${chatRoomId}`);
        ws.send(JSON.stringify({
          sender_id: user.id,
          sender_name: user.name,
          body: body
        }));
      };
        // Note: Full listener setup is handled by the useEffect on chatRooms change,
        // but since we are replacing the ref here, we need to ensure the new socket
        // also has the message handler to update the UI when the response comes back.
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
              const incomingMsg: ChatMessage = {
                id: data.message.id,
                senderId: data.message.sender_id,
                senderName: data.message.sender_name,
                body: data.message.body,
                timestamp: data.message.timestamp,
                isSystem: data.message.is_system,
              };
              setChatRooms(prev => prev.map(r => {
                if (r.id === chatRoomId) {
                  const isDuplicate = r.messages.some(m => 
                    m.id === incomingMsg.id || 
                    (m.senderId === incomingMsg.senderId && m.body === incomingMsg.body && Math.abs(new Date(m.timestamp).getTime() - new Date(incomingMsg.timestamp).getTime()) < 2000)
                  );
                  if (isDuplicate) {
                    return {
                      ...r,
                      messages: r.messages.map(m => 
                        (m.senderId === incomingMsg.senderId && m.body === incomingMsg.body && m.id.length > 30)
                        ? { ...m, id: incomingMsg.id, timestamp: incomingMsg.timestamp } 
                        : m
                      )
                    };
                  }
                  return {
                    ...r,
                    messages: [...r.messages, incomingMsg],
                    lastMessage: incomingMsg.body,
                    lastMessageTime: incomingMsg.timestamp,
                  };
                }
                return r;
              }));
            }
          } catch (e) {
            console.error(`Error parsing WebSocket message for room ${chatRoomId}:`, e);
          }
        };
        ws.onerror = (e) => console.error(`Re-connect WebSocket error for room ${chatRoomId}:`, e);
        ws.onclose = () => delete wsConnections.current[chatRoomId];
      // but manually re-triggering here for immediate send.
      return;
    }

    try {
      ws.send(JSON.stringify({
        sender_id: user.id,
        sender_name: user.name,
        body: body
      }));
    } catch (e) {
      console.error(`Error sending message over WebSocket for room ${chatRoomId}:`, e);
      // We already did an optimistic update, so the user sees it.
      // In a real app, we might want to mark it as "failed" in the UI.
    }
  }, [user]);

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
    submitReview,
    completeOnboarding,
    clearPendingReview,
    triggerMatching,
    logout,
  }), [user, commute, matches, chatRooms, commuteFriends, pendingReview, isLoading, isOnboarded,
    setUser, setCommute, acceptMatch, declineMatch, sendMessage, submitReview, completeOnboarding,
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
