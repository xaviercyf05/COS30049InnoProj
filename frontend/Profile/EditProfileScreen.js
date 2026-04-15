import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { requestProfileApi, resolveProfileImageUri } from './profileApi';

const defaultAvatar = require('../assets/icon.png');

function normalize(value) {
  return String(value || '').trim();
}

function formatSavedTime(timestamp) {
  if (!(timestamp instanceof Date)) {
    return null;
  }

  return timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getImageUploadMetadata(asset) {
  const fallbackName = 'profile-image.jpg';
  const fromUri = typeof asset?.uri === 'string' ? asset.uri.split(/[?#]/)[0] : '';
  const uriExtension = fromUri.includes('.') ? fromUri.split('.').pop()?.toLowerCase() : '';

  const typeFromExtension =
    uriExtension === 'png'
      ? 'image/png'
      : uriExtension === 'webp'
        ? 'image/webp'
        : uriExtension === 'gif'
          ? 'image/gif'
          : uriExtension === 'jpg' || uriExtension === 'jpeg'
            ? 'image/jpeg'
            : null;

  const mimeType = asset?.mimeType || asset?.type || typeFromExtension || 'image/jpeg';

  const fileName =
    asset?.fileName ||
    (uriExtension ? `profile-image.${uriExtension}` : fallbackName);

  return { fileName, mimeType };
}

async function buildProfileImageUploadFormData(asset) {
  if (!asset?.uri) {
    throw new Error('Please select a profile image before saving.');
  }

  const formData = new FormData();
  const { fileName, mimeType } = getImageUploadMetadata(asset);

  if (Platform.OS === 'web') {
    const fileFromPicker = asset?.file;

    if (fileFromPicker instanceof Blob) {
      formData.append('profileImage', fileFromPicker, fileFromPicker.name || fileName);
      return formData;
    }

    let blobFromUri = null;

    try {
      const blobResponse = await fetch(asset.uri);
      blobFromUri = await blobResponse.blob();
    } catch {
      blobFromUri = null;
    }

    if (!blobFromUri) {
      throw new Error('Unable to prepare selected image for upload in the browser.');
    }

    formData.append('profileImage', blobFromUri, fileName);
    return formData;
  }

  formData.append('profileImage', {
    uri: asset.uri,
    name: fileName,
    type: mimeType,
  });

  return formData;
}

export default function EditProfileScreen({ navigation, route }) {
  const [profile, setProfile] = useState(route?.params?.profile || null);
  const [loading, setLoading] = useState(!route?.params?.profile);
  const [saving, setSaving] = useState(false);
  const [lastSaveOutcome, setLastSaveOutcome] = useState(null);
  const [lastSaveMessage, setLastSaveMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [pendingProfileImage, setPendingProfileImage] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(
    route?.params?.profile?.profileImageUrl
      ? resolveProfileImageUri(route.params.profile.profileImageUrl)
      : null
  );

  const [fullName, setFullName] = useState(route?.params?.profile?.fullName || '');
  const [email, setEmail] = useState(route?.params?.profile?.email || '');
  const [username, setUsername] = useState(route?.params?.profile?.username || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [hasTypedCurrentPassword, setHasTypedCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const clearPasswordFields = useCallback(() => {
    setHasTypedCurrentPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const handleCurrentPasswordChange = useCallback((value) => {
    setHasTypedCurrentPassword(true);
    setCurrentPassword(value);
  }, []);

  const isAdmin = useMemo(() => {
    if (!profile) {
      return false;
    }

    const effectiveRole = profile.viewerRole || profile.role;
    return effectiveRole === 'Admin';
  }, [profile]);

  const normalizedFullName = normalize(fullName);
  const normalizedEmail = normalize(email);
  const normalizedUsername = normalize(username);
  const hasPendingImage = Boolean(pendingProfileImage);
  const wantsPasswordChange =
    normalize(currentPassword).length > 0 ||
    normalize(newPassword).length > 0 ||
    normalize(confirmPassword).length > 0;
  const hasProfileChanges =
    normalizedFullName !== normalize(profile?.fullName) ||
    normalizedEmail !== normalize(profile?.email) ||
    normalizedUsername !== normalize(profile?.username);
  const hasUnsavedChanges = hasProfileChanges || wantsPasswordChange || hasPendingImage;

  const saveStatus = useMemo(() => {
    if (saving) {
      return { variant: 'saving', text: 'Saving changes...' };
    }

    if (lastSaveOutcome === 'error') {
      return {
        variant: 'error',
        text: lastSaveMessage || 'Save failed. Please review your inputs and try again.',
      };
    }

    if (hasUnsavedChanges) {
      return { variant: 'warning', text: 'You have unsaved changes.' };
    }

    if (lastSaveOutcome === 'success') {
      const savedTime = formatSavedTime(lastSavedAt);
      return {
        variant: 'success',
        text: savedTime ? `Changes saved at ${savedTime}.` : 'Changes saved successfully.',
      };
    }

    return { variant: 'neutral', text: 'No pending changes.' };
  }, [saving, lastSaveOutcome, lastSaveMessage, hasUnsavedChanges, lastSavedAt]);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('innopapp_auth_token');

      if (!token) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      const response = await requestProfileApi('/api/v1/user/profile', token, {
        method: 'GET',
      });

      const nextProfile = response.data;
      setProfile(nextProfile);
      setFullName(nextProfile.fullName || '');
      setEmail(nextProfile.email || '');
      setUsername(nextProfile.username || '');
      clearPasswordFields();
      setProfileImageUri(
        nextProfile.profileImageUrl ? resolveProfileImageUri(nextProfile.profileImageUrl) : null
      );
    } catch (error) {
      Alert.alert('Profile Error', error?.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }, [navigation, clearPasswordFields]);

  const pickProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.length) {
      const selectedAsset = result.assets[0];
      setPendingProfileImage(selectedAsset);
      setProfileImageUri(selectedAsset.uri);
    }
  };

  useEffect(() => {
    if (!route?.params?.profile) {
      loadProfile();
    }
  }, [route?.params?.profile, loadProfile]);

  useEffect(() => {
    clearPasswordFields();
  }, [clearPasswordFields]);

  useEffect(() => {
    if (Platform.OS !== 'web' || hasTypedCurrentPassword) {
      return;
    }

    const clearAutofillValue = () => {
      setCurrentPassword((previous) => (previous ? '' : previous));
    };

    clearAutofillValue();

    const timeoutShort = setTimeout(clearAutofillValue, 50);
    const timeoutMedium = setTimeout(clearAutofillValue, 250);
    const timeoutLong = setTimeout(clearAutofillValue, 1000);

    const onWindowFocus = () => {
      clearAutofillValue();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus);
    }

    return () => {
      clearTimeout(timeoutShort);
      clearTimeout(timeoutMedium);
      clearTimeout(timeoutLong);

      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus);
      }
    };
  }, [hasTypedCurrentPassword]);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    if (!normalizedFullName || !normalizedEmail || !normalizedUsername) {
      setLastSaveOutcome('error');
      setLastSaveMessage('Full name, email and username are required.');
      Alert.alert('Validation Error', 'Full name, email and username are required.');
      return;
    }

    if (wantsPasswordChange) {
      if (!normalize(currentPassword) || !normalize(newPassword) || !normalize(confirmPassword)) {
        setLastSaveOutcome('error');
        setLastSaveMessage('Fill all password fields to change password.');
        Alert.alert('Validation Error', 'Fill all password fields to change password.');
        return;
      }

      if (normalize(newPassword).length < 8) {
        setLastSaveOutcome('error');
        setLastSaveMessage('New password must be at least 8 characters.');
        Alert.alert('Validation Error', 'New password must be at least 8 characters.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setLastSaveOutcome('error');
        setLastSaveMessage('New password and confirmation do not match.');
        Alert.alert('Validation Error', 'New password and confirmation do not match.');
        return;
      }
    }

    if (!hasProfileChanges && !wantsPasswordChange && !hasPendingImage) {
      setLastSaveOutcome(null);
      setLastSaveMessage('No profile changes detected yet.');
      return;
    }

    setLastSaveOutcome(null);
    setLastSaveMessage('');
    setSaving(true);

    try {
      const token = await AsyncStorage.getItem('innopapp_auth_token');

      if (!token) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      const hasProfileChanges =
        normalizedFullName !== normalize(profile?.fullName) ||
        normalizedEmail !== normalize(profile?.email) ||
        normalizedUsername !== normalize(profile?.username);

      let updatedProfile = profile;

      if (hasPendingImage) {
        const formData = await buildProfileImageUploadFormData(pendingProfileImage);

        const imageResponse = await requestProfileApi('/api/v1/user/profile/image', token, {
          method: 'PUT',
          body: formData,
        });

        updatedProfile = imageResponse.data;
        setPendingProfileImage(null);
        setProfileImageUri(
          updatedProfile?.profileImageUrl ? resolveProfileImageUri(updatedProfile.profileImageUrl) : null
        );
      }

      if (hasProfileChanges) {
        const profileUpdateResponse = await requestProfileApi('/api/v1/user/profile', token, {
          method: 'PUT',
          body: {
            fullName: normalizedFullName,
            email: normalizedEmail,
            username: normalizedUsername,
          },
        });

        updatedProfile = profileUpdateResponse.data;
      }

      if (wantsPasswordChange) {
        await requestProfileApi('/api/v1/user/change-password', token, {
          method: 'POST',
          body: {
            currentPassword,
            newPassword,
          },
        });

        clearPasswordFields();
      }

      setProfile(updatedProfile);
      setLastSaveOutcome('success');
      setLastSavedAt(new Date());
      setLastSaveMessage('Profile updated successfully.');
    } catch (error) {
      setLastSaveOutcome('error');
      setLastSaveMessage(error?.message || 'Unable to save profile changes.');
      Alert.alert('Save Failed', error?.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isAdmin ? '#0F1E18' : '#FBFCF8' }]}>
      <StatusBar barStyle={isAdmin ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>{isAdmin ? 'National Park Admin' : 'National Park Guide'}</Text>
          <Text style={styles.heroTitle}>Edit Profile</Text>
          <Text style={styles.heroText}>
            Update account information for {profile?.role || 'your account'}.
          </Text>

          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarButton} onPress={pickProfileImage} activeOpacity={0.85}>
              <Image
                source={profileImageUri ? { uri: profileImageUri } : defaultAvatar}
                style={styles.avatarImage}
              />
            </TouchableOpacity>

            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>Profile Picture</Text>
              <Text style={styles.avatarDescription}>
                Tap the picture or the button below to choose a new image.
              </Text>
              <TouchableOpacity style={styles.avatarActionButton} onPress={pickProfileImage} activeOpacity={0.85}>
                <Text style={styles.avatarActionText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Profile Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full Name"
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#8E9B8A"
            />
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Text style={styles.passwordHint}>
            Leave these fields empty if you do not want to change your password.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={handleCurrentPasswordChange}
              onFocus={() => {
                if (!hasTypedCurrentPassword && currentPassword) {
                  setCurrentPassword('');
                }
              }}
              placeholder="Current Password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={Platform.OS === 'web' ? 'new-password' : 'off'}
              textContentType="none"
              importantForAutofill="no"
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm New Password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              placeholderTextColor="#8E9B8A"
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.buttonDisabled]}
            onPress={() => navigation.goBack()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.saveStatusBanner,
            saveStatus.variant === 'success' && styles.saveStatusBannerSuccess,
            saveStatus.variant === 'warning' && styles.saveStatusBannerWarning,
            saveStatus.variant === 'error' && styles.saveStatusBannerError,
            saveStatus.variant === 'saving' && styles.saveStatusBannerSaving,
          ]}
        >
          <Text
            style={[
              styles.saveStatusText,
              saveStatus.variant === 'success' && styles.saveStatusTextSuccess,
              saveStatus.variant === 'warning' && styles.saveStatusTextWarning,
              saveStatus.variant === 'error' && styles.saveStatusTextError,
              saveStatus.variant === 'saving' && styles.saveStatusTextSaving,
            ]}
          >
            {saveStatus.text}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#173427',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 30,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#1E3327',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroKicker: {
    color: '#B9D5B7',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 8,
    color: '#F3F7EF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  heroText: {
    marginTop: 10,
    color: 'rgba(243,247,239,0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
  avatarSection: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarCopy: {
    flex: 1,
  },
  avatarTitle: {
    color: '#F3F7EF',
    fontSize: 15,
    fontWeight: '800',
  },
  avatarDescription: {
    marginTop: 6,
    color: 'rgba(243,247,239,0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
  avatarActionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#2E6B4D',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatarActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#F4F1E8',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D5DEC8',
  },
  sectionTitle: {
    color: '#1F372B',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  passwordHint: {
    color: '#506557',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#4B6252',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE3D2',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1A3024',
    fontSize: 15,
  },
  actionRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9CAD90',
    backgroundColor: '#EEF3E8',
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#324F3E',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2E6B4D',
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveStatusBanner: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5DEC8',
    backgroundColor: '#EEF3E8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveStatusBannerSuccess: {
    borderColor: '#93C5A7',
    backgroundColor: '#EAF8EF',
  },
  saveStatusBannerWarning: {
    borderColor: '#E3C581',
    backgroundColor: '#FFF7E2',
  },
  saveStatusBannerError: {
    borderColor: '#E0A6A6',
    backgroundColor: '#FDEEEE',
  },
  saveStatusBannerSaving: {
    borderColor: '#9FB6D8',
    backgroundColor: '#EEF4FD',
  },
  saveStatusText: {
    color: '#324F3E',
    fontSize: 13,
    fontWeight: '700',
  },
  saveStatusTextSuccess: {
    color: '#2B5D3F',
  },
  saveStatusTextWarning: {
    color: '#7A5A1A',
  },
  saveStatusTextError: {
    color: '#8B2D2D',
  },
  saveStatusTextSaving: {
    color: '#274E85',
  },
});
