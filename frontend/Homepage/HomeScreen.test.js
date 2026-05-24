import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './HomeScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(),
}));

describe('HomeScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all main elements correctly', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    expect(getByText('Training Modules')).toBeTruthy();
    expect(getByText('Grade 1')).toBeTruthy();
    expect(getByText('Grade 2')).toBeTruthy();
    expect(getByText('Grade 3')).toBeTruthy();
    expect(getByText('Log Out')).toBeTruthy();
  });

  test('navigates to Grade 1 module', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Grade 1'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Module',
      { grade: 'Grade 1' }
    );
  });

  test('navigates to Grade 2 module', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Grade 2'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Module',
      { grade: 'Grade 2' }
    );
  });

  test('navigates to Grade 3 module', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Grade 3'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Module',
      { grade: 'Grade 3' }
    );
  });

  test('shows logout confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Log Out'));

    expect(alertSpy).toHaveBeenCalled();
  });

  test('logs out successfully', async () => {
    AsyncStorage.removeItem.mockResolvedValueOnce();

    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons[1].onPress();
    });

    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Log Out'));

    await waitFor(() => {
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('auth_token');

      expect(mockNavigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });
  });

  test('shows error alert if logout fails', async () => {
    AsyncStorage.removeItem.mockRejectedValueOnce(new Error('Failed'));

    const alertSpy = jest.spyOn(Alert, 'alert');

    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      if (buttons && buttons[1]) {
        buttons[1].onPress();
      }
    });

    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('Log Out'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Unable to log out right now. Please try again.'
      );
    });
  });
});