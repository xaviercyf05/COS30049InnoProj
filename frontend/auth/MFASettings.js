import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  Keyboard,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, Shield, Lock, RefreshCw, Copy, Eye, EyeOff } from 'lucide-react-native';

const MFASettings = ({ token, userId, onMFAStatusChange }) => {
  const [mfaStatus, setMFAStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState(null); // null | 'initiate' | 'confirm'
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [error, setError] = useState('');
  const [apiOrigin] = useState('https://api.innopappserver.xyz');
  const [copiedCode, setCopiedCode] = useState(null);
  const [authToken, setAuthToken] = useState(token || '');

  const API_ORIGIN = apiOrigin;
  const effectiveToken = authToken || token || '';

  useEffect(() => {
    let isMounted = true;

    const loadSessionToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('auth_token');

        if (isMounted) {
          setAuthToken(storedToken || token || '');

          if (!storedToken && !token) {
            setError('Please sign in again to manage MFA settings.');
            setLoading(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          setError('Unable to load your session.');
          setLoading(false);
        }
      }
    };

    void loadSessionToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!effectiveToken) {
      return;
    }

    void fetchMFAStatus();
  }, [effectiveToken]);

  const fetchMFAStatus = async () => {
    try {
      if (!effectiveToken) {
        setError('Please sign in again to manage MFA settings.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/status`, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
        },
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        setMFAStatus(data.data);
        setError('');
      } else {
        setError(data?.message || 'Failed to fetch MFA status');
      }
    } catch (err) {
      setError('Unable to fetch MFA status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateMFA = async () => {
    try {
      if (!effectiveToken) {
        setError('Please sign in again to manage MFA settings.');
        return;
      }

      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/setup/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
        },
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        setSetupData(data.data);
        setSetupStep('confirm');
        setError('');
      } else {
        setError(data?.message || 'Failed to initiate MFA setup');
      }
    } catch (err) {
      setError('Unable to initiate MFA setup');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMFA = async () => {
    const normalizedVerificationCode = verificationCode.trim().replace(/\s+/g, '');

    if (!normalizedVerificationCode) {
      setError('Please enter the 6-digit code');
      return;
    }

    if (!/^[0-9]{6}$/.test(normalizedVerificationCode)) {
      setError('Code must be exactly 6 digits');
      return;
    }

    try {
      if (!effectiveToken) {
        setError('Please sign in again to manage MFA settings.');
        return;
      }

      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/setup/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: setupData.secret,
          token: normalizedVerificationCode,
          recoveryCodes: setupData.recoveryCodes,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        setSetupStep(null);
        setVerificationCode('');
        setSetupData(null);
        await fetchMFAStatus();
        if (onMFAStatusChange) onMFAStatusChange(true);
        Alert.alert('Success', 'Multi-Factor Authentication has been enabled. Save your recovery codes in a safe place!');
      } else {
        setError(data?.message || 'Failed to confirm MFA setup');
      }
    } catch (err) {
      setError('Unable to confirm MFA setup');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

const handleDisableMFA = async () => {
  Keyboard.dismiss();

  const pwd = (disablePassword || '').trim();
  if (!pwd) {
    setError('Please enter your password to disable MFA');
    return;
  }

  const doDisable = async () => {
    console.log('Disable confirmed: starting request', { pwdPresent: !!pwd });
    try {
      if (!effectiveToken) {
        setError('Please sign in again to manage MFA settings.');
        console.warn('Disable aborted: missing effectiveToken');
        return;
      }

      console.log('Disable request payload', { passwordLength: pwd.length });
      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: pwd }),
      });

      console.log('Disable fetch completed, status=', response.status);
      const data = await response.json();
      console.log('Disable response body', data);

      if (response.ok && data?.success) {
        setDisablePassword('');
        setError('');
        await fetchMFAStatus();
        if (onMFAStatusChange) onMFAStatusChange(false);
        Alert.alert('Success', 'MFA has been disabled');
      } else {
        setError(data?.message || 'Failed to disable MFA');
      }
    } catch (err) {
      setError('Unable to disable MFA');
      console.error('Disable error', err);
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const confirmed = window.confirm('Are you sure you want to disable two-factor authentication? Your account will be less secure.');
    if (confirmed) await doDisable();
  } else {
    Alert.alert(
      'Disable MFA?',
      'Are you sure you want to disable two-factor authentication? Your account will be less secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: doDisable },
      ]
    );
  }
};

  const handleRegenerateRecoveryCodes = async () => {
    Keyboard.dismiss();

    const pwd = (disablePassword || '').trim();
    if (!pwd) {
      setError('Please enter your password to regenerate recovery codes');
      return;
    }

    try {
      if (!effectiveToken) {
        setError('Please sign in again to manage MFA settings.');
        return;
      }

      setLoading(true);
      console.log('Regenerate recovery codes: sending request', { pwdPresent: !!pwd });
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/recovery-codes/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: pwd }),
      });

      console.log('Regenerate fetch completed, status=', response.status);
      const data = await response.json();
      console.log('Regenerate response body', data);

      if (response.ok && data?.success) {
        setSetupData({ ...setupData, recoveryCodes: data.data.recoveryCodes });
        setShowRecoveryCodes(true);
        setDisablePassword('');
        await fetchMFAStatus();
        Alert.alert('Success', 'New recovery codes have been generated');
      } else {
        setError(data?.message || 'Failed to regenerate recovery codes');
      }
    } catch (err) {
      setError('Unable to regenerate recovery codes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, code) => {
    // Note: In a real implementation, you would use a clipboard library like @react-native-clipboard/clipboard
    // For now, we'll just show a visual feedback
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading && !setupStep) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E6B4D" />
      </View>
    );
  }

  if (setupStep === 'confirm' && setupData) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Set Up Two-Factor Authentication</Text>
          <Text style={styles.setupDescription}>
            Scan this QR code with an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
          </Text>

          <View style={styles.qrContainer}>
            <Image
              source={{ uri: setupData.qrCode }}
              style={styles.qrCode}
              resizeMode="contain"
            />
          </View>

          <View style={styles.manualEntryContainer}>
            <Text style={styles.manualEntryLabel}>Or enter this code manually:</Text>
            <Text style={styles.secretCode}>{setupData.secret}</Text>
          </View>

          <View style={styles.verificationContainer}>
            <Text style={styles.verificationLabel}>Enter the 6-digit code from your app:</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.verificationInput}
                value={verificationCode}
                onChangeText={(text) => {
                  setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                  if (error) {
                    setError('');
                  }
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor="#9AA79C"
                autoComplete="off"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleConfirmMFA}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Confirm & Enable MFA</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setSetupStep(null);
              setVerificationCode('');
              setSetupData(null);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.recoveryCodesContainer}>
            <Text style={styles.recoveryCodesTitle}>Recovery Codes</Text>
            <Text style={styles.recoveryCodesDescription}>
              Save these codes in a safe place. You can use them to regain access if you lose your authenticator.
            </Text>
            <View style={styles.codesList}>
              {setupData.recoveryCodes.map((code, index) => (
                <View key={index} style={styles.codeItem}>
                  <Text style={styles.codeText}>{code}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerContainer}>
          <Shield color="#2E6B4D" size={28} />
          <Text style={styles.sectionTitle}>Security</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Two-Factor Authentication</Text>
          <Text style={[
            styles.statusValue,
            mfaStatus?.enabled ? styles.statusEnabled : styles.statusDisabled
          ]}>
            {mfaStatus?.enabled ? '🔒 Enabled' : '🔓 Disabled'}
          </Text>

          {mfaStatus?.enabled && (
            <Text style={styles.statusInfo}>
              Enabled since {new Date(mfaStatus?.setupAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {!mfaStatus?.enabled ? (
          <View style={styles.enableContainer}>
            <Text style={styles.enableDescription}>
              Add an extra layer of security to your account by requiring a verification code when you log in.
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.enableButton, loading && styles.buttonDisabled]}
              onPress={handleInitiateMFA}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Enable Two-Factor Authentication</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.managementContainer}>
            <View style={styles.recoveryStatusCard}>
              <Text style={styles.recoveryStatus}>
                Recovery Codes: {mfaStatus?.recoveryCodesRemaining || 0} / {mfaStatus?.totalRecoveryCodes || 0}
              </Text>
            </View>

            {/* Password input moved below the action buttons for better UX */}

            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.button, styles.secondaryButton, (loading || !(disablePassword || '').trim()) && styles.buttonDisabled]}
              onPress={() => {
                console.log('RegenerateRecoveryCodes pressed', { disablePassword });
                if (!(disablePassword || '').trim()) return;
                handleRegenerateRecoveryCodes();
              }}
              disabled={loading || !(disablePassword || '').trim()}
            >
              <RefreshCw size={16} color="#2E6B4D" />
              <Text style={styles.secondaryButtonText}>Regenerate Recovery Codes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.button, styles.dangerButton, (loading || !(disablePassword || '').trim()) && styles.buttonDisabled]}
              onPress={() => {
                console.log('DisableMFA pressed', { disablePassword });
                if (!(disablePassword || '').trim()) return;
                handleDisableMFA();
              }}
              disabled={loading || !(disablePassword || '').trim()}
            >
              <Text style={styles.dangerButtonText}>Disable Two-Factor Authentication</Text>
            </TouchableOpacity>

            <View style={styles.passwordContainer}>
              <Text style={styles.passwordLabel}>
                {setupStep === 'disable' ? 'Confirm your password' : 'Enter password to confirm'}
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={disablePassword}
                  onChangeText={(text) => {
                    setDisablePassword(text);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#9AA79C"
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.passwordHint}>
                This password is required to disable MFA or generate new recovery codes.
              </Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
  },
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  setupCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    color: '#333',
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  setupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  qrCode: {
    width: 280,
    height: 280,
  },
  manualEntryContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  manualEntryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  secretCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E6B4D',
    letterSpacing: 2,
  },
  verificationContainer: {
    marginBottom: 16,
  },
  verificationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  verificationInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E6B4D',
    letterSpacing: 10,
    textAlign: 'center',
    paddingVertical: 4,
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusEnabled: {
    color: '#28A745',
  },
  statusDisabled: {
    color: '#DC3545',
  },
  statusInfo: {
    fontSize: 12,
    color: '#999',
  },
  enableContainer: {
    marginTop: 16,
  },
  enableDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  managementContainer: {
    marginTop: 16,
  },
  recoveryStatusCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  passwordSection: {
    marginBottom: 14,
  },
  passwordLabel: {
    color: '#2B4133',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInput: {
    color: '#1E2D24',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  passwordHint: {
    color: '#6D7E73',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  recoveryStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recoveryCodesContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  recoveryCodesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  recoveryCodesDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  codesList: {
    backgroundColor: '#FFF',
    borderRadius: 6,
    padding: 8,
  },
  codeItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  enableButton: {
    backgroundColor: '#2E6B4D',
  },
  confirmButton: {
    backgroundColor: '#28A745',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  secondaryButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#2E6B4D',
  },
  dangerButton: {
    backgroundColor: '#FFE5E5',
    borderWidth: 1,
    borderColor: '#DC3545',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E6B4D',
    marginLeft: 8,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC3545',
  },
  passwordContainer: {
    marginTop: 12,
  },
  passwordLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  errorText: {
    color: '#DC3545',
    fontSize: 12,
    marginBottom: 12,
    marginTop: 8,
  },
});

export default MFASettings;
