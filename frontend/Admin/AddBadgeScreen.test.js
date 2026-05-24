import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AddBadgeScreen from './AddBadgeScreen';
import { requestProfileApi } from '../Profile/profileApi';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi', () => ({
  requestProfileApi: jest.fn(),
}));

// Mock the role guard high-order component to just return the internal screen
jest.mock('../auth/withRoleGuard.js', () => {
  return (Component) => (props) => <Component {...props} />;
});

describe('AddBadgeScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
  };

  const mockModulesResponse = {
    data: [
      { moduleId: 101, title: 'Bako National Park Overview' },
      { moduleId: 102, title: 'Maludam Park Guide Training' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    AsyncStorage.getItem.mockResolvedValue('fake-mock-token');
  });

  it('renders loading state initially and then displays the loaded modules', async () => {
    requestProfileApi.mockResolvedValueOnce(mockModulesResponse);

    const { getByText, queryByText } = render(<AddBadgeScreen navigation={mockNavigation} />);

    // Check if loading indicators appear initially
    expect(getByText('Loading modules...')).toBeTruthy();

    // Wait for the API call to resolve and modules to render
    await waitFor(() => {
      expect(queryByText('Loading modules...')).toBeNull();
      expect(getByText('Bako National Park Overview')).toBeTruthy();
      expect(getByText('Maludam Park Guide Training')).toBeTruthy();
    });
  });

  it('shows an alert when trying to submit without a badge name', async () => {
    requestProfileApi.mockResolvedValueOnce(mockModulesResponse);
    const { getByText } = render(<AddBadgeScreen navigation={mockNavigation} />);

    await waitFor(() => expect(getByText('Bako National Park Overview')).toBeTruthy());

    // Trigger submit with empty badge name
    fireEvent.press(getByText('+ Create Badge'));

    expect(Alert.alert).toHaveBeenCalledWith('Missing details', 'Please enter a badge name.');
  });

  it('shows an alert when trying to submit without selecting any modules', async () => {
    requestProfileApi.mockResolvedValueOnce(mockModulesResponse);
    const { getByText, getByPlaceholderText } = render(<AddBadgeScreen navigation={mockNavigation} />);

    await waitFor(() => expect(getByText('Bako National Park Overview')).toBeTruthy());

    // Enter badge name but don't select modules
    fireEvent.changeText(getByPlaceholderText('Badge Name (e.g. Bako National Park)'), 'Senior Ranger Badge');
    fireEvent.press(getByText('+ Create Badge'));

    expect(Alert.alert).toHaveBeenCalledWith('Missing details', 'Please select at least one module to link this badge with.');
  });

  it('toggles module selection and successfully submits form data', async () => {
    requestProfileApi.mockResolvedValueOnce(mockModulesResponse);
    requestProfileApi.mockResolvedValueOnce({ success: true }); // For the POST request

    const { getByText, getByPlaceholderText } = render(<AddBadgeScreen navigation={mockNavigation} />);

    await waitFor(() => expect(getByText('Bako National Park Overview')).toBeTruthy());

    // Fill details
    fireEvent.changeText(getByPlaceholderText('Badge Name (e.g. Bako National Park)'), 'Bako Specialist Badge');
    fireEvent.changeText(getByPlaceholderText('e.g. 12'), '24');

    // Select the first module option
    fireEvent.press(getByText('Bako National Park Overview'));

    // Submit form
    fireEvent.press(getByText('+ Create Badge'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/badges',
        'fake-mock-token',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            name: 'Bako Specialist Badge',
            validityMonths: 24,
            linkedModuleIds: [101],
            linkedModuleName: 'Bako National Park Overview',
          }),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('handles backend API errors elegantly on submission', async () => {
    requestProfileApi.mockResolvedValueOnce(mockModulesResponse);
    requestProfileApi.mockRejectedValueOnce(new Error('Network Gateway Timeout'));

    const { getByText, getByPlaceholderText } = render(<AddBadgeScreen navigation={mockNavigation} />);

    await waitFor(() => expect(getByText('Bako National Park Overview')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('Badge Name (e.g. Bako National Park)'), 'Faulty Badge');
    fireEvent.press(getByText('Bako National Park Overview'));
    fireEvent.press(getByText('+ Create Badge'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Create failed', 'Network Gateway Timeout');
    });
  });
});