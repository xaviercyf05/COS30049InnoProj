import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  darkBrown: '#582F0E',
  brown: '#7F4F24',
  olive: '#936639',
  lightBeige: '#C2C5AA',
  sage: '#A4AC86',
  darkGreen: '#414833',
  deepestGreen: '#333D29',
};

export default function SubmissionScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Thank You</Text>
        <Text style={styles.subtitle}>
          Your Park Guide application has been submitted successfully.
        </Text>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>
            Your application is now pending approval by Sarawak Forestry Corporation.
          </Text>
          <Text style={styles.smallText}>
            You will receive a notification once your application is reviewed.
          </Text>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.homeButtonText}>Register Another Account</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Sarawak Forestry Corporation 2026</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightBeige,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.deepestGreen,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: COLORS.olive,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 30,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.darkGreen,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  smallText: {
    fontSize: 14,
    color: COLORS.brown,
    textAlign: 'center',
    lineHeight: 21,
  },
  loginButton: {
    backgroundColor: COLORS.olive,
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.sage,
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    color: COLORS.darkGreen,
    fontSize: 15,
    fontWeight: '600',
  },
  footerText: {
    position: 'absolute',
    bottom: 10,
    color: COLORS.sage,
    fontSize: 12,
  },
});
