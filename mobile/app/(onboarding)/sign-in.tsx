import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth0 } from 'react-native-auth0';
import Colors from '@/constants/colors';
import { setAuthToken } from '@/lib/query-client';

const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
const AUTH0_SCOPE = process.env.EXPO_PUBLIC_AUTH0_SCOPE ?? 'openid profile email';
const AUTH0_CUSTOM_SCHEME = process.env.EXPO_PUBLIC_AUTH0_CUSTOM_SCHEME ?? 'flock';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const { authorize, isLoading: sdkLoading } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
  const auth0ClientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
  const isConfigured = !!(auth0Domain && auth0ClientId);

  const handleSignIn = async () => {
    if (!isConfigured || loading) return;
    setLoading(true);
    setError(null);
    // Haptic feedback when initiating sign-in
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const credentials = await authorize(
        {
          ...(AUTH0_AUDIENCE && { audience: AUTH0_AUDIENCE }),
          scope: AUTH0_SCOPE,
        },
        { customScheme: AUTH0_CUSTOM_SCHEME }
      );
      await setAuthToken(credentials.accessToken);
      router.replace('/(onboarding)/profile');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed. Try again.';
      setError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Sign-in failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.content}>
          <Ionicons name="warning-outline" size={48} color={Colors.warning} />
          <Text style={styles.title}>Auth not configured</Text>
          <Text style={styles.subtitle}>
            Create mobile/.env from .env.example and set EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID.
          </Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const busy = loading || sdkLoading;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Sign in with Google, or email. We'll use this to save your profile and match you with commuters.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={22} color={Colors.textInverse} />
              <Text style={styles.buttonText}>Continue with Google or Email</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.hint}>
          You'll open a secure sign-in page. Your password is never shared with Flock.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 28,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.error}14`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: Colors.error,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.textInverse,
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});