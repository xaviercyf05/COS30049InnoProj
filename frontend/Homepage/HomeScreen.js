import React from 'react';
import { Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const performLogout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to log out right now. Please try again.');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out?') : true;
      if (!confirmed) {
        return;
      }
      void performLogout();
      return;
    }

    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Training Modules</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Grade 1 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Module', { grade: 'Grade 1' })}
      >
        <Text style={styles.cardTitle}>Grade 1</Text>
        <Text style={styles.cardText}>Basic Training Materials</Text>
      </TouchableOpacity>

      {/* Grade 2 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Module', { grade: 'Grade 2' })}
      >
        <Text style={styles.cardTitle}>Grade 2</Text>
        <Text style={styles.cardText}>Intermediate Training Materials</Text>
      </TouchableOpacity>

      {/* Grade 3 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Module', { grade: 'Grade 3' })}
      >
        <Text style={styles.cardTitle}>Grade 3</Text>
        <Text style={styles.cardText}>Advanced Training Materials</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8F4',
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F4D2E',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#2D5A27',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 12,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 5,
    borderLeftColor: '#2D5A27',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F4D2E',
  },
  cardText: {
    fontSize: 14,
    marginTop: 4,
    color: '#4E5D53',
  },
});