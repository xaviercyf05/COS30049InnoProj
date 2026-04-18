import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { API_ORIGIN, getApiBaseUrls } from '../Profile/profileApi.js';

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
  primaryButtonDisabled: '#A5B49A',
  inputBg: '#F9FBF7',
  inputBorder: '#DDE4D7',
  danger: '#C73737',
  overlay: 'rgba(0, 0, 0, 0.48)',
};

const REQUIREMENTS = [
  'Malaysian citizen',
  'At least SPM qualification (or equivalent)',
  'At least 18 years old',
  'Interest in conservation, biodiversity, and eco-tourism',
  'Physically fit for outdoor guiding activities',
  'Good communication in English and Bahasa Malaysia',
];

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    email: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [navigateAfterModal, setNavigateAfterModal] = useState(false);

  const showModal = (title, message, shouldNavigate = false) => {
    setModalTitle(title);
    setModalMessage(message);
    setNavigateAfterModal(shouldNavigate);
    setModalVisible(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        setResumeFile({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType || 'application/pdf',
          file: file.file,
        });
        setErrorMessage('');
      }
    } catch (error) {
      setErrorMessage('Failed to pick resume. Please try again.');
    }
  };

  const getValidationError = () => {
    if (!formData.username.trim()) return 'Username is required.';
    if (!formData.password.trim()) return 'Password is required.';
    if (formData.password.length < 8) return 'Password must be at least 8 characters.';
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (!formData.phoneNumber.trim()) return 'Phone number is required.';
    if (!formData.email.trim()) return 'Email address is required.';
    if (!resumeFile) return 'Please upload your resume (PDF only).';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = getValidationError();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const createFormPayload = () => {
      const payload = new FormData();
      payload.append('username', formData.username.trim());
      payload.append('password', formData.password);
      payload.append('fullName', formData.fullName.trim());
      payload.append('phoneNumber', formData.phoneNumber.trim());
      payload.append('email', formData.email.trim());

      if (resumeFile.file) {
        payload.append('resume', resumeFile.file);
      } else {
        payload.append('resume', {
          uri: resumeFile.uri,
          name: resumeFile.name || 'resume.pdf',
          type: resumeFile.mimeType || 'application/pdf',
        });
      }

      return payload;
    };

    const baseUrls = Platform.OS === 'web' ? getApiBaseUrls() : [API_ORIGIN];
    let response = null;
    let responsePayload = null;
    let lastNetworkError = null;

    try {
      for (const baseUrl of baseUrls) {
        try {
          const candidateResponse = await fetch(`${baseUrl}/api/v1/public/register`, {
            method: 'POST',
            body: createFormPayload(),
          });

          const contentType = candidateResponse.headers.get('content-type') || '';
          responsePayload = contentType.toLowerCase().includes('application/json')
            ? await candidateResponse.json()
            : { message: await candidateResponse.text() };

          response = candidateResponse;
          break;
        } catch (error) {
          lastNetworkError = error;
        }
      }

      if (!response) {
        throw lastNetworkError || new Error('Unable to reach registration service.');
      }

      if (!response.ok || !responsePayload?.success) {
        setErrorMessage(
          responsePayload?.message ||
            'Unable to submit registration right now. Please try again.'
        );
        return;
      }

      showModal(
        'Application Submitted',
        'Your registration has been received successfully. You will be notified once it is reviewed.',
        true
      );
    } catch (error) {
      setErrorMessage(
        Platform.OS === 'web'
          ? 'Unable to reach registration service from web. Check API proxy settings and try again.'
          : 'Unable to reach the registration service. Please check your connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);

    if (navigateAfterModal) {
      navigation.navigate('Submission');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Login');
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

        <Text style={styles.topTitle}>Register</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Park Guide Registration</Text>
          <Text style={styles.introSubtitle}>
            Join Sarawak National Parks and Nature Reserves team.
          </Text>
        </View>

        <View style={styles.requirementsCard}>
          <Text style={styles.sectionHeader}>Requirements</Text>
          {REQUIREMENTS.map((requirement) => (
            <Text key={requirement} style={styles.bullet}>
              {'\u2022'} {requirement}
            </Text>
          ))}

          <Text style={styles.noteText}>
            Your application will be reviewed by the Sarawak Forestry Corporation admin team.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create Your Account</Text>
          <Text style={styles.sectionSubtitle}>Please fill in all required details.</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. johnparkguide"
            placeholderTextColor="#8A9687"
            value={formData.username}
            onChangeText={(text) => handleInputChange('username', text)}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#8A9687"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
            secureTextEntry
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="As per IC"
            placeholderTextColor="#8A9687"
            value={formData.fullName}
            onChangeText={(text) => handleInputChange('fullName', text)}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 012-3456789"
            placeholderTextColor="#8A9687"
            value={formData.phoneNumber}
            onChangeText={(text) => handleInputChange('phoneNumber', text)}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. youremail@gmail.com"
            placeholderTextColor="#8A9687"
            value={formData.email}
            onChangeText={(text) => handleInputChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Resume (PDF)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickResume}>
            <Text style={styles.uploadButtonText}>
              {resumeFile ? `Selected: ${resumeFile.name}` : 'Tap to upload your resume (PDF only)'}
            </Text>
          </TouchableOpacity>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkHighlight}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        statusBarTranslucent
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <Pressable style={styles.modalButton} onPress={handleModalClose}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    backgroundColor: COLORS.pageBg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  introCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.heading,
  },
  introSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.body,
    lineHeight: 22,
  },
  requirementsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.body,
    marginBottom: 6,
    lineHeight: 20,
  },
  noteText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 10,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.heading,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.body,
    marginTop: 6,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.heading,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.heading,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  uploadButton: {
    backgroundColor: '#F5F8F1',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8E2CF',
    borderStyle: 'dashed',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: COLORS.primaryButton,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.primaryButtonDisabled,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loginLink: {
    alignItems: 'flex-start',
    marginTop: 14,
  },
  loginLinkText: {
    fontSize: 14,
    color: COLORS.body,
  },
  loginLinkHighlight: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.body,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  modalButton: {
    backgroundColor: COLORS.primaryButton,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 36,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
