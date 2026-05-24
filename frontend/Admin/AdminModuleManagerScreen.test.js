import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AdminModuleManagerScreen from './AdminModuleManagerScreen';
import { requestProfileApi } from '../Profile/profileApi.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

jest.mock('../auth/withRoleGuard.js', () => (Component) => Component);

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

jest.mock('./RichEditor.web', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <mock-editor testID="rich-editor" value={value} onChange={onChange} />
  ),
}));

jest.mock('./RichEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <mock-editor testID="rich-editor" value={value} onChange={onChange} />
  ),
}));

describe('AdminModuleManagerScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') {
        callback();
      }
      return jest.fn();
    }),
  };

  const mockRoute = {
    params: {
      moduleId: '45',
    },
  };

  const mockModulesListResponse = {
    data: [
      {
        id: 45,
        moduleId: 45,
        title: 'Initial Module Title',
        moduleType: 'general',
        moduleTypeId: 1,
        modulePrice: '150.00',
        sections: [],
      },
    ],
  };

  const mockSingleModuleResponse = {
    data: {
      id: 45,
      moduleId: 45,
      title: 'Initial Module Title',
      summary: 'Initial Summary',
      moduleType: 'general',
      moduleTypeId: 1,
      modulePrice: '150.00',
      sections: [
        {
          id: 'section-abc',
          title: 'Section One Title',
          description: 'Section One Description',
          ordering: 1,
          subsections: [
            {
              id: 'subsection-xyz',
              title: 'Subsection One Title',
              content: '<p>Subsection Content</p>',
              ordering: 1,
            },
          ],
        },
        {
          id: 'section-def',
          title: 'Section Two Title',
          description: 'Section Two Description',
          ordering: 2,
          subsections: [],
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    AsyncStorage.getItem.mockResolvedValue('mock-token');
    requestProfileApi.mockImplementation((url) => {
      if (url === '/api/v1/admin/modules') {
        return Promise.resolve(mockModulesListResponse);
      }
      if (url.includes('/api/v1/admin/modules/')) {
        return Promise.resolve(mockSingleModuleResponse);
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('loads module tracking metrics and sets configuration fields', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('auth_token');
      expect(requestProfileApi).toHaveBeenCalledWith('/api/v1/admin/modules', 'mock-token', { method: 'GET' });
    });

    await waitFor(() => {
      expect(getByText('Saved Modules (1)')).toBeTruthy();
      expect(getByPlaceholderText('Module Title').props.value).toBe('Initial Module Title');
      expect(getByPlaceholderText('Module Summary (short description)').props.value).toBe('Initial Summary');
    });
  });

  it('updates draft form inputs on user manipulation', async () => {
    const { getByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByPlaceholderText('Module Title').props.value).toBe('Initial Module Title');
    });

    fireEvent.changeText(getByPlaceholderText('Module Title'), 'Altered Module Title');
    fireEvent.changeText(getByPlaceholderText('Module Summary (short description)'), 'Altered Summary');
    fireEvent.changeText(getByPlaceholderText('Module Price (RM)'), '299.99');

    expect(getByPlaceholderText('Module Title').props.value).toBe('Altered Module Title');
    expect(getByPlaceholderText('Module Summary (short description)').props.value).toBe('Altered Summary');
    expect(getByPlaceholderText('Module Price (RM)').props.value).toBe('299.99');
  });

  it('handles custom layout modification commands for structural components', async () => {
    const { getByText, getAllByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('+ Add Section')).toBeTruthy();
    });

    fireEvent.press(getByText('+ Add Section'));

    const sectionInputs = getAllByPlaceholderText('Section Title');
    expect(sectionInputs.length).toBe(3);
  });

  it('applies section reordering mechanisms safely', async () => {
    const { getAllByText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getAllByText('Move Section Down')[0]).toBeTruthy();
    });

    const moveDownButtons = getAllByText('Move Section Down');
    expect(moveDownButtons[0].props.disabled).toBeFalsy();

    fireEvent.press(moveDownButtons[0]);
  });

  it('manages subsection entities expansion sequences', async () => {
    const { getAllByText, getAllByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getAllByText('+ Add Subsection')[0]).toBeTruthy();
    });

    const addButtons = getAllByText('+ Add Subsection');
    fireEvent.press(addButtons[0]);

    await waitFor(() => {
      const subsectionInputs = getAllByPlaceholderText('Subsection Title');
      expect(subsectionInputs.length).toBeGreaterThan(0);
    });
  });

  it('switches application runtime mode validation profiles according to context configuration parameters', async () => {
    const { getByText, queryByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('On Site Training Modules')).toBeTruthy();
    });

    fireEvent.press(getByText('On Site Training Modules'));

    expect(queryByPlaceholderText('Module Price (RM)')).toBeNull();
    expect(getByText('On Site Training Modules do not use a payment price.')).toBeTruthy();
  });

  it('executes document creation storage processes over backend API hooks', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByPlaceholderText('Module Title').props.value).toBe('Initial Module Title');
    });

    fireEvent.changeText(getByPlaceholderText('Module Title'), 'Final Certified Title');
    fireEvent.press(getByText('Save Module Changes'));

    await waitFor(() => {
      expect(requestProfileApi).toHaveBeenCalledWith(
        '/api/v1/admin/modules/45',
        'mock-token',
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({
            title: 'Final Certified Title',
          }),
        })
      );
    });
  });

  it('coordinates media file retrieval permissions and assigns binary object paths locally', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://local/captured-cover.png' }],
    });

    const { getByText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('Upload Local Image')).toBeTruthy();
    });

    fireEvent.press(getByText('Upload Local Image'));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('dispatches data deletion requests containing target entity references securely', async () => {
    let confirmCallback;
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      if (title === 'Delete Module' && buttons) {
        confirmCallback = buttons.find(b => b.text === 'Delete')?.onPress;
      }
    });

    const { getAllByText } = render(
      <AdminModuleManagerScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getAllByText('Delete').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('Delete')[0]);

    expect(confirmCallback).toBeDefined();
    await confirmCallback();

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/admin/modules/45',
      'mock-token',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});