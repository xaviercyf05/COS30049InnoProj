import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

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
  errorRed: '#d32f2f',
};

const RegisterScreen = () => {
  const navigation = useNavigation();

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

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage('');
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
    } catch (err) {
      showModal('Error', 'Failed to pick resume. Please try again.');
    }
  };

  const getValidationError = () => {
    if (!formData.username.trim()) return 'Username is required';
    if (!formData.password.trim()) return 'Password is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (!formData.fullName.trim()) return 'Full Name is required';
    if (!formData.phoneNumber.trim()) return 'Phone Number is required';
    if (!formData.email.trim()) return 'Email Address is required';
    if (!resumeFile) return 'Please upload your resume (PDF only)';
    return '';
  };

  const handleSubmit = () => {
    const error = getValidationError();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    setTimeout(() => {
      setIsSubmitting(false);
      showModal(
        'Application Submitted!',
        'Your registration has been received successfully.\n\nYou will be notified once it is reviewed.'
      );
    }, 800);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setTimeout(() => {
      navigation.navigate('Submission');
    }, 300);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.deepestGreen} />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.treeEmoji}>🌳</Text>
          <Text style={styles.headerTitle}>Park Guide Registration</Text>
          <Text style={styles.headerSubtitle}>
            Join Sarawak's National Parks & Nature Reserves Team
          </Text>
        </View>

        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>✅ Requirements</Text>
          <View style={styles.bulletContainer}>
            <Text style={styles.bullet}>• Must be a Malaysian citizen</Text>
            <Text style={styles.bullet}>• Must possess at least SPM qualification (or equivalent)</Text>
            <Text style={styles.bullet}>• Must be at least 18 years old</Text>
            <Text style={styles.bullet}>• Interest in conservation, biodiversity & eco-tourism</Text>
            <Text style={styles.bullet}>• Physically fit for outdoor guiding activities</Text>
            <Text style={styles.bullet}>• Good communication skills in English & Bahasa Malaysia</Text>
          </View>
          <Text style={styles.noteText}>
            Your application will be reviewed by the Sarawak Forestry Corporation admin team.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Create Your Account</Text>
            <View style={styles.divider} />
            <Text style={styles.sectionSubtitle}>Please fill in all required details</Text>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} placeholder="e.g. johnparkguide" value={formData.username} onChangeText={(text) => handleInputChange('username', text)} autoCapitalize="none" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="Minimum 6 characters" value={formData.password} onChangeText={(text) => handleInputChange('password', text)} secureTextEntry />

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="As per IC" value={formData.fullName} onChangeText={(text) => handleInputChange('fullName', text)} />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} placeholder="e.g. 012-3456789" value={formData.phoneNumber} onChangeText={(text) => handleInputChange('phoneNumber', text)} keyboardType="phone-pad" />

          <Text style={styles.label}>Email Address</Text>
          <TextInput style={styles.input} placeholder="e.g. youremail@gmail.com" value={formData.email} onChangeText={(text) => handleInputChange('email', text)} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Resume (PDF)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickResume}>
            <Text style={styles.uploadButtonText}>
              {resumeFile ? `📄 ${resumeFile.name}` : '📤 Tap to upload your resume (PDF only)'}
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

      {/* Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        statusBarTranslucent={true}
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
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.lightBeige },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.deepestGreen,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: 40,
    marginHorizontal: -20,
    marginBottom: 30,
  },
  treeEmoji: { fontSize: 90, marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: COLORS.lightBeige, textAlign: 'center' },
  headerSubtitle: { fontSize: 16, color: COLORS.sage, marginTop: 8, textAlign: 'center', padding: 20 },

  requirementsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  requirementsTitle: { fontSize: 20, fontWeight: '700', color: COLORS.olive, marginBottom: 12 },
  bullet: { fontSize: 15, color: COLORS.darkGreen, marginBottom: 8, lineHeight: 22 },
  noteText: { fontSize: 13, color: COLORS.brown, fontStyle: 'italic', marginTop: 12, textAlign: 'center' },

  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sectionHeader: { alignItems: 'center', marginBottom: 28 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: COLORS.deepestGreen },
  divider: { width: 70, height: 4, backgroundColor: COLORS.olive, marginVertical: 12, borderRadius: 3 },
  sectionSubtitle: { fontSize: 15, color: COLORS.brown, textAlign: 'center' },

  label: { fontSize: 16, fontWeight: '600', color: COLORS.deepestGreen, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: COLORS.lightBeige,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.deepestGreen,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: COLORS.sage,
  },
  uploadButton: {
    backgroundColor: COLORS.beige,
    borderRadius: 16,
    paddingVertical: 30,
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.olive,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  uploadButtonText: { fontSize: 16.5, fontWeight: '600', color: COLORS.olive, textAlign: 'center', lineHeight: 24, padding: 50 },
  errorText: { color: COLORS.errorRed, fontSize: 15, fontWeight: '600', textAlign: 'center', marginVertical: 12 },

  submitButton: { backgroundColor: COLORS.olive, borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { backgroundColor: COLORS.sage },
  submitButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: 15, color: COLORS.darkGreen },
  loginLinkHighlight: { color: COLORS.brown, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '88%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 21, fontWeight: '700', color: COLORS.deepestGreen, marginBottom: 14, textAlign: 'center' },
  modalMessage: { fontSize: 16, color: COLORS.darkGreen, textAlign: 'center', lineHeight: 24, marginBottom: 28 },
  modalButton: {
    backgroundColor: COLORS.olive,
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 12,
  },
  modalButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

export default RegisterScreen;