import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
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

  const API_ORIGIN = apiOrigin;

  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/setup/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
    if (!verificationCode.trim()) {
      setError('Please enter the 6-digit code');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Code must be exactly 6 digits');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/setup/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: setupData.secret,
          token: verificationCode,
          recoveryCodes: setupData.recoveryCodes,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        Alert.alert(
          'Success',
          'Multi-Factor Authentication has been enabled. Save your recovery codes in a safe place!',
          [{ text: 'OK', onPress: () => {
            setSetupStep(null);
            setVerificationCode('');
            setSetupData(null);
            fetchMFAStatus();
            if (onMFAStatusChange) onMFAStatusChange(true);
          }}]
        );
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
    if (!disablePassword.trim()) {
      setError('Please enter your password to disable MFA');
      return;
    }

    Alert.alert(
      'Disable MFA?',
      'Are you sure you want to disable two-factor authentication? Your account will be less secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/disable`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: disablePassword }),
              });

              const data = await response.json();

              if (response.ok && data?.success) {
                Alert.alert('Success', 'MFA has been disabled', [
                  {
                    text: 'OK',
                    onPress: () => {
                      setDisablePassword('');
                      setError('');
                      fetchMFAStatus();
                      if (onMFAStatusChange) onMFAStatusChange(false);
                    },
                  },
                ]);
              } else {
                setError(data?.message || 'Failed to disable MFA');
              }
            } catch (err) {
              setError('Unable to disable MFA');
              console.error(err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!disablePassword.trim()) {
      setError('Please enter your password to regenerate recovery codes');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_ORIGIN}/api/v1/user/mfa/recovery-codes/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        Alert.alert('Success', 'New recovery codes have been generated', [
          {
            text: 'OK',
            onPress: () => {
              setSetupData({ ...setupData, recoveryCodes: data.data.recoveryCodes });
              setShowRecoveryCodes(true);
              setDisablePassword('');
            },
          },
        ]);
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
              <Text style={styles.inputCode}>{verificationCode || '______'}</Text>
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

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegenerateRecoveryCodes}
              disabled={loading}
            >
              <RefreshCw size={16} color="#2E6B4D" />
              <Text style={styles.secondaryButtonText}>Regenerate Recovery Codes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.dangerButton, loading && styles.buttonDisabled]}
              onPress={handleDisableMFA}
              disabled={loading}
            >
              <Text style={styles.dangerButtonText}>Disable Two-Factor Authentication</Text>
            </TouchableOpacity>

            <View style={styles.passwordContainer}>
              <Text style={styles.passwordLabel}>
                {setupStep === 'disable' ? 'Confirm your password' : 'Enter password to confirm'}:
              </Text>
              {/* Password input would go here - implementation depends on your form library */}
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
  inputCode: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2E6B4D',
    letterSpacing: 8,
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
