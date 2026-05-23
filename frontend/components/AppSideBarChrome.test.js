import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AppSidebarChrome from './AppSidebarChrome';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  Bell: () => null,
}));

jest.mock('../Profile/profileApi.js', () => ({
  pickProfileImagePath: jest.fn(() => null),
  resolveProfileImageUri: jest.fn(() => ''),
  requestProfileApi: jest.fn(() =>
    Promise.resolve({
      data: [],
    })
  ),
}));

describe('AppSidebarChrome', () => {
  const navigation = {
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  };

  const route = {
    name: 'Home',
    params: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard title', () => {
    const { getByText } = render(
      <AppSidebarChrome
        navigation={navigation}
        route={route}
      >
        <></>
      </AppSidebarChrome>
    );

    expect(getByText('Dashboard')).toBeTruthy();
  });

  test('shows SFC Training subtitle', () => {
    const { getByText } = render(
      <AppSidebarChrome
        navigation={navigation}
        route={route}
      >
        <></>
      </AppSidebarChrome>
    );

    expect(getByText(/SFC Training/i)).toBeTruthy();
  });
});