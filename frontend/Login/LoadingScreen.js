import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { requestProfileApi } from '../Profile/profileApi.js';
import {
  clearAuthSession,
  getStoredAuthSession,
  persistAuthSession,
  refreshAuthSession,
} from './authSession.js';

export default function LoadingScreen({ navigation }) {
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const session = await getStoredAuthSession();
        let nextRoute = 'Login';

        if (!session.accessToken) {
          await clearAuthSession();
        } else if (!session.stayLoggedIn) {
          await clearAuthSession();
        } else {
          try {
            await requestProfileApi('/api/v1/user/profile', session.accessToken, {
              method: 'GET',
            });
            nextRoute = 'Home';
          } catch (error) {
            if (session.refreshToken) {
              const refreshed = await refreshAuthSession(session.refreshToken);
              await persistAuthSession({
                accessToken: refreshed.token,
                refreshToken: refreshed.refreshToken || session.refreshToken,
                role: session.role,
                username: session.username,
                userId: session.userId,
                stayLoggedIn: session.stayLoggedIn,
              });
              nextRoute = 'Home';
            } else {
              await clearAuthSession();
            }
          }
        }

        if (!active) return;

        navigation.reset({
          index: 0,
          routes: [{ name: nextRoute }],
        });
      } catch (error) {
        await clearAuthSession();
        if (!active) return;
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    };

    checkSession();

    return () => {
      active = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={styles.text}>Preparing your training portal...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F4D2E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
