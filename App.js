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

import AsyncStorage from '@react-native-async-storage/async-storage'; // for store the token
import { styles } from './SFC_Login_CSS'; 

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Input Required', 'Please enter both Username and Password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://api.innopappserver.xyz/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.status === 200) {
        await AsyncStorage.setItem('innopapp_admin_token', data.token);
        Alert.alert('Success', 'Login successful. Welcome to SFC.');
        console.log('Logged in:', data.user);
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid username or password.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Unable to reach the server. Please check your connection.');
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
                placeholder="Username or Staff ID"
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

            <Text style={styles.helperText}>Use your staff account to continue.</Text>
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