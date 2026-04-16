import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
  darkBrown: '#582f0e',
  brown: '#7f4f24',
  olive: '#936639',
  lightBrown: '#a68a64',
  beige: '#b6ad90',
  lightBeige: '#c2c5aa',
  sage: '#a4ac86',
  forestGreen: '#656d4a',
  darkGreen: '#414833',
  deepestGreen: '#333d29',
};

const SubmissionScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.successIcon}>🌿</Text>
          <Text style={styles.successIcon}>✅</Text>
        </View>

        <Text style={styles.title}>Thank You!</Text>
        <Text style={styles.subtitle}>
          Your Park Guide application has been submitted successfully.
        </Text>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>
            Your application is now <Text style={styles.highlight}>pending approval</Text> by the Sarawak Forestry Corporation.
          </Text>
          <Text style={styles.smallText}>
            You will receive an email notification once your application is reviewed.{'\n\n'}
            Thank you for your interest in joining our team to protect and guide visitors through Sarawak’s beautiful national parks!
          </Text>
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.homeButtonText}>Register Another Account</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Sarawak Forestry Corporation © 2026
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightBeige,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  iconContainer: {
    flexDirection: 'row',
    marginBottom: 25,
  },
  successIcon: {
    fontSize: 85,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    color: COLORS.deepestGreen,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.olive,
    textAlign: 'center',
    marginBottom: 35,
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 45,
  },
  messageText: {
    fontSize: 17,
    color: COLORS.darkGreen,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  highlight: {
    color: COLORS.olive,
    fontWeight: '700',
  },
  smallText: {
    fontSize: 14.5,
    color: COLORS.brown,
    textAlign: 'center',
    lineHeight: 23,
  },
  loginButton: {
    backgroundColor: COLORS.olive,
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: COLORS.sage,
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  homeButtonText: {
    color: COLORS.darkGreen,
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    position: 'absolute',
    bottom: 10,
    color: COLORS.sage,
    fontSize: 12.5,
  },
});

export default SubmissionScreen;