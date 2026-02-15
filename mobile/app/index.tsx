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
        router.replace('/(onboarding)/sign-in' as Href);
        return;
      }

      if (isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)');
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
