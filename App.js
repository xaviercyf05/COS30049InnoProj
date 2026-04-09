import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Leaf, Lock, User, ShieldCheck } from 'lucide-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage'; // for store the token

// Ensure your CSS file name matches this import exactly
import { styles } from './SFC_Login_CSS'; 

export default function App() {
  // State for 'username' to match your database column
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Validation: Cannot leave fields empty
    if (!username.trim() || !password.trim()) {
      Alert.alert("Input Required", "Please enter both Username and Password.");
      return;
    }

    setLoading(true);

    try {
      // 2. Connect to your Express API on innopappserver.xyz
      const response = await fetch('https://api.innopappserver.xyz/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username, // Sends the typed username
          password: password, // Sends plain text to be compared with hash on backend
        }),
      });

      const data = await response.json();

      if (response.status === 200) {
        // Success: The backend verified the password_hash successfully
        await AsyncStorage.setItem("innopapp_admin_token", data.token)
        Alert.alert("Success", "Login Successful! Welcome to SFC.");
        console.log("Logged in:", data.user);
      } else {
        // Rejection: Invalid credentials or user not found
        Alert.alert("Login Failed", data.message || "Invalid username or password.");
      }
    } catch (error) {
      // Network Error: Server down or no internet
      Alert.alert("Connection Error", "Unable to reach the server. Please check your connection.");
      console.error(error);
    } finally {
      setLoading(false); // Stop the loading spinner
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />

      {/* Background Lottie Animation */}
      <LottieView
        source={require('./Grow_your_forest.json')} 
        autoPlay
        loop={true}
        style={styles.smoothTree}
        resizeMode="cover"
        speed={0.4}
        renderMode="HARDWARE_ACCELERATION"
      />

      {/* Dark Overlay for readability */}
      <View style={styles.vignetteOverlay} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header with Larger Logo */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Leaf color="#FFFFFF" size={60} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Sarawak Guide Training</Text>
          <Text style={styles.subtitle}>SFC Digital Platform</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.loginLabel}>Sign In</Text>
          
          <View style={styles.inputContainer}>
            <User color="#2D5A27" size={20} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Username or Staff ID"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock color="#2D5A27" size={20} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Dynamic Login Button */}
          <TouchableOpacity 
            style={[styles.loginButton, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>START TRAINING</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Security Badge */}
        <View style={styles.footer}>
          <View style={styles.securityBadge}>
            <ShieldCheck color="#FFF" size={14} />
            <Text style={styles.footerText}>Secure Access Active</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}