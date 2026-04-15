import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';

const SESSION_STORAGE_KEYS = [
  'innopapp_auth_token',
  'innopapp_auth_role',
  'innopapp_auth_username',
  'innopapp_auth_user_id',
];

export default function LoadingScreen({ navigation }) {
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('innopapp_auth_token');
        let nextRoute = 'Login';

        if (!token) {
          await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
        } else {
          try {
            await requestProfileApi('/api/v1/user/profile', token, {
              method: 'GET',
            });
            nextRoute = 'Home';
          } catch (error) {
            await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
          }
        }

        if (!active) return;

        navigation.reset({
          index: 0,
          routes: [{ name: nextRoute }],
        });
      } catch (error) {
        await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
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
