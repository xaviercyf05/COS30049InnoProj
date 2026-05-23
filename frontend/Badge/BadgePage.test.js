import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import BadgeScreen from './BadgePage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestProfileApi,
  pickProfileImagePath,
  resolveProfileImageUri,
} from '../Profile/profileApi';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

// Mock API
jest.mock('../Profile/profileApi', () => ({
  requestProfileApi: jest.fn(),
  pickProfileImagePath: jest.fn(),
  resolveProfileImageUri: jest.fn(),
}));

// Mock role guard
jest.mock('../auth/withRoleGuard', () => {
  return (Component) => Component;
});

describe('BadgeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockProfile = {
    fullName: 'John Doe',
    username: 'john123',
  };

  test('renders loading state', () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockImplementation(
      () =>
        new Promise(() => {
          // keep loading state active
        })
    );

    const { getByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(getByText('Loading badges...')).toBeTruthy();
  });

  test('renders user profile info', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    pickProfileImagePath.mockReturnValue(null);

    const { findByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(await findByText('John Doe')).toBeTruthy();
    expect(await findByText('0 / 0 badges earned')).toBeTruthy();
  });

  test('renders badges from API', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Explorer Badge',
          earned: true,
          unlocked: true,
          validityMonths: 12,
          linkedModuleName: 'Forest Training',
          image: 'badge-image.png',
        },
      ],
    });

    const { findByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(await findByText('Explorer Badge')).toBeTruthy();

    expect(
      await findByText('Validity: 12 month(s)')
    ).toBeTruthy();

    expect(
      await findByText(
        'Linked Module: Forest Training'
      )
    ).toBeTruthy();
  });

  test('shows empty badge state', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    const { findByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(
      await findByText('0 / 0 badges earned')
    ).toBeTruthy();
  });

  test('shows default user name when profile missing', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockResolvedValue({
      data: [],
    });

    const { findByText } = render(
      <BadgeScreen />
    );

    expect(await findByText('User')).toBeTruthy();
  });

  test('handles API failure gracefully', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    requestProfileApi.mockRejectedValue(
      new Error('API Error')
    );

    const { findByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(
      await findByText('0 / 0 badges earned')
    ).toBeTruthy();
  });

  test('handles missing auth token', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const { findByText } = render(
      <BadgeScreen currentProfile={mockProfile} />
    );

    expect(
      await findByText('0 / 0 badges earned')
    ).toBeTruthy();
  });
});