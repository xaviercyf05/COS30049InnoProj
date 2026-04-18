import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import withRoleGuard from '../auth/withRoleGuard.js';
import { requestProfileApi } from '../Profile/profileApi.js';

const BADGE_IMAGE = {
  uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png',
};

function AddBadgeScreen({ navigation }) {
  const [badgeName, setBadgeName] = useState('');

  const handleAddBadge = async () => {
    if (!badgeName.trim()) {
      Alert.alert('Missing details', 'Please enter a badge name.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('innopapp_auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again to continue.');
        return;
      }

      await requestProfileApi('/api/v1/admin/badges', token, {
        method: 'POST',
        body: {
          name: badgeName.trim(),
          iconUrl: BADGE_IMAGE.uri,
        },
      });

      navigation.goBack();
    } catch (error) {
      Alert.alert('Create failed', error?.message || 'Unable to create badge right now.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Badge</Text>

      <View style={styles.imageBox}>
        <Image source={BADGE_IMAGE} style={styles.image} />
        <Text style={styles.imageLabel}>Default Badge Icon</Text>
      </View>

      <TextInput
        placeholder="Badge Name (e.g. Bako National Park)"
        placeholderTextColor="#9AA299"
        value={badgeName}
        onChangeText={setBadgeName}
        style={styles.input}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddBadge}>
        <Text style={styles.addText}>+ Create Badge</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FBFCF8',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#3A4D39',
  },
  imageBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EBEFE4',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  image: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  imageLabel: {
    fontSize: 12,
    color: '#66705F',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E6EAE0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  addButton: {
    backgroundColor: '#656D4A',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default withRoleGuard(AddBadgeScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Add Badge',
});
