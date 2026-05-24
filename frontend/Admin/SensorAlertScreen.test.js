import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SensorAlertScreen from './SensorAlertScreen';
import * as DocumentPicker from 'expo-document-picker';
import { fetchAdminEvidenceAlerts, uploadEsp32SensorLogsCsv } from './evidenceApi.js';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('react-native-webview', () => {
  const ReactInstance = require('react');
  const { View } = require('react-native');
  return {
    WebView: ReactInstance.forwardRef((props, ref) => <View testID="mock-webview" {...props} ref={ref} />),
  };
});

jest.mock('./evidenceApi.js', () => ({
  fetchAdminEvidenceAlerts: jest.fn(),
  uploadEsp32SensorLogsCsv: jest.fn(),
}));

const mockNavigation = {
  addListener: jest.fn(() => jest.fn()),
  navigate: jest.fn(),
};

describe('SensorAlertScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigation.addListener.mockImplementation(() => jest.fn());
    fetchAdminEvidenceAlerts.mockResolvedValue({
      alerts: [
        {
          id: 'alert-1',
          alertKey: 'key-1',
          name: 'Critical Sensor Spike',
          resolved: false,
          latitude: 2.3,
          longitude: 112.5,
          sourceLabel: 'ESP32 Log Feed',
          status: 'Unresolved',
          timestamp: '2026-05-24 08:30:00',
          timestampValue: 1716539400,
        },
      ],
      error: '',
    });
  });

  it('renders standard headers and maps data correctly', async () => {
    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText, findByText, getByTestId } = renderResult;

    expect(getByText('Live alert map')).toBeTruthy();
    expect(getByText('Sensor monitoring')).toBeTruthy();
    expect(getByTestId('mock-webview')).toBeTruthy();

    const openAlertText = await findByText('Critical Sensor Spike');
    expect(openAlertText).toBeTruthy();
  });

  it('handles csv file browsing cancel state', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: true,
    });

    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText, queryByText } = renderResult;

    const selectButton = getByText('Choose Sensor CSV');
    await act(async () => {
      fireEvent.press(selectButton);
    });

    await waitFor(() => {
      expect(queryByText('Selected:')).toBeNull();
    });
  });

  it('performs full file selection and upload flow', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'logs.csv', uri: 'file://logs.csv' }],
    });

    uploadEsp32SensorLogsCsv.mockResolvedValue({
      data: { insertedCount: 12, skippedCount: 2 },
    });

    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText, findByText } = renderResult;

    await act(async () => {
      fireEvent.press(getByText('Choose Sensor CSV'));
    });

    const fileText = await findByText('Selected: logs.csv');
    expect(fileText).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Upload Selected CSV'));
    });

    const completeMessage = await findByText(
      'CSV uploaded. Inserted 12 row(s), skipped 2 row(s).'
    );
    expect(completeMessage).toBeTruthy();
    expect(uploadEsp32SensorLogsCsv).toHaveBeenCalledTimes(1);
  });

  it('handles document picker asset exception errors safely', async () => {
    DocumentPicker.getDocumentAsync.mockRejectedValue(new Error('System permission denied'));

    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText, findByText } = renderResult;

    await act(async () => {
      fireEvent.press(getByText('Choose Sensor CSV'));
    });

    const errorMessage = await findByText('System permission denied');
    expect(errorMessage).toBeTruthy();
  });

  it('handles api failure responses safely inside file upload', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'logs.csv', uri: 'file://logs.csv' }],
    });

    uploadEsp32SensorLogsCsv.mockRejectedValue(new Error('Network gateway timeout'));

    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText, findByText } = renderResult;

    await act(async () => {
      fireEvent.press(getByText('Choose Sensor CSV'));
    });
    
    const uploadBtn = await findByText('Upload Selected CSV');
    
    await act(async () => {
      fireEvent.press(uploadBtn);
    });

    const errorMessage = await findByText('Network gateway timeout');
    expect(errorMessage).toBeTruthy();
  });

  it('routes to detail page when specific alert record is pressed', async () => {
    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { findByText } = renderResult;

    const itemNode = await findByText('Critical Sensor Spike');
    await act(async () => {
      fireEvent.press(itemNode);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'AlertDetail',
      expect.any(Object)
    );
  });

  it('routes to general overview component when action item is clicked', async () => {
    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { getByText } = renderResult;

    await act(async () => {
      fireEvent.press(getByText('Alert Overview'));
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('AlertOverview');
  });

  it('renders placeholder label block if returned database arrays are empty', async () => {
    fetchAdminEvidenceAlerts.mockResolvedValue({
      alerts: [],
      error: '',
    });

    let renderResult;
    await act(async () => {
      renderResult = render(<SensorAlertScreen navigation={mockNavigation} />);
    });

    const { findByText } = renderResult;

    const emptyTextLabel = await findByText(
      'No unsolved alerts were returned from the server.'
    );
    expect(emptyTextLabel).toBeTruthy();
  });
});