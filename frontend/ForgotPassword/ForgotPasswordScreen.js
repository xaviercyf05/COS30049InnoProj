import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react-native';

import { styles as loginStyles } from '../Login/LoginPageStyle.js';
import { API_ORIGIN, getApiBaseUrls } from '../Profile/profileApi.js';

function getRequestBaseUrls() {
  if (Platform.OS === 'web') {
    return getApiBaseUrls();
  }

  return [API_ORIGIN];
}

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const submitForgotPasswordRequest = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage('Please enter the email address linked to your account.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      let response = null;
      let lastError = null;

      for (const baseUrl of getRequestBaseUrls()) {
        try {
          response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: normalizedEmail }),
          });
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!response) {
        throw lastError || new Error('Unable to start password reset request.');
      }

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');
      const payload = isJson ? await response.json() : { message: await response.text() };

      if (response.ok) {
        setStatusMessage(
          payload?.message ||
            'If an account with that email exists, a password reset link has been sent.'
        );
        return;
      }

      setErrorMessage(payload?.message || 'Unable to process the password reset request.');
    } catch (error) {
      setErrorMessage('Unable to reach the server. Please try again later.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={loginStyles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#071407" />

      <View style={loginStyles.backgroundGlowTop} />
      <View style={loginStyles.backgroundGlowBottom} />
      <View style={loginStyles.backgroundAccentLeft} />

      <ScrollView contentContainerStyle={loginStyles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={loginStyles.pageShell}>
          <View style={loginStyles.heroPanel}>
            <Text style={loginStyles.title}>Reset Access</Text>
            <Text style={loginStyles.subtitle}>Forgot your password?</Text>
            <Text style={loginStyles.description}>
              Enter the email address on your account and we will send you a secure reset link.
            </Text>
          </View>

          <View style={loginStyles.card}>
            <Text style={loginStyles.loginLabel}>Forgot Password</Text>

            <View style={loginStyles.inputContainer}>
              <Mail color="#2D5A27" size={20} style={loginStyles.icon} />
              <TextInput
                style={loginStyles.input}
                placeholder="Email address"
                placeholderTextColor="#7E8A7A"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                  if (statusMessage) {
                    setStatusMessage('');
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={Platform.OS === 'web' ? 'email' : 'off'}
                textContentType="emailAddress"
              />
            </View>

            {!!errorMessage && <Text style={loginStyles.inlineErrorText}>{errorMessage}</Text>}
            {!!statusMessage && <Text style={loginStyles.helperText}>{statusMessage}</Text>}

            <TouchableOpacity
              style={[loginStyles.loginButton, loading && loginStyles.loginButtonDisabled]}
              onPress={submitForgotPasswordRequest}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={loginStyles.loginButtonText}>SEND RESET LINK</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
              style={{ marginTop: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}
            >
              <ArrowLeft color="#2D5A27" size={16} />
              <Text style={loginStyles.registerLinkText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>

          <View style={loginStyles.footer}>
            <View style={loginStyles.securityBadge}>
              <ShieldCheck color="#FFF" size={14} />
              <Text style={loginStyles.footerText}>Password reset requests are verified by email</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
