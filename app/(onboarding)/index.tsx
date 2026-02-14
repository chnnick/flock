import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <LinearGradient
      colors={['#FF6B35', '#FF8F66', '#FAFAF7']}
      locations={[0, 0.4, 1]}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: topInset + 60 }]}>
        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={48} color={Colors.primary} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)}>
          <Text style={styles.title}>Flock</Text>
          <Text style={styles.subtitle}>
            Walk together.{'\n'}Ride together.{'\n'}Build community.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={styles.features}>
          <FeatureRow icon="walk-outline" text="Find walking buddies on your route" />
          <FeatureRow icon="train-outline" text="Match with transit riders nearby" />
          <FeatureRow icon="chatbubbles-outline" text="Chat and plan your commute" />
          <FeatureRow icon="shield-checkmark-outline" text="Safer commutes, real connections" />
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        style={[styles.bottomSection, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20) + 16 }]}
      >
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.push('/(onboarding)/profile')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.textInverse} />
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={22} color={Colors.secondary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 44,
    fontFamily: 'Outfit_700Bold',
    color: Colors.textInverse,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 30,
    marginBottom: 40,
  },
  features: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    color: Colors.text,
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  button: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
});
