import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AdminRegistrationManagementScreen from './AdminRegistrationManagementScreen';
import { requestProfileApi } from '../Profile/profileApi.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

jest.mock('../Profile/profileApi.js', () => ({
  API_ORIGIN: 'https://api.test.com',
  getApiBaseUrls: jest.fn(() => ['https://api.test.com']),
  requestProfileApi: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../auth/withRoleGuard', () => (Component) => Component);

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 20, left: 0, right: 0, bottom: 0 }),
  };
});

const mockNavigation = {
  addListener: jest.fn((event, callback) => {
    if (event === 'focus') {
      callback();
    }
    return jest.fn();
  }),
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const mockApplications = [
  {
    id: '1',
    fullName: 'John Doe',
    status: 'pending',
    username: 'johndoe',
    phoneNumber: '1234567890',
    email: 'john@test.com',
    resumeName: 'john_resume.pdf',
  },
  {
    id: '2',
    fullName: 'Jane Smith',
    status: 'approved',
    username: 'janesmith',
    phoneNumber: '0987654321',
    email: 'jane@test.com',
    resumeName: 'jane_resume.pdf',
  },
];

describe('AdminRegistrationManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('mock-token');
    Platform.OS = 'ios';
  });

  it('renders loading state and then lists applications with summaries', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: mockApplications });

    const { getByText, queryByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(queryByText('Loading registration applications...')).toBeNull();
    });

    expect(getByText('Registration Management')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('PENDING')).toBeTruthy();
    expect(getByText('APPROVED')).toBeTruthy();
  });

  it('handles navigation back press', async () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    requestProfileApi.mockResolvedValueOnce({ data: [] });

    const { getByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('< Back')).toBeTruthy();
    });

    const backButton = getByText('< Back');
    fireEvent.press(backButton);

    expect(mockNavigation.canGoBack).toHaveBeenCalled();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('updates status to approved when approve button is pressed', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: mockApplications })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ data: [] });

    const { getByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('John Doe')).toBeTruthy());

    const approveButton = getByText('Approve');
    fireEvent.press(approveButton);

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/registrations/1/status',
        'mock-token',
        { method: 'PUT', body: { status: 'approved' } }
      );
    });

    await waitFor(() => {
      expect(getByText('Application Approved')).toBeTruthy();
    });
  });

  it('resends verification token when resend button is pressed', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: mockApplications })
      .mockResolvedValueOnce({});

    const { getByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('Jane Smith')).toBeTruthy());

    const resendButton = getByText('Resend Token');
    fireEvent.press(resendButton);

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/registrations/2/resend-token',
        'mock-token',
        { method: 'POST' }
      );
    });

    await waitFor(() => {
      expect(getByText('Token Resent')).toBeTruthy();
    });
  });

  it('shows mobile warning message when opening resume on mobile platforms', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: mockApplications });
    
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: jest.fn().mockResolvedValueOnce({})
    });

    const { getAllByText, getByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getAllByText('Open Resume')[0]).toBeTruthy());

    fireEvent.press(getAllByText('Open Resume')[0]);

    await waitFor(() => {
      expect(getByText('Resume Ready')).toBeTruthy();
    });
  });

  it('shows error modal if authentication token is missing', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    requestProfileApi.mockResolvedValueOnce({ data: [] });

    const { getByText } = render(
      <AdminRegistrationManagementScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Unable to load applications')).toBeTruthy();
    });
  });
});