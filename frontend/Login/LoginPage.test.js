import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import LoginPage from './LoginPage';

global.fetch = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Switch = (props) => {
    const View = RN.View;
    return <View testID={props.testID} accessibilityLabel={props.accessibilityLabel} {...props} />;
  };
  return RN;
});

jest.mock('../auth/passkeyClient.js', () => ({
  createPasskey: jest.fn(),
  getPasskey: jest.fn(),
  supportsPasskeys: jest.fn(() => true),
}));

describe('LoginPage', () => {
  const navigation = {
    reset: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockReset();
  });

  test('shows password login first and reveals other methods on demand', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<LoginPage navigation={navigation} />);

    expect(getByText('Sign In')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Login with other methods')).toBeTruthy();
    expect(queryByText('Email code')).toBeNull();
    expect(queryByText('Recovery code')).toBeNull();
    expect(queryByText('Passkey')).toBeNull();

    fireEvent.press(getByText('Login with other methods'));

    await waitFor(() => {
      expect(getByText('Email code')).toBeTruthy();
      expect(getByText('Recovery code')).toBeTruthy();
      expect(getByText('Passkey')).toBeTruthy();
    });
  });

  test('shows an error when an unavailable alternate method is selected', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          methods: {
            password: true,
            emailCode: true,
            recoveryCode: false,
            passkey: true,
          },
        },
      }),
    });

    const { getByText, getByPlaceholderText, findByText } = render(<LoginPage navigation={navigation} />);

    fireEvent.changeText(getByPlaceholderText('Username, email, or User ID'), 'sarawak_ranger');
    fireEvent.press(getByText('Login with other methods'));
    fireEvent.press(getByText('Recovery code'));

    expect(await findByText('Recovery code sign-in is not enabled for this account.')).toBeTruthy();
  });
});
