import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
// import { Image } from 'expo-image';
import Colors from '@/constants/colors';

interface AvatarProps {
    uri?: string;
    name?: string;
    size?: number;
    color?: string;
    style?: any;
    fontSize?: number;
}

export default function Avatar({
    uri,
    name = '?',
    size = 40,
    color = Colors.primary,
    style,
    fontSize
}: AvatarProps) {
    const isUrl = uri?.startsWith('http') || uri?.startsWith('data:');
    const backgroundColor = !isUrl && uri?.startsWith('#') ? uri : color;
    const initial = name.charAt(0).toUpperCase();
    const textSize = fontSize || Math.round(size * 0.4);

    return (
        <View style={[
            styles.container,
            { width: size, height: size, borderRadius: size / 2.5, backgroundColor },
            style
        ]}>
            {isUrl ? (
                <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="cover"
                />
            ) : (
                <Text style={[styles.text, { fontSize: textSize }]}>
                    {initial}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    text: {
        fontFamily: 'Outfit_700Bold',
        color: '#FFF',
    },
});
