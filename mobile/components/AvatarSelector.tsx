import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';
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
];

export default function AvatarSelector({ currentAvatar, onSelectAvatar }: AvatarSelectorProps) {
    const [seed, setSeed] = useState(Math.random().toString(36).substring(7));
    const [style, setStyle] = useState('avataaars');
    const [isLoading, setIsLoading] = useState(false);

    // Initialize with current avatar if it exists and looks like a DiceBear URL
    useEffect(() => {
        if (currentAvatar && currentAvatar.includes('api.dicebear.com')) {
            // Extract seed and style if possible, or just leave as is
            // For now, we'll just let the user generate new ones
        }
    }, []);

    const generateNewAvatar = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);
        setSeed(Math.random().toString(36).substring(7));
    };

    const changeStyle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);
        const currentIndex = DICEBEAR_STYLES.indexOf(style);
        const nextIndex = (currentIndex + 1) % DICEBEAR_STYLES.length;
        setStyle(DICEBEAR_STYLES[nextIndex]);
    };

    const avatarUrl = `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

    useEffect(() => {
        console.log('Generated Avatar URL:', avatarUrl);
        onSelectAvatar(avatarUrl);
    }, [avatarUrl]);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Profile Picture</Text>

            <View style={styles.selectorContainer}>
                <Pressable onPress={changeStyle} style={styles.arrowButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
                </Pressable>

                <View style={styles.avatarPreview}>
                    <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatarImage}
                        onLoadEnd={() => setIsLoading(false)}
                        onError={(e) => console.log('Avatar Load Error:', e.nativeEvent.error)}
                    />
                    {isLoading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                        </View>
                    )}
                </View>

                <Pressable onPress={changeStyle} style={styles.arrowButton}>
                    <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
                </Pressable>
            </View>

            <View style={styles.controls}>
                <Pressable
                    style={({ pressed }) => [styles.shuffleButton, pressed && { opacity: 0.8 }]}
                    onPress={generateNewAvatar}
                >
                    <Ionicons name="shuffle" size={20} color={Colors.textInverse} />
                    <Text style={styles.shuffleText}>Randomize</Text>
                </Pressable>

                <Text style={styles.styleName}>{style}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontFamily: 'Outfit_600SemiBold',
        color: Colors.text,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        alignSelf: 'flex-start',
    },
    selectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 16,
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
    arrowButton: {
        padding: 10,
        borderRadius: 20,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Changed to space-between to separate button and text
        width: '100%',
        paddingHorizontal: 10, // Added padding
    },
    shuffleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    shuffleText: {
        color: Colors.textInverse,
        fontFamily: 'Outfit_600SemiBold',
        fontSize: 14,
    },
    styleName: {
        fontSize: 14,
        fontFamily: 'Outfit_500Medium',
        color: Colors.textTertiary,
        textTransform: 'capitalize',
    },
});
