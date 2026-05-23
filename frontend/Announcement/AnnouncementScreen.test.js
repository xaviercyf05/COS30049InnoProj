// Announcement/AnnouncementScreen.test.js
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import AnnouncementScreen from './AnnouncementScreen';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('fake-token')),
}));

jest.mock('../Profile/profileApi', () => ({
  requestProfileApi: jest.fn(),
}));

jest.mock('../auth/withRoleGuard', () => (Component) => (props) => <Component {...props} />);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0 }),
}));

// FIXED Navigation Mock
const mockNavigation = {
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  navigate: jest.fn(),
  addListener: jest.fn(() => jest.fn()), // Returns a function (cleanup)
};

const mockAnnouncements = [
  {
    id: 1,
    title: "New Training Module Released",
    teaser: "Check out the latest updates...",
    fullDesc: "Full description here.",
    posted: "2026-05-20",
    avatarLabel: "NT",
  },
];

describe('AnnouncementScreen - Key Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<AnnouncementScreen navigation={mockNavigation} />);
    expect(screen.getByText('Loading announcements...')).toBeTruthy();
  });

  it('renders announcements successfully', async () => {
    const { requestProfileApi } = require('../Profile/profileApi');
    requestProfileApi.mockResolvedValue({ data: mockAnnouncements });

    render(<AnnouncementScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('New Training Module Released')).toBeTruthy();
    });
  });

  it('can expand announcement card', async () => {
    const { requestProfileApi } = require('../Profile/profileApi');
    requestProfileApi.mockResolvedValue({ data: mockAnnouncements });

    render(<AnnouncementScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('New Training Module Released')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('New Training Module Released'));

    await waitFor(() => {
      expect(screen.getByText('Full description here.')).toBeTruthy();
    });
  });

  it('shows empty state', async () => {
    const { requestProfileApi } = require('../Profile/profileApi');
    requestProfileApi.mockResolvedValue({ data: [] });

    render(<AnnouncementScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('No announcements available right now.')).toBeTruthy();
    });
  });

  it('handles back button', async () => {
    const { requestProfileApi } = require('../Profile/profileApi');
    requestProfileApi.mockResolvedValue({ data: [] });

    render(<AnnouncementScreen navigation={mockNavigation} />);

    await waitFor(() => {
      fireEvent.press(screen.getByText('< Back'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});