import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AddModuleScreen from './AddModuleScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi, uploadModuleCoverImage } from '../Profile/profileApi.js';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
  resolveApiAssetUri: jest.fn((uri) => uri),
  uploadModuleCoverImage: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../auth/withRoleGuard.js', () => (Component) => Component);

jest.mock('./RichEditor', () => {
  const { TextInput } = require('react-native');
  return function MockRichEditor({ value, onChange }) {
    return (
      <TextInput
        testID="mock-rich-editor"
        value={value}
        onChangeText={onChange}
      />
    );
  };
}, { virtual: true });

describe('AddModuleScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    canGoBack: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };

  const sampleTpaModules = [
    {
      id: 101,
      title: 'Bako National Park TPA',
      moduleType: 'park-specific',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('fake-admin-token');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders initial state and fetches existing modules count', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: sampleTpaModules });

    const { getByText, getByPlaceholderText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Manage Modules (1)')).toBeTruthy();
    });

    expect(getByPlaceholderText('Module Title')).toBeTruthy();
    expect(getByText('Section 1')).toBeTruthy();
    expect(getByText('Subsection 1.1')).toBeTruthy();
  });

  it('validates required fields and shows notice alerts on save attempt', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: [] });

    const { getByText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('Save Module')).toBeTruthy());
    fireEvent.press(getByText('Save Module'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing details',
      'Please provide a module title before saving.'
    );
  });

  it('validates price for general modules and linked TPA for onsite modules', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: sampleTpaModules });

    const { getByText, getByPlaceholderText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByPlaceholderText('Module Title')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Module Title'), 'New Course');
    
    fireEvent.press(getByText('Save Module'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing details',
      'Please enter a module price before saving.'
    );

    fireEvent.press(getByText('On Site Training Modules'));
    fireEvent.press(getByText('Save Module'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing details',
      'Please choose a linked TPA module for this On Site Training Module.'
    );
  });

  it('handles image picking workflow correctly', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: [] });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'local-image-path.jpg' }],
    });

    const { getByText, queryByText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('Upload Local Image')).toBeTruthy());
    
    await act(async () => {
      fireEvent.press(getByText('Upload Local Image'));
    });

    expect(getByText('Use URL Instead')).toBeTruthy();

    fireEvent.press(getByText('Use URL Instead'));
    expect(queryByText('Use URL Instead')).toBeNull();
  });

  it('manages adding, reordering, and removing architectural sections', async () => {
    requestProfileApi.mockResolvedValueOnce({ data: [] });

    const { getByText, getAllByText, queryByText } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByText('+ Add Section')).toBeTruthy());

    fireEvent.press(getByText('+ Add Section'));
    expect(getByText('Section 2')).toBeTruthy();

    const moveDownButtons = getAllByText('Move Section Down');
    fireEvent.press(moveDownButtons[0]);

    const deleteButtons = getAllByText('X');
    fireEvent.press(deleteButtons[0]); 

    expect(queryByText('Section 2')).toBeNull();
  });

  it('submits valid forms and responds to success callback redirects', async () => {
    requestProfileApi
      .mockResolvedValueOnce({ data: sampleTpaModules }) 
      .mockResolvedValueOnce({ success: true }) 
      .mockResolvedValueOnce({ data: [...sampleTpaModules, { id: 102 }] }); 

    uploadModuleCoverImage.mockResolvedValueOnce('uploaded-cloud-image.png');
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'valid-photo.jpg' }],
    });

    const { getByText, getByPlaceholderText, getByTestId } = render(
      <AddModuleScreen navigation={mockNavigation} />
    );

    await waitFor(() => expect(getByPlaceholderText('Module Title')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('Module Title'), 'Advanced TPA');
    fireEvent.changeText(getByPlaceholderText('Module Summary (short description)'), 'Summary text');
    fireEvent.changeText(getByPlaceholderText('Module Price (RM)'), '150.00');
    fireEvent.changeText(getByPlaceholderText('Section Title'), 'Introduction Room');
    fireEvent.changeText(getByPlaceholderText('Subsection Title'), 'Part Alpha');
    fireEvent.changeText(getByTestId('mock-rich-editor'), '<p>HTML Content Here</p>');

    await act(async () => {
      fireEvent.press(getByText('Upload Local Image'));
    });

    await act(async () => {
      fireEvent.press(getByText('Save Module'));
    });

    expect(uploadModuleCoverImage).toHaveBeenCalledWith('fake-admin-token', { uri: 'valid-photo.jpg' });
    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/admin/modules',
      'fake-admin-token',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          title: 'Advanced TPA',
          modulePrice: 150,
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Introduction Room',
              subsections: [
                { title: 'Part Alpha', content: '<p>HTML Content Here</p>', ordering: 1 }
              ]
            })
          ])
        })
      })
    );

    expect(Alert.alert).toHaveBeenCalledWith(
      'Save successful',
      expect.any(String),
      expect.any(Array)
    );

    const completeActionHandler = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2][1].onPress;
    completeActionHandler();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Home');
  });
});