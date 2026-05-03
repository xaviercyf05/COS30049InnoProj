import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  pageBg: '#FBFCF8',
  surface: '#FFFFFF',
  border: '#E8EEE3',
  borderSoft: '#EEF2EA',
  heading: '#20372A',
  body: '#445A4D',
  muted: '#6A7A67',
  accent: '#2E6B4D',
  accentSoft: '#ECF2E5',
  primaryButton: '#656D4A',
  secondaryButtonBg: '#F2F5ED',
  secondaryButtonBorder: '#D8E2CF',
};

export default function SubmissionScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === 'web' ? 14 : Math.max(10, insets.top + 4),
          },
        ]}
      >
        <TouchableOpacity style={styles.navPill} onPress={handleBack}>
          <Text style={styles.navPillText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>Submission</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.container}>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>Application Submitted</Text>
        </View>

        <Text style={styles.title}>Thank You</Text>
        <Text style={styles.subtitle}>
          Your Park Guide application has been submitted successfully.
        </Text>

        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>What Happens Next?</Text>
          <Text style={styles.messageText}>
            Your application is now pending approval by Sarawak Forestry Corporation.
          </Text>
          <Text style={styles.smallText}>
            You will receive a notification once your application is reviewed.
          </Text>
        </View>

        <View style={styles.verificationCard}>
          <Text style={styles.verificationTitle}>After Approval</Text>
          <Text style={styles.verificationStep}>
            <Text style={styles.stepNumber}>1.</Text> You'll receive a verification email
          </Text>
          <Text style={styles.verificationStep}>
            <Text style={styles.stepNumber}>2.</Text> Click the verification link in the email
          </Text>
          <Text style={styles.verificationStep}>
            <Text style={styles.stepNumber}>3.</Text> Your account will be activated
          </Text>
          <Text style={styles.verificationStep}>
            <Text style={styles.stepNumber}>4.</Text> You can then log in with your credentials
          </Text>
          <Text style={styles.verificationNote}>
            The verification link will expire in 7 days. Please verify your email promptly.
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
    backgroundColor: COLORS.pageBg,
  },
  topBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navPill: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
  },
  navPillText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
  },
  topSpacer: {
    width: 92,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  badgeWrap: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  badgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.body,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    maxWidth: 560,
  },
  messageCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 560,
    marginBottom: 20,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  smallText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  verificationCard: {
    backgroundColor: '#F0F8F5',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 560,
    marginBottom: 20,
  },
  verificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.accent,
    marginBottom: 12,
  },
  verificationStep: {
    fontSize: 13,
    color: COLORS.body,
    marginBottom: 8,
    lineHeight: 20,
  },
  stepNumber: {
    fontWeight: '700',
    color: COLORS.accent,
  },
  verificationNote: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    fontStyle: 'italic',
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
  },
  loginButton: {
    backgroundColor: COLORS.primaryButton,
    width: '100%',
    maxWidth: 560,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: COLORS.secondaryButtonBg,
    borderWidth: 1,
    borderColor: COLORS.secondaryButtonBorder,
    width: '100%',
    maxWidth: 560,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  homeButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  footerText: {
    position: 'absolute',
    bottom: 12,
    color: COLORS.muted,
    fontSize: 12,
  },
});
