import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

export default function IndexScreen() {
  const { isLoading, isOnboarded } = useApp();

  useEffect(() => {
    if (isLoading) return;

    if (isOnboarded) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(onboarding)');
    }
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
