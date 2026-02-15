import React, { useEffect, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Pressable, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    withSpring,
    withTiming,
    useSharedValue,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    // Track the layout of each tab
    const [tabLayouts, setTabLayouts] = useState<{ x: number, width: number }[]>([]);
    const [containerWidth, setContainerWidth] = useState(0);

    // Shared values for the sliding indicator
    const indicatorPosition = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);

    useEffect(() => {
        // Update indicator when active index changes or layouts are ready
        const activeLayout = tabLayouts[state.index];
        if (activeLayout) {
            // Snappy and precise: higher stiffness, overdamped to prevent overshoot
            indicatorPosition.value = withSpring(activeLayout.x, { damping: 50, stiffness: 500 });
            indicatorWidth.value = withSpring(activeLayout.width, { damping: 50, stiffness: 500 });
        }
    }, [state.index, tabLayouts]);

    const handleLayout = (event: LayoutChangeEvent, index: number) => {
        const { x, width } = event.nativeEvent.layout;
        setTabLayouts((prev) => {
            const newLayouts = [...prev];
            newLayouts[index] = { x, width };
            return newLayouts;
        });
    };

    const animatedIndicatorStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: indicatorPosition.value }],
            width: indicatorWidth.value,
            opacity: indicatorWidth.value > 0 ? 1 : 0, // Hide until measured
        };
    });

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>
            <BlurView
                intensity={80}
                tint="light"
                style={styles.blurContainer}
            >
                {/* Sliding Indicator Background */}
                <Animated.View style={[styles.slidingIndicator, animatedIndicatorStyle]} />

                <View style={styles.tabRow}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, route.params);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                        };

                        return (
                            <TabItem
                                key={route.key}
                                isFocused={isFocused}
                                options={options}
                                onPress={onPress}
                                onLayout={(e) => handleLayout(e, index)}
                            />
                        );
                    })}
                </View>
            </BlurView>
        </View>
    );
}

function TabItem({
    isFocused,
    options,
    onPress,
    onLayout
}: {
    isFocused: boolean;
    options: any;
    onPress: () => void;
    onLayout: (e: LayoutChangeEvent) => void;
}) {
    const scale = useSharedValue(1);

    const animatedIconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.1 : 1, { damping: 10 });
    }, [isFocused]);

    const handlePressIn = () => {
        scale.value = withSpring(0.9);
    };

    const handlePressOut = () => {
        scale.value = withSpring(isFocused ? 1.1 : 1);
        onPress();
    };

    const Icon = options.tabBarIcon;

    return (
        <AnimatedPressable
            onLayout={onLayout}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.tabItem}
            hitSlop={10}
        >
            <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
                {Icon && <Icon color={isFocused ? Colors.primary : Colors.textTertiary} focused={isFocused} size={24} />}
            </Animated.View>
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
    },
    blurContainer: {
        width: '90%',
        maxWidth: 400,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
        backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center', // Center content vertically
    },
    tabRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        height: '100%',
    },
    tabItem: {
        flex: 1, // Distribute space evenly
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    iconContainer: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    slidingIndicator: {
        position: 'absolute',
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(227, 83, 54, 0.15)', // Using Terracotta with low opacity
        top: 10, // (70 - 50) / 2
        left: 0,
    },
});
