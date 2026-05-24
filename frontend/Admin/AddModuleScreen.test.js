import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import AddModuleScreen from './AddModuleScreen'; // Adjust the import path if necessary
import { requestProfileApi, uploadModuleCoverImage } from '../Profile/profileApi.js';

// --- Mocks ---
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
  resolveApiAssetUri: jest.fn((uri) => uri),
  uploadModuleCoverImage: jest.fn(),
}));

// Mock the higher-order component role guard so it simply passes the component through
jest.mock('../auth/withRoleGuard.js', () => {
  return (Component) => (props) => <Component {...props} />;
});

// Mock the platform dynamic Editor import
jest.mock('./RichEditor', () => {
  const { TextInput } = require('react-native');
  return function MockEditor({ value, onChange }) {
    return (
      <TextInput
        testID="mock-rich-editor"
        value={value}
        onChangeText={onChange}
      />
    );
  };
}, { virtual: true });

const mockNavigation = {
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('AddModuleScreen Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('fake-token');
    requestProfileApi.mockResolvedValue({ data: [] });
  });

  it('renders correctly with default values', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    expect(getByText('Create Module')).toBeTruthy();
    expect(getByPlaceholderText('Module Title')).toBeTruthy();
    expect(getByPlaceholderText('Module Summary (short description)')).toBeTruthy();
    expect(getByPlaceholderText('Module Price (RM)')).toBeTruthy();
  });

  it('fetches existing modules on initial layout focus', async () => {
    const mockModulesList = [
      { id: 101, title: 'TPA Test Module', type: 'park-specific' }
    ];
    requestProfileApi.mockResolvedValueOnce({ data: mockModulesList });

    const { getByText } = render(<AddModuleScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('auth_token');
      expect(requestProfileApi).toHaveBeenCalledWith('/api/v1/admin/modules', 'fake-token', { method: 'GET' });
      expect(getByText('Manage Modules (1)')).toBeTruthy();
    });
  });

  it('validates missing fields when saving', async () => {
    const { getByText } = render(<AddModuleScreen navigation={mockNavigation} />);
    const saveButton = getByText('Save Module');

    // Trigger save with empty title
    fireEvent.press(saveButton);
    
    await waitFor(() => {
      expect(requestProfileApi).not.toHaveBeenCalledWith('/api/v1/admin/modules', expect.any(String), expect.objectContaining({ method: 'POST' }));
    });
  });

  it('allows dynamic addition and layout manipulation of sections and subsections', async () => {
    const { getByText, queryAllByPlaceholderText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    // Default configuration initializes 1 section
    expect(queryAllByPlaceholderText('Section Title').length).toBe(1);

    // Add another section
    const addSectionButton = getByText('+ Add Section');
    fireEvent.press(addSectionButton);
    expect(queryAllByPlaceholderText('Section Title').length).toBe(2);

    // Add subsection to the initial section
    const addSubsectionButton = getByText('+ Add Subsection');
    fireEvent.press(addSubsectionButton);
    expect(queryAllByPlaceholderText('Subsection Title').length).toBe(2);
  });

  it('switches payment forms and structural fields contextually across different Module Types', async () => {
    const { getByText, queryByPlaceholderText, queryByText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    // Default 'General' type shows Price input
    expect(queryByPlaceholderText('Module Price (RM)')).toBeTruthy();

    // Change variant to 'On Site Training Modules'
    const onSiteTab = getByText('On Site Training Modules');
    fireEvent.press(onSiteTab);

    // On-site modules should drop standard billing metrics and provide a help block notice
    expect(queryByPlaceholderText('Module Price (RM)')).toBeNull();
    expect(queryByText('On Site Training Modules do not use a payment price.')).toBeTruthy();
  });

  it('submits correctly formed body payloads on a successful save', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: [] }) // Initial fetch
      .mockResolvedValueOnce({ data: { success: true } }) // POST action payload
      .mockResolvedValueOnce({ data: [{ id: 1 }] }); // Post-refresh sync hook

    const { getByPlaceholderText, getByText, getByTestID } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    // Fill structural entity nodes
    fireEvent.changeText(getByPlaceholderText('Module Title'), 'Introduction to Wilderness');
    fireEvent.changeText(getByPlaceholderText('Module Summary (short description)'), 'A brief overview.');
    fireEvent.changeText(getByPlaceholderText('Module Price (RM)'), '150.00');
    fireEvent.changeText(getByPlaceholderText('Section Title'), 'Chapter 1');
    fireEvent.changeText(getByPlaceholderText('Subsection Title'), 'Sub-chapter A');
    fireEvent.changeText(getByTestID('mock-rich-editor'), '<p>Learning objectives content.</p>');

    const saveButton = getByText('Save Module');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/modules',
        'fake-token',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            title: 'Introduction to Wilderness',
            summary: 'A brief overview.',
            modulePrice: 150,
            sections: expect.arrayContaining([
              expect.objectContaining({
                title: 'Chapter 1',
                subsections: expect.arrayContaining([
                  expect.objectContaining({
                    title: 'Sub-chapter A',
                    content: '<p>Learning objectives content.</p>'
                  })
                ])
              })
            ])
          })
        })
      );
    });
  });

  it('handles localized image ingestion via the native image library permissions loop', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'ph://test-local-image-uri.jpg', width: 100, height: 100 }]
    });

    const { getByText } = render(<AddModuleScreen navigation={mockNavigation} />);
    
    const uploadButton = getByText('Upload Local Image');
    await act(async () => {
      fireEvent.press(uploadButton);
    });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    expect(getByText('Use URL Instead')).toBeTruthy();
  });
});