import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AlertHistory from './AlertOverview';
import { fetchAdminEvidenceAlerts, updateAlertStatus } from './evidenceApi';
import { Alert } from 'react-native';

jest.mock('./evidenceApi', () => ({
  fetchAdminEvidenceAlerts: jest.fn(),
  updateAlertStatus: jest.fn(),
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockAlerts = [
  {
    id: '1',
    name: 'Intrusion Alert',
    timestamp: '2026-05-24 10:00',
    sourceLabel: 'Camera 1',
    status: 'Motion detected',
    resolved: false,
  },
  {
    id: '2',
    name: 'Fire Alert',
    timestamp: '2026-05-24 11:00',
    sourceLabel: 'Sensor 2',
    status: 'Smoke detected',
    resolved: true,
  },
];

const mockNavigation = {
  addListener: jest.fn((event, callback) => {
    if (event === 'focus') {
      callback();
    }
    return () => {};
  }),
  navigate: jest.fn(),
};

describe('AlertHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchAdminEvidenceAlerts.mockResolvedValue({ alerts: mockAlerts, error: '' });
  });

  it('renders loading state and then lists alerts', async () => {
    const { getByText, queryByText } = render(<AlertHistory navigation={mockNavigation} />);

    expect(getByText('Loading evidence alerts')).toBeTruthy();

    await waitFor(() => {
      expect(queryByText('Loading evidence alerts')).toBeNull();
      expect(getByText('Intrusion Alert')).toBeTruthy();
      expect(getByText('Fire Alert')).toBeTruthy();
    });

    expect(getByText('Total Alerts')).toBeTruthy();
  });

  it('filters alerts by status', async () => {
    const { getByText, queryByText } = render(<AlertHistory navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Intrusion Alert')).toBeTruthy();
    });

    fireEvent.press(getByText('Solved'));
    expect(getByText('Fire Alert')).toBeTruthy();
    expect(queryByText('Intrusion Alert')).toBeNull();

    fireEvent.press(getByText('Unsolved'));
    expect(getByText('Intrusion Alert')).toBeTruthy();
    expect(queryByText('Fire Alert')).toBeNull();
  });

  it('navigates to details on clicking View Details', async () => {
    const { getAllByText } = render(<AlertHistory navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getAllByText('View Details').length).toBe(2);
    });

    fireEvent.press(getAllByText('View Details')[0]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AlertDetail', { alert: mockAlerts[0] });
  });

  it('toggles resolved status successfully', async () => {
    updateAlertStatus.mockResolvedValueOnce({});
    const { getAllByText, getByText } = render(<AlertHistory navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Intrusion Alert')).toBeTruthy();
    });

    fireEvent.press(getAllByText('Mark Solved')[0]);

    await waitFor(() => {
      expect(updateAlertStatus).toHaveBeenCalledWith(mockAlerts[0], true);
    });
  });

  it('handles toggle resolution failure and reverts state', async () => {
    updateAlertStatus.mockRejectedValueOnce(new Error('Update Error'));
    const { getAllByText, getByText } = render(<AlertHistory navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Intrusion Alert')).toBeTruthy();
    });

    fireEvent.press(getAllByText('Mark Solved')[0]);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Update failed', 'Update Error');
    });
  });

  it('displays error message when fetching fails', async () => {
    fetchAdminEvidenceAlerts.mockResolvedValueOnce({ alerts: [], error: 'Fetch Failed' });
    const { getByText } = render(<AlertHistory navigation={mockNavigation} />);

    await waitFor(() => {
      expect(getByText('Unable to load evidence')).toBeTruthy();
      expect(getByText('Fetch Failed')).toBeTruthy();
    });
  });
});