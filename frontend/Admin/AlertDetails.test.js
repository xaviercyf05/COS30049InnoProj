import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AlertDetail from './AlertDetail';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateAlertStatus } from './evidenceApi';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../components/AppSidebarChrome.js', () => ({
  withSidebarChrome: (Component) => Component,
}));

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: jest.fn(() => ({})),
}));

jest.mock('./evidenceApi.js', () => ({
  updateAlertStatus: jest.fn(),
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockRoute = {
  params: {
    alert: {
      id: '123',
      name: 'Test Alert',
      sourceLabel: 'Test Source',
      status: 'Test Status',
      sourceType: 'esp32-sensor-log',
      deviceId: 'esp32-001',
      timestamp: '2026-05-24',
      latitude: 12.34,
      longitude: 56.78,
      labels: { type: 'motion' },
      videoUrl: 'http://example.com/video.mp4',
      resolved: false,
      canUpdateStatus: true,
    },
  },
};

const mockNavigation = {};

describe('AlertDetail Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('mock-token');
  });

  it('renders alert details correctly', async () => {
    const { getByText } = render(<AlertDetail route={mockRoute} navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
      expect(getByText('Test Source')).toBeTruthy();
      expect(getByText('Test Status')).toBeTruthy();
      expect(getByText('esp32-001')).toBeTruthy();
      expect(getByText('2026-05-24')).toBeTruthy();
      expect(getByText('12.34, 56.78')).toBeTruthy();
    });
  });

  it('toggles resolved status when button is clicked', async () => {
    updateAlertStatus.mockResolvedValueOnce({});
    const { getByText } = render(<AlertDetail route={mockRoute} navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Mark Solved')).toBeTruthy();
    });

    fireEvent.press(getByText('Mark Solved'));

    await waitFor(() => {
      expect(updateAlertStatus).toHaveBeenCalledWith(expect.any(Object), true);
    });
  });

  it('reverts status and shows alert on update failure', async () => {
    updateAlertStatus.mockRejectedValueOnce(new Error('Network Error'));
    const { getByText } = render(<AlertDetail route={mockRoute} navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Mark Solved')).toBeTruthy();
    });

    fireEvent.press(getByText('Mark Solved'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Update failed', 'Network Error');
    });
  });
});