import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Href, router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { getAuthToken } from '@/lib/query-client';

export default function IndexScreen() {
  const { isLoading, isOnboarded } = useApp();

  useEffect(() => {
    const decide = async () => {
      if (isLoading) return;
  
      const token = await getAuthToken();
      if (!token) {
        // No token — show welcome page (which has "Get Started" → sign-in)
        router.replace('/(onboarding)');
        return;
      }
  
      if (isOnboarded) {
        router.replace('/(tabs)');
      } else {
        // Has token but no profile — go straight to profile setup
        router.replace('/(onboarding)/profile' as Href);
      }
    };
    decide();
  }, [isLoading, isOnboarded]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
