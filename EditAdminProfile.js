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
import * as ImagePicker from 'expo-image-picker';

const EditAdminProfile = ({ navigation, onBack }) => {
  const [name, setName] = useState('Aina Rahman');
  const [email, setEmail] = useState('aina.rahman@parkadmin.com');
  const [password, setPassword] = useState('ParkAdmin123');
  const [profilePic, setProfilePic] = useState(null);
  const [showSavedNote, setShowSavedNote] = useState(false);
  const defaultAvatar = require('./assets/icon.png');

  const handleSave = () => {
    console.log('Park admin profile updated:', { name, email, password, profilePic });
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
              <Text style={styles.kicker}>National Park Admin</Text>
              <Text style={styles.header}>Edit Profile</Text>
              <Text style={styles.subtitle}>
                Make sure your information as park admin is up to date and accurate to maintain your park identity.
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
              <Text style={styles.profileLabel}>Park Admin</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>Team management</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>Operations</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>Safety first</Text></View>
              </View>
              <TouchableOpacity style={styles.photoButton} onPress={pickProfilePhoto} activeOpacity={0.9}>
                <Text style={styles.photoButtonText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Admin Details</Text>

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
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              placeholderTextColor="#8E9B8A"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.9}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          {showSavedNote ? <Text style={styles.savedNote}>Changes Saved!</Text> : null}
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Admin profile</Text>
          <Text style={styles.footerText}>
            Keep your admin information current so your park identity, contact details and photo stay consistent.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1E18',
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
    backgroundColor: 'rgba(111, 164, 118, 0.18)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 220,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(198, 164, 113, 0.12)',
  },
  heroCard: {
    backgroundColor: '#173427',
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
    backgroundColor: 'rgba(243, 247, 239, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#F3F7EF',
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
  photoButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(243, 247, 239, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243, 247, 239, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  photoButtonText: {
    color: '#F3F7EF',
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
    backgroundColor: '#F4F1E8',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginHorizontal: 120,
    marginVertical: 30,
  },
  sectionTitle: {
    color: '#1D3A2D',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6EFE7',
    borderWidth: 1,
    borderColor: '#C8D7C9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  backButtonText: {
    color: '#1D3A2D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#4D6A58',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D4DDD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    color: '#163023',
    fontSize: 15,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#2E6B4D',
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
    color: '#F5FAF2',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  savedNote: {
    marginTop: 10,
    alignSelf: 'center',
    color: '#2E6B4D',
    fontSize: 13,
    fontWeight: '700',
  },
  footerCard: {
    marginTop: 16,
    backgroundColor: 'rgba(243, 247, 239, 0.08)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(243, 247, 239, 0.1)',
  },
  footerTitle: {
    color: '#EDF5E8',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  footerText: {
    color: 'rgba(237, 245, 232, 0.78)',
    fontSize: 13,
    lineHeight: 19,
  },
});

export default EditAdminProfile;
