import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function SplashScreenComponent() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // Simulate app initialization (you can add actual initialization logic here)
    const initializeApp = async () => {
      try {
        // Add any initialization logic here (e.g., loading models, checking auth, etc.)
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        // Hide splash screen and navigate to chat
        await SplashScreen.hideAsync();
        router.replace('/chat');
      }
    };

    initializeApp();
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#000000'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

