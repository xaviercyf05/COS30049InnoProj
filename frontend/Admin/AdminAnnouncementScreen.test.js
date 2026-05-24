import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AdminAnnouncementScreen from './AdminAnnouncementScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
}));

jest.mock('../auth/withRoleGuard', () => (Component) => Component);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

describe('AdminAnnouncementScreen', () => {
  const mockNavigation = {
    addListener: jest.fn(() => jest.fn()),
    canGoBack: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const sampleAnnouncements = [
    {
      id: '1',
      title: 'First Update',
      teaser: 'Short teaser text',
      fullDesc: 'Complete description details',
      posted: '25 May 2026, 10:00 AM',
      avatarLabel: 'AN',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('fake-token');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders loading state and then loads announcements successfully', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: sampleAnnouncements });

    const { getByText, queryByText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    expect(getByText('Loading announcements...')).toBeTruthy();

    await waitFor(() => {
      expect(getByText('First Update')).toBeTruthy();
      expect(getByText('Short teaser text')).toBeTruthy();
    });

    expect(queryByText('Loading announcements...')).toBeNull();
  });

  it('handles navigation back fallback correctly', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: [] });
    mockNavigation.canGoBack.mockReturnValueOnce(false);

    const { getByText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    const backButton = getByText('< Back');
    fireEvent.press(backButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Home');
  });

  it('handles standard stack navigation back', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: [] });
    mockNavigation.canGoBack.mockReturnValueOnce(true);

    const { getByText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    const backButton = getByText('< Back');
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('expands and collapses announcement details on card press', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: sampleAnnouncements });

    const { getByText, queryByText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('First Update')).toBeTruthy());

    const card = getByText('First Update');
    fireEvent.press(card);

    expect(getByText('Complete description details')).toBeTruthy();
    expect(queryByText('Short teaser text')).toBeNull();

    fireEvent.press(card);
    expect(getByText('Short teaser text')).toBeTruthy();
  });

  it('creates a new announcement successfully', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ data: sampleAnnouncements });

    const { getByText, getByPlaceholderText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('+ Create New Announcement')).toBeTruthy());

    fireEvent.press(getByText('+ Create New Announcement'));

    fireEvent.changeText(getByPlaceholderText('Announcement title'), 'New Title');
    fireEvent.changeText(getByPlaceholderText('Short teaser'), 'New Teaser');
    fireEvent.changeText(getByPlaceholderText('Full description'), 'New Description');

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/announcements',
        'fake-token',
        expect.objectContaining({
          method: 'POST',
          body: {
            title: 'New Title',
            content: 'New Description',
            targetRole: 'All',
          },
        })
      );
    });
  });

  it('edits an existing announcement successfully', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: sampleAnnouncements })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ data: sampleAnnouncements });

    const { getByText, getByPlaceholderText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('Edit')).toBeTruthy());

    fireEvent.press(getByText('Edit'));

    fireEvent.changeText(getByPlaceholderText('Announcement title'), 'Updated Title');
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/announcements/1',
        'fake-token',
        expect.objectContaining({
          method: 'PUT',
          body: {
            title: 'Updated Title',
            teaser: 'Short teaser text',
            fullDesc: 'Complete description details',
            targetRole: 'All',
          },
        })
      );
    });
  });

  it('triggers delete flow and triggers removal upon confirm selection', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: sampleAnnouncements });

    const { getByText } = render(
      <AdminAnnouncementScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('Delete')).toBeTruthy());

    fireEvent.press(getByText('Delete'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      expect.any(Array)
    );

    const deleteActionHandler = Alert.alert.mock.calls[0][2][1].onPress;
    
    requestProfileApi.mockResolvedValueOnce({ success: true });
    
    await act(async () => {
      await deleteActionHandler();
    });

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/admin/announcements/1',
      'fake-token',
      { method: 'DELETE' }
    );
  });

  it('shows error notice when session token is missing', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    requestProfileApi.mockResolvedValueOnce({ data: [] });

    render(<AdminAnnouncementScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to load announcements',
        'Session expired. Please log in again.'
      );
    });
  });
});