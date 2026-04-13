import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const EditProfileScreen = ({ navigation, onBack }) => {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john.doe@gmail.com');
  const [username, setUsername] = useState('johndoe_park');
  const [phoneNumber, setPhoneNumber] = useState('012-345 6789');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [showSavedNote, setShowSavedNote] = useState(false);
  const userId = 'PG-1234';
  const defaultAvatar = require('./assets/icon.png');
  const hasOldPassword = oldPassword.trim().length > 0;
  const isChangingPassword = newPassword.length > 0 || confirmNewPassword.length > 0;
  const passwordsMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const handleSave = () => {
    if (isChangingPassword && !hasOldPassword) {
      setPasswordError('Please fill Old Password before changing to a new password.');
      setShowSavedNote(false);
      return;
    }

    if (passwordsMismatch) {
      setPasswordError('Password does not match.');
      setShowSavedNote(false);
      return;
    }

    setPasswordError('');
    console.log('Park guide profile updated:', {
      name,
      email,
      username,
      phoneNumber,
      oldPassword,
      newPassword,
      profilePic,
      userId,
    });
    setShowSavedNote(true);
  };

  const pickProfilePhoto = async () => {
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
      setProfilePic(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.kicker}>National Park Guide</Text>
              <Text style={styles.header}>Edit Profile</Text>
              <Text style={styles.subtitle}>
                Make sure your information as park guide is up to date and accurate to maintain your park identity.
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Park Staff</Text>
            </View>
          </View>

          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageContainer} activeOpacity={0.85} onPress={pickProfilePhoto}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.image} />
              ) : (
                <Image source={defaultAvatar} style={styles.image} />
              )}
            </TouchableOpacity>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileLabel}>Park Guide</Text>
              <Text style={styles.profileSubLabel}>User ID: {userId}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>Bako National Park</Text></View>
              </View>
              <TouchableOpacity style={styles.photoButton} onPress={pickProfilePhoto} activeOpacity={0.9}>
                <Text style={styles.photoButtonText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Guide Details</Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else if (onBack) {
                onBack();
              }
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
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
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Old Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={oldPassword}
                onChangeText={(value) => {
                  setOldPassword(value);
                  setPasswordError('');
                }}
                placeholder="Old Password"
                secureTextEntry={!showOldPassword}
                placeholderTextColor="#8E9B8A"
              />
              <TouchableOpacity
                style={styles.passwordToggleButton}
                onPress={() => setShowOldPassword((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showOldPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#656D4A"
                />
              </TouchableOpacity>
            </View>
            {!hasOldPassword ? (
              <Text style={styles.passwordHintText}>Fill Old Password first to enable New Password fields.</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.passwordInputWrapper, !hasOldPassword && styles.passwordInputWrapperDisabled]}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setPasswordError('');
                }}
                placeholder="New Password"
                secureTextEntry={!showNewPassword}
                placeholderTextColor="#8E9B8A"
                editable={hasOldPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggleButton}
                onPress={() => setShowNewPassword((prev) => !prev)}
                activeOpacity={0.7}
                disabled={!hasOldPassword}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#656D4A"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={[styles.passwordInputWrapper, !hasOldPassword && styles.passwordInputWrapperDisabled]}>
              <TextInput
                style={styles.passwordInput}
                value={confirmNewPassword}
                onChangeText={(value) => {
                  setConfirmNewPassword(value);
                  setPasswordError('');
                }}
                placeholder="Confirm New Password"
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor="#8E9B8A"
                editable={hasOldPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggleButton}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                activeOpacity={0.7}
                disabled={!hasOldPassword}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#656D4A"
                />
              </TouchableOpacity>
            </View>
            {passwordsMismatch ? <Text style={styles.passwordErrorText}>Password does not match.</Text> : null}
            {passwordError ? <Text style={styles.passwordErrorText}>{passwordError}</Text> : null}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.9}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          {showSavedNote ? <Text style={styles.savedNote}>Changes Saved!</Text> : null}
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Guide profile</Text>
          <Text style={styles.footerText}>
            Keep your guide information current so your park identity, contact details and photo stay consistent.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(164, 172, 134, 0.22)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 220,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(182, 173, 144, 0.16)',
  },
  heroCard: {
    backgroundColor: '#414833',
    borderRadius: 28,
    padding: 20,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  kicker: {
    color: '#A7CFA8',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '700',
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F3F7EF',
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(243, 247, 239, 0.78)',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '100%',
  },
  badge: {
    backgroundColor: 'rgba(194, 197, 170, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#FBFCF8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
  },
  imageContainer: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    resizeMode: 'cover',
    backgroundColor: '#D7E3D1',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#F6FAF1',
    fontSize: 22,
    fontWeight: '800',
  },
  profileLabel: {
    color: '#A7CFA8',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  profileSubLabel: {
    color: 'rgba(231, 240, 226, 0.9)',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  photoButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#A4AC86',
    borderWidth: 1,
    borderColor: '#C2C5AA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  photoButtonText: {
    color: '#333D29',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: 'rgba(243, 247, 239, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    color: '#E7F0E2',
    fontSize: 12,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#C2C5AA',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#A4AC86',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginHorizontal: 120,
    marginVertical: 30,
  },
  sectionTitle: {
    color: '#333D29',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#A4AC86',
    borderWidth: 1,
    borderColor: '#656D4A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  backButtonText: {
    color: '#333D29',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#414833',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#A4AC86',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    color: '#333D29',
    fontSize: 15,
  },
  passwordInputWrapper: {
    borderWidth: 1,
    borderColor: '#A4AC86',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
  },
  passwordInputWrapperDisabled: {
    backgroundColor: '#EEF2EB',
    opacity: 0.8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#333D29',
    fontSize: 15,
  },
  passwordToggleButton: {
    padding: 4,
  },
  passwordHintText: {
    marginTop: 6,
    color: '#414833',
    fontSize: 12,
  },
  passwordErrorText: {
    marginTop: 6,
    color: '#7F4F24',
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: '#A4AC86',
    backgroundColor: '#EEF2EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    color: '#5B6C61',
    fontSize: 15,
  },
  helperText: {
    marginTop: 6,
    color: '#414833',
    fontSize: 12,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#656D4A',
    paddingVertical: 11,
    width: '30%',
    alignSelf: 'center',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#13301F',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  saveButtonText: {
    color: '#FBFCF8',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  savedNote: {
    marginTop: 10,
    alignSelf: 'center',
    color: '#333D29',
    fontSize: 13,
    fontWeight: '700',
  },
  footerCard: {
    marginTop: 16,
    backgroundColor: '#E7EBD9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#C2C5AA',
  },
  footerTitle: {
    color: '#333d29',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  footerText: {
    color: '#333d29',
    fontSize: 13,
    lineHeight: 19,
  },
});

export default EditProfileScreen;