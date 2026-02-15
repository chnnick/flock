import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface AvatarSelectorProps {
    currentAvatar?: string;
    onSelectAvatar: (avatarUrl: string) => void;
}

const DICEBEAR_STYLES = [
    'avataaars',
    'bottts',
    'fun-emoji',
    'lorelei',
    'notionists',
    'open-peeps',
    'personas',
    'micah',
    'miniavs',
    'thumbs',
];

const BACKGROUND_COLORS = [
    'b6e3f4', // Light Blue
    'c0aede', // Light Purple
    'd1d4f9', // Periwinkle
    'ffd5dc', // Light Pink
    'ffdfbf', // Light Orange
    'fdba74', // Orange
    '86efac', // Green
    '93c5fd', // Blue
    'c4b5fd', // Violet
    'fca5a5', // Red
    'fcd34d', // Yellow
    'e5e7eb', // Gray
];

export default function AvatarSelector({ currentAvatar, onSelectAvatar }: AvatarSelectorProps) {
    const [seed, setSeed] = useState(Math.random().toString(36).substring(7));
    const [style, setStyle] = useState('avataaars');
    const [backgroundColor, setBackgroundColor] = useState<string>(BACKGROUND_COLORS[0]);
    const [isLoading, setIsLoading] = useState(false);

    // Track if we've initialized from the prop to avoid infinite loops or overwrites
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize with current avatar if it exists and looks like a DiceBear URL
    useEffect(() => {
        if (!isInitialized && currentAvatar && currentAvatar.includes('api.dicebear.com')) {
            try {
                // Example URL: https://api.dicebear.com/9.x/avataaars/png?seed=abc&backgroundColor=b6e3f4
                const url = new URL(currentAvatar);

                // Extract style
                const pathParts = url.pathname.split('/');
                const styleInUrl = pathParts.find(part => DICEBEAR_STYLES.includes(part));
                if (styleInUrl) {
                    setStyle(styleInUrl);
                }

                // Extract seed
                const seedInUrl = url.searchParams.get('seed');
                if (seedInUrl) {
                    setSeed(seedInUrl);
                }

                // Extract background color
                // Dicebear can accept comma-separated lists, we'll just take the first one or the whole string and see if it matches our list
                // If it's not in our list, we might want to add it or just ignore. 
                // For simplicity, let's just use what's there if it's a valid hex(ish) code.
                const bgInUrl = url.searchParams.get('backgroundColor');
                if (bgInUrl) {
                    // Check if it's a comma separated list, just take the first one for our state
                    const firstBg = bgInUrl.split(',')[0];
                    setBackgroundColor(firstBg);
                }
            } catch (e) {
                console.log('Error parsing avatar URL:', e);
            }
            setIsInitialized(true);
        } else if (!isInitialized) {
            // Random start if no current avatar
            const randomStyle = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
            const randomBg = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)];
            setStyle(randomStyle);
            setBackgroundColor(randomBg);
            setIsInitialized(true);
        }
    }, [currentAvatar, isInitialized]);

    const generateNewSeed = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);
        setSeed(Math.random().toString(36).substring(7));
    };

    // Construct the URL
    // We use a specific background color if selected, or we could support 'transparent' but the UI looks better with bg.
    const avatarUrl = `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&backgroundColor=${backgroundColor}`;

    // Update parent when our local state changes, but only after initialization
    useEffect(() => {
        if (isInitialized) {
            onSelectAvatar(avatarUrl);
        }
    }, [avatarUrl, isInitialized]);

    const handleStyleSelect = (newStyle: string) => {
        if (style !== newStyle) {
            Haptics.selectionAsync();
            setIsLoading(true);
            setStyle(newStyle);
        }
    };

    const handleColorSelect = (color: string) => {
        if (backgroundColor !== color) {
            Haptics.selectionAsync();
            setIsLoading(true);
            setBackgroundColor(color);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.previewContainer}>
                <View style={styles.avatarPreview}>
                    <Image
                        key={avatarUrl}
                        source={{ uri: avatarUrl }}
                        style={styles.avatarImage}
                        resizeMode="cover"
                        onLoadEnd={() => setIsLoading(false)}
                        onError={(e) => console.log('Avatar Load Error:', e.nativeEvent.error)}
                    />
                    {isLoading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                        </View>
                    )}
                </View>

                <Pressable
                    style={({ pressed }) => [styles.randomizeButton, pressed && { opacity: 0.8 }]}
                    onPress={generateNewSeed}
                >
                    <Ionicons name="dice-outline" size={20} color={Colors.textInverse} />
                    <Text style={styles.randomizeText}>Randomize</Text>
                </Pressable>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Style</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {DICEBEAR_STYLES.map((s) => (
                        <Pressable
                            key={s}
                            onPress={() => handleStyleSelect(s)}
                            style={[
                                styles.chip,
                                style === s && styles.chipActive
                            ]}
                        >
                            <Text style={[
                                styles.chipText,
                                style === s && styles.chipTextActive
                            ]}>
                                {s}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Background</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {BACKGROUND_COLORS.map((c) => (
                        <Pressable
                            key={c}
                            onPress={() => handleColorSelect(c)}
                            style={[
                                styles.colorCircle,
                                { backgroundColor: `#${c}` },
                                backgroundColor === c && styles.colorCircleActive
                            ]}
                        >
                            {backgroundColor === c && (
                                <Ionicons name="checkmark" size={16} color="rgba(0,0,0,0.5)" />
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    previewContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarPreview: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.card,
        borderWidth: 3,
        borderColor: Colors.border,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    randomizeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    randomizeText: {
        color: Colors.textInverse,
        fontFamily: 'Outfit_600SemiBold',
        fontSize: 14,
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Outfit_600SemiBold',
        color: Colors.text,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingRight: 20,
        gap: 10,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontFamily: 'Outfit_500Medium',
        color: Colors.text,
        textTransform: 'capitalize',
    },
    chipTextActive: {
        color: Colors.textInverse,
    },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorCircleActive: {
        borderColor: Colors.text,
        transform: [{ scale: 1.1 }],
    },
});
