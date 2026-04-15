import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RegisterPlaceholderScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071407" />

      <Text style={styles.title}>Registration Coming Soon</Text>
      <Text style={styles.message}>
        The registration form will be available in a future update.
      </Text>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.85}
      >
        <Text style={styles.backButtonText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1E0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#D7E5D4',
    textAlign: 'center',
    maxWidth: 360,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#2D5A27',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
