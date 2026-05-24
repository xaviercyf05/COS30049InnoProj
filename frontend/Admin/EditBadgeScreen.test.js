import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EditBadgeScreen from './EditBadgeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
}));

jest.mock('../auth/withRoleGuard.js', () => (component) => component);

jest.spyOn(Alert, 'alert');

describe('EditBadgeScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
  };

  const mockBadge = {
    id: 'badge-123',
    name: 'Gold Badge',
    validityMonths: 12,
    image: 'http://example.com/image.png',
    linkedModuleIds: ['1'],
  };

  const mockRoute = {
    params: {
      badge: mockBadge,
    },
  };

  const mockModulesResponse = {
    data: [
      { id: '1', title: 'Module One' },
      { id: '2', title: 'Module Two' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('mock-token');
    requestProfileApi.mockResolvedValue(mockModulesResponse);
  });

  it('renders badge details and loaded modules correctly', async () => {
    const { getByText, getByDisplayValue } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    expect(getByDisplayValue('Gold Badge')).toBeTruthy();
    expect(getByDisplayValue('12')).toBeTruthy();

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
      expect(getByText('Module Two')).toBeTruthy();
    });
  });

  it('shows error state if no badge is provided in route parameters', () => {
    const { getByText } = render(
      <EditBadgeScreen route={{ params: {} }} navigation={mockNavigation} />
    );

    expect(getByText('Badge details are unavailable for editing.')).toBeTruthy();
    
    fireEvent.press(getByText('Go Back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('allows toggling module selections', async () => {
    const { getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    fireEvent.press(getByText('Module Two'));
    fireEvent.press(getByText('Module One'));
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/badges/badge-123',
        'mock-token',
        expect.objectContaining({
          body: expect.objectContaining({
            linkedModuleIds: [2],
            linkedModuleNames: ['Module Two'],
          }),
        })
      );
    });
  });

  it('validates empty badge name input on save', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    const nameInput = getByDisplayValue('Gold Badge');
    fireEvent.changeText(nameInput, '');
    
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Missing details', 'Please enter a badge name.');
    });
  });

  it('validates empty module selection on save', async () => {
    const { getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    fireEvent.press(getByText('Module One'));
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Missing details',
        'Please choose at least one module linked to this badge.'
      );
    });
  });

  it('validates invalid validity months input on save', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    const validityInput = getByDisplayValue('12');
    fireEvent.changeText(validityInput, '0');
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Invalid validity',
        'Badge validity must be a positive number of months.'
      );
    });
  });

  it('submits payload successfully and navigates back', async () => {
    requestProfileApi.mockImplementation((url, token, options) => {
      if (options.method === 'PUT') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve(mockModulesResponse);
    });

    const { getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/badges/badge-123',
        'mock-token',
        {
          method: 'PUT',
          body: {
            name: 'Gold Badge',
            iconUrl: 'http://example.com/image.png',
            validityMonths: 12,
            moduleId: 1,
            linkedModuleId: 1,
            linkedModuleIds: [1],
            linkedModuleName: 'Module One',
            linkedModuleNames: ['Module One'],
            moduleName: 'Module One',
            eligibilityRules: {
              requireGeneralModuleCompleted: true,
              requireAllTPAModulesCompleted: true,
              requireAllAssessmentsPassed: true,
              requireOnSiteTrainingCompletedByAdmin: true,
            },
          },
        }
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('displays an alert if the update API call fails', async () => {
    requestProfileApi.mockImplementation((url, token, options) => {
      if (options.method === 'PUT') {
        return Promise.reject(new Error('Network Error'));
      }
      return Promise.resolve(mockModulesResponse);
    });

    const { getByText } = render(
      <EditBadgeScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Module One')).toBeTruthy();
    });

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Update failed', 'Network Error');
    });
  });
});