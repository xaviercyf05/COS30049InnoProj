import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Leaf, Lock, ShieldCheck, User, Compass, PawPrint } from 'lucide-react-native';

import { styles } from './LoginPageStyle'; 
import { persistAuthSession } from './authSession.js';

export default function LoginPage({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // MFA states
  const [mfaRequired, setMFARequired] = useState(false);
  const [mfaTempToken, setMFATempToken] = useState('');
  const [mfaCode, setMFACode] = useState('');
  const [mfaRecoveryCode, setMFARecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaLoading, setMFALoading] = useState(false);
  const [mfaUserId, setMFAUserId] = useState(null);
  const [mfaUser, setMFAUser] = useState(null);

  const API_ORIGIN = 'https://api.innopappserver.xyz';

  const getWebApiBaseUrls = () => {
    const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;

    if (configuredProxy) {
      return [...new Set([configuredProxy, API_ORIGIN])];
    }

    return [API_ORIGIN];
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
        remember: !!stayLoggedIn,
      }),
    });
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both Username/User ID and Password.');
      return;
    }

    setErrorMessage('');
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
        const resolvedRole = data?.data?.user?.role || '';
        const resolvedUserId = data?.data?.user?.userId;
        const resolvedUsername = data?.data?.user?.username || '';

        await persistAuthSession({
          accessToken: data.data.token,
          refreshToken: data.data.refreshToken || '',
          role: resolvedRole,
          username: resolvedUsername,
          userId: resolvedUserId,
          stayLoggedIn,
        });
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        console.log('Logged in:', data.data.user);
      } else if (response.ok && data?.success && data?.mfaRequired) {
        // MFA is required
        setMFATempToken(data.data.tempToken);
        setMFAUserId(data.data.userId);
        setMFAUser(data.data.user);
        setMFARequired(true);
        setErrorMessage('');
      } else {
        const fallbackMessage = response.status >= 500
          ? 'Login service is temporarily unavailable. Please try again later.'
          : 'Invalid username or password.';

        setErrorMessage(data?.message || fallbackMessage);
      }
    } catch (error) {
      const attemptedSuffix = attemptedUrls.length
        ? ` Tried: ${attemptedUrls.join(', ')}.`
        : '';

      const webMessage = Platform.OS === 'web'
        ? `Unable to reach login service from web.${attemptedSuffix} If needed, set EXPO_PUBLIC_API_WEB_PROXY to your backend proxy URL.`
        : 'Unable to reach the server. Please check your connection.';

      setErrorMessage(webMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerification = async () => {
    if (useRecoveryCode && !mfaRecoveryCode.trim()) {
      setErrorMessage('Please enter your recovery code.');
      return;
    }

    if (!useRecoveryCode && !mfaCode.trim()) {
      setErrorMessage('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    if (!useRecoveryCode && mfaCode.length !== 6) {
      setErrorMessage('Code must be exactly 6 digits.');
      return;
    }

    setMFALoading(true);
    setErrorMessage('');

    try {
      const verifyResponse = await fetch(`${API_ORIGIN}/api/v1/auth/mfa/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: mfaUserId,
          token: useRecoveryCode ? undefined : mfaCode,
          recoveryCode: useRecoveryCode ? mfaRecoveryCode.toUpperCase() : undefined,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok && verifyData?.success) {
        // MFA verified successfully, now complete login
        const completeResponse = await fetch(`${API_ORIGIN}/api/v1/auth/mfa/complete-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tempToken: mfaTempToken,
            remember: stayLoggedIn,
          }),
        });

        const completeData = await completeResponse.json();

        if (completeResponse.ok && completeData?.success && completeData?.data?.token) {
          const resolvedRole = completeData.data.user?.role || '';
          const resolvedUserId = completeData.data.user?.userId;
          const resolvedUsername = completeData.data.user?.username || '';

          await persistAuthSession({
            accessToken: completeData.data.token,
            refreshToken: completeData.data.refreshToken || '',
            role: resolvedRole,
            username: resolvedUsername,
            userId: resolvedUserId,
            stayLoggedIn,
          });

          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
          console.log('Logged in after MFA:', completeData.data.user);
        } else {
          setErrorMessage(completeData?.message || 'Failed to complete login after MFA verification.');
        }
      } else {
        setErrorMessage(verifyData?.message || 'MFA verification failed. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Unable to verify MFA code. Please check your connection.');
      console.error(error);
    } finally {
      setMFALoading(false);
    }
  };

  const handleCancelMFA = () => {
    setMFARequired(false);
    setMFATempToken('');
    setMFACode('');
    setMFARecoveryCode('');
    setUseRecoveryCode(false);
    setMFAUserId(null);
    setMFAUser(null);
    setErrorMessage('');
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
            {mfaRequired ? (
              <>
                <Text style={styles.loginLabel}>Two-Factor Authentication</Text>
                <Text style={styles.mfaDescription}>
                  Verify your identity to continue. Enter the 6-digit code from your authenticator app or use a recovery code.
                </Text>

                {!useRecoveryCode ? (
                  <>
                    <View style={styles.inputContainer}>
                      <ShieldCheck color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="6-digit code"
                        placeholderTextColor="#7E8A7A"
                        value={mfaCode}
                        onChangeText={(text) => {
                          setMFACode(text.replace(/[^0-9]/g, '').slice(0, 6));
                          if (errorMessage) setErrorMessage('');
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!mfaLoading}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Lock color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Recovery code (e.g., XXXX-XXXX)"
                        placeholderTextColor="#7E8A7A"
                        value={mfaRecoveryCode}
                        onChangeText={(text) => {
                          setMFARecoveryCode(text.toUpperCase());
                          if (errorMessage) setErrorMessage('');
                        }}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!mfaLoading}
                      />
                    </View>
                  </>
                )}

                {!!errorMessage && (
                  <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                )}

                <TouchableOpacity
                  style={[styles.loginButton, mfaLoading && styles.loginButtonDisabled]}
                  onPress={handleMFAVerification}
                  disabled={mfaLoading}
                  activeOpacity={0.85}
                >
                  {mfaLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>VERIFY</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setUseRecoveryCode(!useRecoveryCode)}
                  activeOpacity={0.8}
                  style={styles.registerLinkWrap}
                >
                  <Text style={styles.registerLinkText}>
                    {useRecoveryCode ? 'Use authenticator app' : 'Use recovery code instead'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCancelMFA}
                  activeOpacity={0.8}
                  style={styles.registerLinkWrap}
                >
                  <Text style={[styles.registerLinkText, { color: '#E85D5D' }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.loginLabel}>Sign In</Text>

                <View style={styles.inputContainer}>
                  <User color="#2D5A27" size={20} style={styles.icon} />
                  <TextInput
                    style={styles.input}
                placeholder="Username or User ID"
                placeholderTextColor="#7E8A7A"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);

                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
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
                onChangeText={(text) => {
                  setPassword(text);

                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                autoComplete={Platform.OS === 'web' ? 'current-password' : 'off'}
                textContentType="password"
              />
            </View>

            {!!errorMessage && (
              <Text style={styles.inlineErrorText}>{errorMessage}</Text>
            )}
            <View style={styles.rememberContainer}>
              <Switch
                value={stayLoggedIn}
                onValueChange={setStayLoggedIn}
                trackColor={{ false: '#C9D3C5', true: '#2E6B4D' }}
                thumbColor="#FFFFFF"
              />
              <View style={styles.rememberLabelWrap}>
                <Text style={styles.rememberLabel}>Stay logged in</Text>
                <Text style={styles.rememberHint}>Keep me signed in on this device for 7 days.</Text>
              </View>
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

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.8}
              style={styles.registerLinkWrap}
            >
              <Text style={styles.registerLinkText}>Forgot password?</Text>
            </TouchableOpacity>

            <Text style={styles.helperText}>Use your user or admin account to continue.</Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
              style={styles.registerLinkWrap}
            >
              <Text style={styles.registerLinkText}>No account yet? Register here</Text>
            </TouchableOpacity>
              </>
            )}
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