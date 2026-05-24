import React, { useEffect, useState } from 'react';
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
import { Leaf, Lock, ShieldCheck, User, Compass, PawPrint, Mail, KeyRound } from 'lucide-react-native';

import { styles } from './LoginPageStyle'; 
import { persistAuthSession } from './authSession.js';
import { createPasskey, getPasskey, supportsPasskeys } from '../auth/passkeyClient.js';

export default function LoginPage({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginMethod, setLoginMethod] = useState('password');
  const [showOtherLoginMethods, setShowOtherLoginMethods] = useState(false);
  const [emailCodeRequested, setEmailCodeRequested] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);
  const [emailCodeNotice, setEmailCodeNotice] = useState('');
  const [emailCodeMaskedEmail, setEmailCodeMaskedEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [passkeyMessage, setPasskeyMessage] = useState('');
  
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

  const submitEmailCodeRequest = (baseUrl) => {
    const normalizedIdentifier = username.trim();
    const numericUserId = /^\d+$/.test(normalizedIdentifier)
      ? Number.parseInt(normalizedIdentifier, 10)
      : undefined;

    return fetch(`${baseUrl}/api/v1/auth/login/email-code/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        username: normalizedIdentifier,
        email: normalizedIdentifier.includes('@') ? normalizedIdentifier : undefined,
        userId: numericUserId,
      }),
    });
  };

  const submitEmailCodeVerification = (baseUrl) => {
    const normalizedIdentifier = username.trim();
    const numericUserId = /^\d+$/.test(normalizedIdentifier)
      ? Number.parseInt(normalizedIdentifier, 10)
      : undefined;

    return fetch(`${baseUrl}/api/v1/auth/login/email-code/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        username: normalizedIdentifier,
        email: normalizedIdentifier.includes('@') ? normalizedIdentifier : undefined,
        userId: numericUserId,
        loginCode: emailCode.trim(),
        remember: !!stayLoggedIn,
      }),
    });
  };

  const submitRecoveryCodeLogin = (baseUrl) => {
    const normalizedIdentifier = username.trim();
    const numericUserId = /^\d+$/.test(normalizedIdentifier)
      ? Number.parseInt(normalizedIdentifier, 10)
      : undefined;

    return fetch(`${baseUrl}/api/v1/auth/login/recovery-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        username: normalizedIdentifier,
        userId: numericUserId,
        recoveryCode: recoveryCode.trim().toUpperCase(),
        remember: !!stayLoggedIn,
      }),
    });
  };

  const submitPasskeyOptionsRequest = (baseUrl) => {
    const normalizedIdentifier = username.trim();

    return fetch(`${baseUrl}/api/v1/auth/passkey/login/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier || undefined,
        username: normalizedIdentifier || undefined,
        email: normalizedIdentifier.includes('@') ? normalizedIdentifier : undefined,
        userId: /^\d+$/.test(normalizedIdentifier) ? Number.parseInt(normalizedIdentifier, 10) : undefined,
      }),
    });
  };

  const submitPasskeyVerification = (baseUrl, tempToken, credential) => {
    return fetch(`${baseUrl}/api/v1/auth/passkey/login/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tempToken,
        credential,
        remember: !!stayLoggedIn,
      }),
    });
  };

  const submitLoginMethodAvailabilityRequest = (baseUrl) => {
    const normalizedIdentifier = username.trim();
    const numericUserId = /^\d+$/.test(normalizedIdentifier)
      ? Number.parseInt(normalizedIdentifier, 10)
      : undefined;

    return fetch(`${baseUrl}/api/v1/auth/login/methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        username: normalizedIdentifier,
        email: normalizedIdentifier.includes('@') ? normalizedIdentifier : undefined,
        userId: numericUserId,
      }),
    });
  };

  const resetEmailCodeState = () => {
    setEmailCodeRequested(false);
    setEmailCode('');
    setEmailCodeNotice('');
    setEmailCodeMaskedEmail('');
  };

  const resetRecoveryCodeState = () => {
    setRecoveryCode('');
  };

  const resetPasskeyState = () => {
    setPasskeyLoading(false);
    setPasskeyMessage('');
  };

  const resolveLoginMethodLabel = (method) => {
    if (method === 'emailCode') {
      return 'Email code';
    }

    if (method === 'recoveryCode') {
      return 'Recovery code';
    }

    if (method === 'passkey') {
      return 'Passkey';
    }

    return 'This';
  };

  const checkLoginMethodAvailability = async (method) => {
    const normalizedIdentifier = username.trim();

    if (!normalizedIdentifier) {
      setErrorMessage('Please enter your username, email, or User ID first.');
      return null;
    }

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            response = await submitLoginMethodAvailabilityRequest(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Login method availability check failed on web.');
        }
      } else {
        response = await submitLoginMethodAvailabilityRequest(API_ORIGIN);
      }

      const data = await response.json();
      const methods = data?.data?.methods || {};
      const isEnabled = Boolean(methods?.[method]);

      if (!response.ok || !data?.success || !isEnabled) {
        throw new Error(data?.message || `${resolveLoginMethodLabel(method)} sign-in is not enabled for this account.`);
      }

      return methods;
    } catch (error) {
      const fallbackMessage = `${resolveLoginMethodLabel(method)} sign-in is not enabled for this account.`;
      setErrorMessage(error?.message || fallbackMessage);
      return null;
    }
  };

  const switchLoginMethod = (nextMethod) => {
    setLoginMethod(nextMethod);
    setShowOtherLoginMethods(nextMethod !== 'password');
    setErrorMessage('');
    setLoading(false);
    setEmailCodeLoading(false);
    setPasskeyLoading(false);
    setMFARequired(false);
    resetEmailCodeState();
    resetRecoveryCodeState();
    setPasskeyMessage('');
  };

  const handleSelectLoginMethod = async (nextMethod) => {
    if (nextMethod === 'password') {
      handleReturnToPasswordLogin();
      return;
    }

    const methods = await checkLoginMethodAvailability(nextMethod);

    if (!methods) {
      return;
    }

    switchLoginMethod(nextMethod);
  };

  useEffect(() => {
    setPasskeySupported(supportsPasskeys());
  }, []);

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

  const handleRequestEmailCode = async () => {
    const methods = await checkLoginMethodAvailability('emailCode');

    if (!methods) {
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Please enter your username, email, or user ID.');
      return;
    }

    setErrorMessage('');
    setEmailCodeNotice('');
    setEmailCodeLoading(true);

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            response = await submitEmailCodeRequest(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Email code request failed on web.');
        }
      } else {
        response = await submitEmailCodeRequest(API_ORIGIN);
      }

      const data = await response.json();

      if (response.ok && data?.success && data?.data?.codeSent) {
        setEmailCodeRequested(true);
        setEmailCode('');
        setEmailCodeMaskedEmail(data.data.maskedEmail || 'your email address');
        setEmailCodeNotice(
          data.data.maskedEmail
            ? `A sign-in code was sent to ${data.data.maskedEmail}.`
            : 'A sign-in code was sent to your email address.'
        );
      } else if (response.ok && data?.success) {
        setEmailCodeRequested(false);
        setEmailCodeNotice(data?.message || 'If an active account matches that identifier, a sign-in code has been sent.');
      } else {
        setErrorMessage(data?.message || 'Unable to send sign-in code. Please try again later.');
      }
    } catch (error) {
      const webMessage = Platform.OS === 'web'
        ? 'Unable to reach the sign-in code service from web. If needed, set EXPO_PUBLIC_API_WEB_PROXY to your backend proxy URL.'
        : 'Unable to reach the server. Please check your connection.';

      setErrorMessage(webMessage);
      console.error(error);
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    const methods = await checkLoginMethodAvailability('emailCode');

    if (!methods) {
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Please enter your username, email, or user ID.');
      return;
    }

    if (!emailCode.trim()) {
      setErrorMessage('Please enter the sign-in code from your email.');
      return;
    }

    if (emailCode.trim().length < 6) {
      setErrorMessage('Sign-in code must be at least 6 characters.');
      return;
    }

    setErrorMessage('');
    setEmailCodeLoading(true);

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            response = await submitEmailCodeVerification(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Email code verification failed on web.');
        }
      } else {
        response = await submitEmailCodeVerification(API_ORIGIN);
      }

      const data = await response.json();

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

        resetEmailCodeState();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setErrorMessage(data?.message || 'Invalid or expired sign-in code.');
      }
    } catch (error) {
      const webMessage = Platform.OS === 'web'
        ? 'Unable to verify the sign-in code from web. If needed, set EXPO_PUBLIC_API_WEB_PROXY to your backend proxy URL.'
        : 'Unable to verify the sign-in code. Please check your connection.';

      setErrorMessage(webMessage);
      console.error(error);
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const handleRecoveryCodeLogin = async () => {
    const methods = await checkLoginMethodAvailability('recoveryCode');

    if (!methods) {
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Please enter your username or user ID.');
      return;
    }

    if (!recoveryCode.trim()) {
      setErrorMessage('Please enter your recovery code.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            response = await submitRecoveryCodeLogin(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Recovery code login failed on web.');
        }
      } else {
        response = await submitRecoveryCodeLogin(API_ORIGIN);
      }

      const data = await response.json();

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

        resetRecoveryCodeState();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setErrorMessage(data?.message || 'Invalid or already used recovery code.');
      }
    } catch (error) {
      const webMessage = Platform.OS === 'web'
        ? 'Unable to verify the recovery code from web. If needed, set EXPO_PUBLIC_API_WEB_PROXY to your backend proxy URL.'
        : 'Unable to verify the recovery code. Please check your connection.';

      setErrorMessage(webMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmailCode = () => {
    resetEmailCodeState();
    setEmailCodeLoading(false);
    setErrorMessage('');
    setShowOtherLoginMethods(false);
    setLoginMethod('password');
  };

  const handleReturnToPasswordLogin = () => {
    resetEmailCodeState();
    resetRecoveryCodeState();
    resetPasskeyState();
    setEmailCodeLoading(false);
    setPasskeyLoading(false);
    setErrorMessage('');
    setShowOtherLoginMethods(false);
    setLoginMethod('password');
  };

  const handlePasskeyLogin = async () => {
    const methods = await checkLoginMethodAvailability('passkey');

    if (!methods) {
      return;
    }

    if (!passkeySupported) {
      setErrorMessage('Passkeys are not supported on this device or browser.');
      return;
    }

    setErrorMessage('');
    setPasskeyMessage('');
    setPasskeyLoading(true);

    try {
      let response;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            response = await submitPasskeyOptionsRequest(webBaseUrl);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!response) {
          throw lastWebError || new Error('Passkey login request failed on web.');
        }
      } else {
        response = await submitPasskeyOptionsRequest(API_ORIGIN);
      }

      const data = await response.json();

      if (!response.ok || !data?.success || !data?.data?.options || !data?.data?.tempToken) {
        throw new Error(data?.message || 'Unable to start passkey sign-in.');
      }

      const credential = await getPasskey(data.data.options);

      let verifyResponse;

      if (Platform.OS === 'web') {
        let lastWebError = null;

        for (const webBaseUrl of getWebApiBaseUrls()) {
          try {
            verifyResponse = await submitPasskeyVerification(webBaseUrl, data.data.tempToken, credential);
            lastWebError = null;
            break;
          } catch (error) {
            lastWebError = error;
          }
        }

        if (!verifyResponse) {
          throw lastWebError || new Error('Passkey verification failed on web.');
        }
      } else {
        verifyResponse = await submitPasskeyVerification(API_ORIGIN, data.data.tempToken, credential);
      }

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok && verifyData?.success && verifyData?.data?.token) {
        const resolvedRole = verifyData?.data?.user?.role || '';
        const resolvedUserId = verifyData?.data?.user?.userId;
        const resolvedUsername = verifyData?.data?.user?.username || '';

        await persistAuthSession({
          accessToken: verifyData.data.token,
          refreshToken: verifyData.data.refreshToken || '',
          role: resolvedRole,
          username: resolvedUsername,
          userId: resolvedUserId,
          stayLoggedIn,
        });

        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setPasskeyMessage(verifyData?.message || 'Passkey sign-in failed.');
      }
    } catch (error) {
      const webMessage = Platform.OS === 'web'
        ? 'Unable to complete passkey sign-in from web. If needed, set EXPO_PUBLIC_API_WEB_PROXY to your backend proxy URL.'
        : 'Unable to complete passkey sign-in. Please check your device and try again.';

      setErrorMessage(webMessage);
      console.error(error);
    } finally {
      setPasskeyLoading(false);
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
                ) : (
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
                )}

                {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}

                <TouchableOpacity
                  style={[styles.loginButton, mfaLoading && styles.loginButtonDisabled]}
                  onPress={handleMFAVerification}
                  disabled={mfaLoading}
                  activeOpacity={0.85}
                >
                  {mfaLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>VERIFY</Text>}
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
                {loginMethod === 'password' ? (
                  <>
                    <Text style={styles.loginLabel}>Sign In</Text>
                    <Text style={styles.methodDescription}>Use your password to sign in.</Text>

                    <View style={styles.inputContainer}>
                      <User color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Username, email, or User ID"
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

                    <TouchableOpacity
                      onPress={() => setShowOtherLoginMethods((previous) => !previous)}
                      activeOpacity={0.8}
                      style={styles.otherMethodsDisclosure}
                    >
                      <Text style={styles.otherMethodsDisclosureText}>Login with other methods</Text>
                    </TouchableOpacity>

                    {showOtherLoginMethods ? (
                      <View style={styles.otherMethodsPanel}>
                        <TouchableOpacity
                          style={styles.otherMethodButton}
                          onPress={() => handleSelectLoginMethod('emailCode')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.otherMethodButtonText}>Email code</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.otherMethodButton}
                          onPress={() => handleSelectLoginMethod('recoveryCode')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.otherMethodButtonText}>Recovery code</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.otherMethodButton}
                          onPress={() => handleSelectLoginMethod('passkey')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.otherMethodButtonText}>Passkey</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}
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
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>START TRAINING</Text>}
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
                ) : loginMethod === 'recoveryCode' ? (
                  <>
                    <Text style={styles.loginLabel}>Recovery Code Sign-In</Text>
                    <Text style={styles.methodDescription}>Use one of your backup recovery codes to sign in without email or an authenticator prompt.</Text>

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
                      <KeyRound color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Recovery code"
                        placeholderTextColor="#7E8A7A"
                        value={recoveryCode}
                        onChangeText={(text) => {
                          setRecoveryCode(text.toUpperCase());
                          if (errorMessage) {
                            setErrorMessage('');
                          }
                        }}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!loading}
                      />
                    </View>

                    {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}

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
                      onPress={handleRecoveryCodeLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>SIGN IN</Text>}
                    </TouchableOpacity>

                    <Text style={styles.helperText}>Enter one of the backup recovery codes generated when MFA was enabled.</Text>

                    <TouchableOpacity
                      onPress={handleReturnToPasswordLogin}
                      activeOpacity={0.8}
                      style={styles.registerLinkWrap}
                    >
                      <Text style={styles.registerLinkText}>Use password instead</Text>
                    </TouchableOpacity>
                  </>
                ) : loginMethod === 'passkey' ? (
                  <>
                    <Text style={styles.loginLabel}>Passkey Sign-In</Text>
                    <Text style={styles.methodDescription}>
                      Use a saved passkey on this device or browser to sign in without a password.
                    </Text>

                    <View style={styles.inputContainer}>
                      <User color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Optional username or user ID"
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

                    {!!passkeyMessage && <Text style={styles.codeNoticeText}>{passkeyMessage}</Text>}
                    {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}

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
                      style={[styles.loginButton, passkeyLoading && styles.loginButtonDisabled]}
                      onPress={handlePasskeyLogin}
                      disabled={passkeyLoading}
                      activeOpacity={0.85}
                    >
                      {passkeyLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>USE PASSKEY</Text>}
                    </TouchableOpacity>

                    <Text style={styles.helperText}>
                      If your account has no passkey yet, sign in with another method first and register one from Security.
                    </Text>

                    <TouchableOpacity
                      onPress={handleReturnToPasswordLogin}
                      activeOpacity={0.8}
                      style={styles.registerLinkWrap}
                    >
                      <Text style={styles.registerLinkText}>Use password instead</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.loginLabel}>Email Sign-In Code</Text>
                    <Text style={styles.methodDescription}>We will send a one-time sign-in code to the email on your account.</Text>

                    <View style={styles.inputContainer}>
                      <Mail color="#2D5A27" size={20} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Username, email, or User ID"
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

                    {emailCodeNotice ? <Text style={styles.codeNoticeText}>{emailCodeNotice}</Text> : null}
                    {emailCodeRequested && emailCodeMaskedEmail ? (
                      <Text style={styles.helperText}>Check {emailCodeMaskedEmail} for the code.</Text>
                    ) : null}

                    {emailCodeRequested ? (
                      <>
                        <View style={styles.inputContainer}>
                          <KeyRound color="#2D5A27" size={20} style={styles.icon} />
                          <TextInput
                            style={styles.input}
                            placeholder="6-digit sign-in code"
                            placeholderTextColor="#7E8A7A"
                            value={emailCode}
                            onChangeText={(text) => {
                              setEmailCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                              if (errorMessage) {
                                setErrorMessage('');
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            editable={!emailCodeLoading}
                          />
                        </View>

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

                        {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}

                        <TouchableOpacity
                          style={[styles.loginButton, emailCodeLoading && styles.loginButtonDisabled]}
                          onPress={handleVerifyEmailCode}
                          disabled={emailCodeLoading}
                          activeOpacity={0.85}
                        >
                          {emailCodeLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>VERIFY CODE</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={handleRequestEmailCode}
                          disabled={emailCodeLoading}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.secondaryButtonText}>Resend code</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        {!!errorMessage && <Text style={styles.inlineErrorText}>{errorMessage}</Text>}

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
                          style={[styles.loginButton, emailCodeLoading && styles.loginButtonDisabled]}
                          onPress={handleRequestEmailCode}
                          disabled={emailCodeLoading}
                          activeOpacity={0.85}
                        >
                          {emailCodeLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>SEND CODE</Text>}
                        </TouchableOpacity>
                      </>
                    )}

                    <TouchableOpacity
                      onPress={handleCancelEmailCode}
                      activeOpacity={0.8}
                      style={styles.registerLinkWrap}
                    >
                      <Text style={styles.registerLinkText}>Use password instead</Text>
                    </TouchableOpacity>
                  </>
                )}
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