import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import RegisterScreen from './RegisterScreen';
import SubmissionScreen from './SubmissionScreen';

// Mocking Expo Document Picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// Mocking useSafeAreaInsets
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 20, left: 0, right: 0, bottom: 0 }),
}));

// Mocking global fetch for API calls
global.fetch = jest.fn();

describe('Park Guide Application Flow Suite', () => {
  let mockNavigation;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
    };
  });


  // REGISTER SCREEN TESTS
  describe('RegisterScreen Tests', () => {
    it('renders all structural registration form elements correctly', () => {
      const { getByText, getByPlaceholderText } = render(
        <RegisterScreen navigation={mockNavigation} />
      );

      expect(getByText('Park Guide Registration')).toBeTruthy();
      expect(getByPlaceholderText('e.g. johnparkguide')).toBeTruthy();
      expect(getByPlaceholderText('Minimum 8 characters')).toBeTruthy();
      expect(getByText('Tap to upload your resume (PDF only)')).toBeTruthy();
    });

    it('triggers inline validation when submitting an empty form', async () => {
      const { getByText } = render(<RegisterScreen navigation={mockNavigation} />);
      
      const submitButton = getByText('Submit Application');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText('Username is required.')).toBeTruthy();
      });
    });

    it('successfully uploads a document via picker and updates text', async () => {
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ name: 'test_resume.pdf', uri: 'mock-uri', mimeType: 'application/pdf' }],
      });

      const { getByText } = render(<RegisterScreen navigation={mockNavigation} />);
      const uploadButton = getByText('Tap to upload your resume (PDF only)');
      
      fireEvent.press(uploadButton);

      await waitFor(() => {
        expect(getByText('Selected: test_resume.pdf')).toBeTruthy();
      });
    });

    it('submits registration successfully and transitions navigation via modal confirmation', async () => {
      // Mock document pickup
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ name: 'my_bio.pdf', uri: 'file://path/res.pdf', mimeType: 'application/pdf' }],
      });

      // Mock registration endpoint response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, message: 'Success' }),
      });

      const { getByText, getByPlaceholderText } = render(
        <RegisterScreen navigation={mockNavigation} />
      );

      // Populate text inputs
      fireEvent.changeText(getByPlaceholderText('e.g. johnparkguide'), 'guidedev');
      fireEvent.changeText(getByPlaceholderText('Minimum 8 characters'), 'securePass123');
      fireEvent.changeText(getByPlaceholderText('Re-enter your password'), 'securePass123');
      fireEvent.changeText(getByPlaceholderText('As per IC'), 'John Doe');
      fireEvent.changeText(getByPlaceholderText('e.g. 012-3456789'), '0123456789');
      fireEvent.changeText(getByPlaceholderText('e.g. youremail@gmail.com'), 'john@example.com');

      // Upload file attachment
      fireEvent.press(getByText('Tap to upload your resume (PDF only)'));
      await waitFor(() => expect(getByText('Selected: my_bio.pdf')).toBeTruthy());

      // Submit Form
      fireEvent.press(getByText('Submit Application'));

      // Verify success popup confirmation modal displays
      await waitFor(() => {
        expect(getByText('Application Submitted')).toBeTruthy();
      });

      // Close modal and verify redirection step triggers
      fireEvent.press(getByText('OK'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Submission');
    });
  });

  // SUBMISSION SCREEN TESTS
  describe('SubmissionScreen Tests', () => {
    it('renders successful submission UI and informative cards', () => {
      const { getByText } = render(<SubmissionScreen navigation={mockNavigation} />);

      expect(getByText('Thank You')).toBeTruthy();
      expect(getByText('Your Park Guide application has been submitted successfully.')).toBeTruthy();
      expect(getByText('What Happens Next?')).toBeTruthy();
      expect(getByText(/You'll receive a verification email/i)).toBeTruthy();
    });

    it('navigates cleanly back to Registration screen to run alternative applications', () => {
      const { getByText } = render(<SubmissionScreen navigation={mockNavigation} />);
      
      const registerAnotherButton = getByText('Register Another Account');
      fireEvent.press(registerAnotherButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
    });

    it('routes successfully to login interface upon command pointer action', () => {
      const { getByText } = render(<SubmissionScreen navigation={mockNavigation} />);
      
      const loginButton = getByText('Go to Login');
      fireEvent.press(loginButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
    });

    it('triggers standard pop structural screen historical rollback patterns on header back click', () => {
      const { getByText } = render(<SubmissionScreen navigation={mockNavigation} />);
      
      const backButton = getByText('< Back');
      fireEvent.press(backButton);

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});