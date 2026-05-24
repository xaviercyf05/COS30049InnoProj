import React from 'react';
import { Platform, Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

// Import local units under test
import { 
  resolveApiAssetUri, 
  resolveProfileImageUri, 
  pickProfileImagePath, 
  requestProfileApi,
  API_ORIGIN
} from './profileApi';
import ProfileScreen from './ProfileScreen';
import EditProfileScreen from './EditProfileScreen';

// Mock Global Fetch API
global.fetch = jest.fn();

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock Expo Image Picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Shared Navigation Mocks
const mockReset = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAddListener = jest.fn((event, callback) => {
  if (event === 'focus') callback();
  return () => {};
});

const mockNavigation = {
  reset: mockReset,
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: mockAddListener,
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios'; // Reset to default platform target
  delete process.env.EXPO_PUBLIC_API_WEB_PROXY;
});

describe('profileApi.js Utility Tests', () => {
  
  describe('resolveApiAssetUri', () => {
    it('returns null for missing or invalid inputs', () => {
      expect(resolveApiAssetUri(null)).toBeNull();
      expect(resolveApiAssetUri('   ')).toBeNull();
    });

    it('returns absolute protocols completely untouched', () => {
      expect(resolveApiAssetUri('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
      expect(resolveApiAssetUri('https://site.com/avatar.png')).toBe('https://site.com/avatar.png');
    });

    it('resolves standard relative paths against the origin domain', () => {
      const resolved = resolveApiAssetUri('assets/cover.jpg');
      expect(resolved).toBe(`${API_ORIGIN}/assets/cover.jpg`);
    });
  });

  describe('resolveProfileImageUri', () => {
    it('safely parses uploads folders path segments into base url', () => {
      const uri = resolveProfileImageUri('uploads/profile-images/user_9.jpg');
      expect(uri).toBe(`${API_ORIGIN}/uploads/profile-images/user_9.jpg`);
    });

    it('respects environmental variables proxy URLs on web instances', () => {
      Platform.OS = 'web';
      process.env.EXPO_PUBLIC_API_WEB_PROXY = 'https://proxy.server';
      const uri = resolveProfileImageUri('avatar.png');
      expect(uri).toBe('https://proxy.server/uploads/profile-images/avatar.png');
    });
  });

  describe('pickProfileImagePath', () => {
    it('extracts known matching camelCased image properties structural variations', () => {
      expect(pickProfileImagePath({ profileImageUrl: 'url_1' })).toBe('url_1');
      expect(pickProfileImagePath({ avatarUrl: 'url_2' })).toBe('url_2');
      expect(pickProfileImagePath(null)).toBeNull();
    });
  });

  describe('requestProfileApi', () => {
    it('resolves accurately with response payloads when 200 OK received', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: { username: 'test_user' } }),
      });

      const response = await requestProfileApi('/api/v1/user/profile', 'mock-token');
      expect(response.data.username).toBe('test_user');
    });

    it('bubbles customized error structures upon API failures', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Invalid payload structure' }),
      });

      await expect(requestProfileApi('/api/v1/user/profile', 'token')).rejects.toThrow(
        'Invalid payload structure'
      );
    });
  });
});

describe('ProfileScreen.js Component Tests', () => {
  const mockProfile = {
    fullName: 'Alex Honnold',
    email: 'alex@parks.gov',
    username: 'alexclimb',
    role: 'Guide',
    station: 'Yosemite Camp 4',
    progress: 80,
    status: 'Active',
  };

  it('resets application routing to Login if token returns empty', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);

    render(<ProfileScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(mockNavigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });
  });

  it('renders initial load indicator text and updates state layout with values', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('valid_token');
    
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: mockProfile }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [] }),
      });

    const { getByText, queryByText, getAllByText } = render(<ProfileScreen navigation={mockNavigation} />);

    expect(getByText('Loading your profile...')).toBeTruthy();

    await waitFor(() => {
      expect(queryByText('Loading your profile...')).toBeNull();
      // FIX: Use getAllByText since fullName renders in the hero section and information card
      expect(getAllByText('Alex Honnold').length).toBe(2);
      expect(getByText('alex@parks.gov')).toBeTruthy();
      expect(getByText('Station: Yosemite Camp 4')).toBeTruthy();
    });
  });

  it('dispatches scene redirection events to EditProfile view when clicked', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('valid_token');
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: mockProfile }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [] }),
      });

    const { getByText } = render(<ProfileScreen navigation={mockNavigation} />);

    await waitFor(() => expect(getByText('Edit Profile')).toBeTruthy());
    fireEvent.press(getByText('Edit Profile'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EditProfile', {
      profile: mockProfile,
    });
  });
});

describe('EditProfileScreen.js Component Tests', () => {
  const initialProfile = {
    fullName: 'John Muir',
    email: 'john@sierraclub.org',
    username: 'johnmuir',
    role: 'Guide',
    station: 'Redwood Valley',
  };

  const mockRoute = {
    params: { profile: initialProfile },
  };

  it('displays provided route param information fields accurately inside text inputs', () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByDisplayValue('John Muir')).toBeTruthy();
    expect(getByDisplayValue('john@sierraclub.org')).toBeTruthy();
    expect(getByDisplayValue('johnmuir')).toBeTruthy();
  });

  it('validates empty parameters and throws local alert banners if fields are blanked', async () => {
    jest.spyOn(Alert, 'alert');
    const { getByText, getByDisplayValue } = render(
      <EditProfileScreen navigation={mockNavigation} route={mockRoute} />
    );

    const nameInput = getByDisplayValue('John Muir');
    fireEvent.changeText(nameInput, ''); // Empty full name input field

    const saveButton = getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Full name, email and username are required.'
      );
    });
  });

  it('requires matching confirmation entries during password composition routines', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Provide values that do not match to unlock inline password validation checks
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'old-pass-123');
    fireEvent.changeText(getByPlaceholderText('New Password'), 'securePass1');
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), 'securePass2');

    expect(getByText('New password and confirmation do not match.')).toBeTruthy();
  });

  it('triggers media library assets picker upon change photo action', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'ph://test-photo-location.jpg' }],
    });

    const { getByText } = render(
      <EditProfileScreen navigation={mockNavigation} route={mockRoute} />
    );

    const changePhotoBtn = getByText('Change Photo');
    fireEvent.press(changePhotoBtn);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('successfully fires a multipart and configuration API updates chain upon completion', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('valid_token');
    
    // Server returns the updated configuration payload
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        data: { ...initialProfile, fullName: 'John Muir Updated' },
      }),
    });

    const { getByText, getByDisplayValue } = render(
      <EditProfileScreen navigation={mockNavigation} route={mockRoute} />
    );

    const nameInput = getByDisplayValue('John Muir');
    fireEvent.changeText(nameInput, 'John Muir Updated');

    const saveButton = getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(getByText(/Changes saved at|Changes saved successfully/)).toBeTruthy();
    });
  });
});