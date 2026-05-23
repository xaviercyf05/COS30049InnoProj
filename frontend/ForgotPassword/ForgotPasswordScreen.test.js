import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from './ForgotPasswordScreen';

// Mock API file
jest.mock('../Profile/profileApi.js', () => ({
  API_ORIGIN: 'http://localhost:3000',
  getApiBaseUrls: jest.fn(() => ['http://localhost:3000']),
}));

// Mock styles
jest.mock('../Login/LoginPageStyle.js', () => ({
  styles: {
    mainContainer: {},
    backgroundGlowTop: {},
    backgroundGlowBottom: {},
    backgroundAccentLeft: {},
    scrollContent: {},
    pageShell: {},
    heroPanel: {},
    title: {},
    subtitle: {},
    description: {},
    card: {},
    loginLabel: {},
    inputContainer: {},
    icon: {},
    input: {},
    inlineErrorText: {},
    helperText: {},
    loginButton: {},
    loginButtonDisabled: {},
    loginButtonText: {},
    registerLinkText: {},
    footer: {},
    securityBadge: {},
    footerText: {},
  },
}));

// Mock lucide icons
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  Mail: () => null,
  ShieldCheck: () => null,
}));

describe('ForgotPasswordScreen', () => {
  const navigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('renders screen correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    expect(getByText('Forgot Password')).toBeTruthy();
    expect(getByPlaceholderText('Email address')).toBeTruthy();
    expect(getByText('SEND RESET LINK')).toBeTruthy();
  });

  test('shows error when email is empty', async () => {
    const { getByText, findByText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    fireEvent.press(getByText('SEND RESET LINK'));

    expect(
      await findByText(
        'Please enter the email address linked to your account.'
      )
    ).toBeTruthy();
  });

  test('submits forgot password successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        message: 'Reset email sent successfully',
      }),
    });

    const { getByPlaceholderText, getByText, findByText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Email address'),
      'test@email.com'
    );

    fireEvent.press(getByText('SEND RESET LINK'));

    expect(
      await findByText('Reset email sent successfully')
    ).toBeTruthy();

    expect(global.fetch).toHaveBeenCalled();
  });

  test('shows API error message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        message: 'Email not found',
      }),
    });

    const { getByPlaceholderText, getByText, findByText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Email address'),
      'wrong@email.com'
    );

    fireEvent.press(getByText('SEND RESET LINK'));

    expect(await findByText('Email not found')).toBeTruthy();
  });

  test('shows server error when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    const { getByPlaceholderText, getByText, findByText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Email address'),
      'test@email.com'
    );

    fireEvent.press(getByText('SEND RESET LINK'));

    expect(
      await findByText(
        'Unable to reach the server. Please try again later.'
      )
    ).toBeTruthy();
  });

  test('navigates back to login screen', () => {
    const { getByText } = render(
      <ForgotPasswordScreen navigation={navigation} />
    );

    fireEvent.press(getByText('Back to sign in'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});