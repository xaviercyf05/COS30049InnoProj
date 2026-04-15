import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Leaf, Lock, ShieldCheck, User, Compass, PawPrint } from 'lucide-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { styles } from './LoginPageStyle'; 

export default function LoginPage({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const API_ORIGIN = 'https://api.innopappserver.xyz';

  const resolveWebProxyBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:3001`;
    }

    return 'http://localhost:3001';
  };

  const isLocalWebHost = () => {
    if (typeof window === 'undefined' || !window.location?.hostname) {
      return false;
    }

    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  };

  const getWebApiBaseUrls = () => {
    const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;
    const webProxyBaseUrl = resolveWebProxyBaseUrl();

    if (configuredProxy) {
      return [...new Set([configuredProxy, API_ORIGIN])];
    }

    // Local web dev usually hits CORS on direct API, so prefer local proxy only.
    if (isLocalWebHost()) {
      return [webProxyBaseUrl];
    }

    const baseUrls = [API_ORIGIN, webProxyBaseUrl];

    return [...new Set(baseUrls)];
  };

  const submitLoginRequest = (baseUrl) => {
    const normalizedIdentifier = username.trim();
    const numericUserId = /^\d+$/.test(normalizedIdentifier)
      ? Number.parseInt(normalizedIdentifier, 10)
      : undefined;

    return fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        username: normalizedIdentifier,
        userId: numericUserId,
        password,
      }),
    });
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Input Required', 'Please enter both Username/User ID and Password.');
      return;
    }

    setLoading(true);
    const attemptedUrls = [];

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          attemptedUrls.push(`${webBaseUrl}/api/v1/auth/login`);

          try {
            response = await submitLoginRequest(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Login request failed on web.');
        }
      } else {
        response = await submitLoginRequest(API_ORIGIN);
      }

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');
      const data = isJson
        ? await response.json()
        : { message: await response.text() };

      if (response.ok && data?.success && data?.data?.token) {
        await AsyncStorage.setItem('innopapp_auth_token', data.data.token);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        console.log('Logged in:', data.data.user);
      } else {
        const fallbackMessage = response.status >= 500
          ? 'Login service is temporarily unavailable. Please try again later.'
          : 'Invalid username or password.';

        Alert.alert('Login Failed', data?.message || fallbackMessage);
      }
    } catch (error) {
      const attemptedSuffix = attemptedUrls.length
        ? ` Tried: ${attemptedUrls.join(', ')}.`
        : '';

      const webMessage = Platform.OS === 'web'
        ? `Unable to reach login service from web.${attemptedSuffix} Try setting EXPO_PUBLIC_API_WEB_PROXY, or start the local proxy with: npm run proxy.`
        : 'Unable to reach the server. Please check your connection.';

      Alert.alert('Connection Error', webMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#071407" />

      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />
      <View style={styles.backgroundAccentLeft} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.pageShell}>
          <View style={styles.heroPanel}>
            <View style={styles.heroLogoWrap}>
              <View style={styles.logoCircle}>
                <Leaf color="#FFFFFF" size={60} strokeWidth={1.5} />
              </View>
            </View>
            <Text style={styles.title}>Sarawak Guide Training</Text>
            <Text style={styles.subtitle}>SFC Digital Platform</Text>
            <Text style={styles.description}>
              Sign in from your browser/mobile to access the training portal and staff tools.
            </Text>

            <View style={styles.featureRow}>
              <View style={styles.featurePill}>
                <Compass color="#DDF5D8" size={16} />
                <Text style={styles.featureText}>Park Guide Training</Text>
              </View>
              <View style={styles.featurePill}>
                <PawPrint color="#DDF5D8" size={16} />
                <Text style={styles.featureText}>Wildlife/Plant</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.loginLabel}>Sign In</Text>

            <View style={styles.inputContainer}>
              <User color="#2D5A27" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Username or User ID"
                placeholderTextColor="#7E8A7A"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={Platform.OS === 'web' ? 'username' : 'off'}
                textContentType="username"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock color="#2D5A27" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#7E8A7A"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoComplete={Platform.OS === 'web' ? 'current-password' : 'off'}
                textContentType="password"
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>START TRAINING</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>Use your user or admin account to continue.</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.securityBadge}>
              <ShieldCheck color="#FFF" size={14} />
              <Text style={styles.footerText}>Secure Access Active</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}