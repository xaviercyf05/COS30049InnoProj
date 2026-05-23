import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import AnnouncementScreen from './AnnouncementScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

// Mock API
jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
}));

// Mock role guard
jest.mock('../auth/withRoleGuard', () => {
  return (Component) => Component;
});

// Mock safe area
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  };
});

describe('AnnouncementScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state', () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockImplementation(
      () =>
        new Promise(() => {
          // keep loading state active
        })
    );

    const { getByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    expect(
      getByText('Loading announcements...')
    ).toBeTruthy();
  });

  test('renders announcements from API', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [
        {
          id: 1,
          title: 'System Maintenance',
          teaser: 'Short teaser',
          content: 'Full content',
          posted: '2026-05-23',
        },
      ],
    });

    const { findByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    expect(
      await findByText('System Maintenance')
    ).toBeTruthy();

    expect(await findByText('Short teaser')).toBeTruthy();
  });

  test('shows empty state when no announcements exist', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    const { findByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    expect(
      await findByText(
        'No announcements available right now.'
      )
    ).toBeTruthy();
  });

  test('expands announcement when pressed', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [
        {
          id: 1,
          title: 'Training Update',
          teaser: 'Tap to expand',
          content: 'This is full announcement content',
          posted: '2026-05-23',
        },
      ],
    });

    const { findByText, queryByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    const title = await findByText('Training Update');

    expect(
      queryByText('This is full announcement content')
    ).toBeNull();

    fireEvent.press(title);

    expect(
      await findByText(
        'This is full announcement content'
      )
    ).toBeTruthy();
  });

  test('goes back when back button is pressed', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    const { findByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    const backButton = await findByText('< Back');

    fireEvent.press(backButton);

    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('navigates home when cannot go back', async () => {
    navigation.canGoBack.mockReturnValue(false);

    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    const { findByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    const backButton = await findByText('< Back');

    fireEvent.press(backButton);

    expect(navigation.navigate).toHaveBeenCalledWith(
      'Home'
    );
  });

  test('handles API failure gracefully', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockRejectedValue(
      new Error('API Error')
    );

    const { findByText } = render(
      <AnnouncementScreen navigation={navigation} />
    );

    expect(
      await findByText(
        'No announcements available right now.'
      )
    ).toBeTruthy();
  });
});