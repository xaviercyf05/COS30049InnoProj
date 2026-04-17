import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

const COLORS = {
  darkBrown: '#582F0E',
  brown: '#7F4F24',
  olive: '#936639',
  beige: '#B6AD90',
  lightBeige: '#C2C5AA',
  sage: '#A4AC86',
  darkGreen: '#414833',
  deepestGreen: '#333D29',
  errorRed: '#D32F2F',
};

export default function RegisterScreen({ navigation }) {
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
        setResumeFile({ name: file.name, uri: file.uri });
        setErrorMessage('');
      }
    } catch (error) {
      setErrorMessage('Failed to pick resume. Please try again.');
    }
  };

  const getValidationError = () => {
    if (!formData.username.trim()) return 'Username is required.';
    if (!formData.password.trim()) return 'Password is required.';
    if (formData.password.length < 6) return 'Password must be at least 6 characters.';
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (!formData.phoneNumber.trim()) return 'Phone number is required.';
    if (!formData.email.trim()) return 'Email address is required.';
    if (!resumeFile) return 'Please upload your resume (PDF only).';
    return '';
  };

  const handleSubmit = () => {
    const validationError = getValidationError();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    setTimeout(() => {
      setIsSubmitting(false);
      showModal(
        'Application Submitted',
        'Your registration has been received successfully. You will be notified once it is reviewed.',
        true
      );
    }, 700);
  };

  const handleModalClose = () => {
    setModalVisible(false);

    if (navigateAfterModal) {
      navigation.navigate('Submission');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.deepestGreen} />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Park Guide Registration</Text>
          <Text style={styles.headerSubtitle}>
            Join Sarawak National Parks and Nature Reserves Team
          </Text>
        </View>

        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>Requirements</Text>
          <Text style={styles.bullet}>- Malaysian citizen</Text>
          <Text style={styles.bullet}>- At least SPM qualification (or equivalent)</Text>
          <Text style={styles.bullet}>- At least 18 years old</Text>
          <Text style={styles.bullet}>- Interest in conservation, biodiversity, and eco-tourism</Text>
          <Text style={styles.bullet}>- Physically fit for outdoor guiding activities</Text>
          <Text style={styles.bullet}>- Good communication in English and Bahasa Malaysia</Text>

          <Text style={styles.noteText}>
            Your application will be reviewed by the Sarawak Forestry Corporation admin team.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Create Your Account</Text>
          <Text style={styles.sectionSubtitle}>Please fill in all required details.</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. johnparkguide"
            value={formData.username}
            onChangeText={(text) => handleInputChange('username', text)}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
            secureTextEntry
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="As per IC"
            value={formData.fullName}
            onChangeText={(text) => handleInputChange('fullName', text)}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 012-3456789"
            value={formData.phoneNumber}
            onChangeText={(text) => handleInputChange('phoneNumber', text)}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. youremail@gmail.com"
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
    backgroundColor: COLORS.lightBeige,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.deepestGreen,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: 34,
    marginHorizontal: -20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.lightBeige,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.sage,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  requirementsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  requirementsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.olive,
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.darkGreen,
    marginBottom: 7,
    lineHeight: 21,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.brown,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.deepestGreen,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.brown,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepestGreen,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: COLORS.lightBeige,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.deepestGreen,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.sage,
  },
  uploadButton: {
    backgroundColor: COLORS.beige,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.olive,
    borderStyle: 'dashed',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.olive,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: COLORS.olive,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.sage,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 18,
  },
  loginLinkText: {
    fontSize: 14,
    color: COLORS.darkGreen,
  },
  loginLinkHighlight: {
    color: COLORS.brown,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.deepestGreen,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: COLORS.darkGreen,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  modalButton: {
    backgroundColor: COLORS.olive,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
