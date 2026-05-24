import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BadgeManagementScreen from './BadgeManagementScreen';
import { requestProfileApi } from '../Profile/profileApi';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../auth/withRoleGuard.js', () => jest.fn((Component) => Component));

jest.mock('../Profile/profileApi.js', () => ({
  pickProfileImagePath: jest.fn(),
  resolveProfileImageUri: jest.fn(),
  requestProfileApi: jest.fn(),
}));

describe('BadgeManagementScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') {
        callback();
      }
      return jest.fn();
    }),
  };

  const mockCurrentProfile = {
    viewerRole: 'Admin',
    fullName: 'Test Admin',
  };

  const mockBadgesResponse = {
    data: [
      {
        id: '1',
        name: 'Gold Badge',
        unlocked: true,
        image: 'https://example.com/gold.png',
        validityMonths: 12,
        linkedModuleIds: ['m1'],
        linkedModuleNames: ['Module 1'],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('mock-token');
    requestProfileApi.mockResolvedValue(mockBadgesResponse);
  });

  it('renders badges correctly after loading', async () => {
    const { getByText, queryByText } = render(
      <BadgeManagementScreen navigation={mockNavigation} currentProfile={mockCurrentProfile} />
    );

    expect(getByText('Loading badges...')).toBeTruthy();

    await waitFor(() => {
      expect(queryByText('Loading badges...')).toBeNull();
    });

    expect(getByText('Badge Management')).toBeTruthy();
    expect(getByText('Gold Badge')).toBeTruthy();
    expect(getByText('Validity: 12 month(s)')).toBeTruthy();
    expect(getByText('Linked Module: Module 1')).toBeTruthy();
  });

  it('navigates to AddBadge screen when add button is clicked', async () => {
    const { getByText } = render(
      <BadgeManagementScreen navigation={mockNavigation} currentProfile={mockCurrentProfile} />
    );

    await waitFor(() => {
      expect(getByText('Gold Badge')).toBeTruthy();
    });

    fireEvent.press(getByText('+ Add Badge'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AddBadge');
  });

  it('opens menu and navigates to EditBadge screen', async () => {
    const { getByText } = render(
      <BadgeManagementScreen navigation={mockNavigation} currentProfile={mockCurrentProfile} />
    );

    await waitFor(() => {
      expect(getByText('Gold Badge')).toBeTruthy();
    });

    fireEvent.press(getByText('...'));
    fireEvent.press(getByText('Edit'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EditBadge', {
      badge: {
        id: '1',
        name: 'Gold Badge',
        unlocked: true,
        image: 'https://example.com/gold.png',
        validityMonths: 12,
        linkedModuleId: null,
        linkedModuleName: '',
        linkedModuleIds: ['m1'],
        linkedModuleNames: ['Module 1'],
      },
    });
  });

  it('opens menu and deletes badge successfully', async () => {
    requestProfileApi
      .mockResolvedValueOnce(mockBadgesResponse)
      .mockResolvedValueOnce({});

    const { getByText, queryByText } = render(
      <BadgeManagementScreen navigation={mockNavigation} currentProfile={mockCurrentProfile} />
    );

    await waitFor(() => {
      expect(getByText('Gold Badge')).toBeTruthy();
    });

    fireEvent.press(getByText('...'));
    fireEvent.press(getByText('Delete'));

    expect(getByText('Delete badge?')).toBeTruthy();

    fireEvent.press(getByText('Delete'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith('/api/v1/admin/badges/1', 'mock-token', {
        method: 'DELETE',
      });
    });

    expect(queryByText('Gold Badge')).toBeNull();
  });

  it('handles empty badges array or error gracefully', async () => {
    requestProfileApi.mockRejectedValue(new Error('Network error'));

    const { getByText, queryByText } = render(
      <BadgeManagementScreen navigation={mockNavigation} currentProfile={mockCurrentProfile} />
    );

    await waitFor(() => {
      expect(queryByText('Loading badges...')).toBeNull();
    });

    expect(getByText('Badge Management')).toBeTruthy();
  });
});