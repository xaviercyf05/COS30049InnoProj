import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrls, API_ORIGIN } from '../Profile/profileApi.js';
import {
  fetchAdminEvidenceAlerts,
  updateAlertStatus,
  updateEvidenceStatus,
  uploadEsp32SensorLogsCsv,
} from './evidenceApi.js';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
  getApiBaseUrls: jest.fn(),
  API_ORIGIN: 'https://fallback.api.com',
}));

global.fetch = jest.fn();

describe('evidenceApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAdminEvidenceAlerts', () => {
    it('returns an error if no auth token is found', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const result = await fetchAdminEvidenceAlerts();

      expect(result).toEqual({
        alerts: [],
        error: 'Authentication required to load evidence alerts.',
      });
    });

    it('fetches, normalises, and sorts alerts correctly', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);

      const mockEvidenceResponse = {
        data: [
          {
            evidenceId: 1,
            eventType: 'trespass',
            location: 'North Park',
            timestamp: '2026-05-24 08:00:00',
          },
        ],
      };

      const mockSensorResponse = {
        data: [
          {
            sensorLogId: 101,
            location: 'South Park',
            date: '2026-05-24',
            time: '09:00:00',
          },
        ],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => mockEvidenceResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => mockSensorResponse,
        });

      const result = await fetchAdminEvidenceAlerts();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].id).toBe('101');
      expect(result.alerts[1].id).toBe(1);
      expect(result.error).toBeNull();
    });

    it('handles endpoint fallbacks for sensor logs when first endpoint fails with 404', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: { get: () => 'application/json' },
          text: async () => 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: [{ sensorLogId: 202, date: '2026-05-24', time: '10:00:00' }] }),
        });

      const result = await fetchAdminEvidenceAlerts();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].id).toBe('202');
    });
  });

  describe('updateAlertStatus', () => {
    it('throws an error if no auth token is found', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      await expect(updateAlertStatus(1, true)).rejects.toThrow('Authentication required');
    });

    it('throws an error if id is missing', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');

      await expect(updateAlertStatus(null, true)).rejects.toThrow('This alert is missing an id.');
    });

    it('sends PUT request to evidence status endpoint', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      });

      const result = await updateAlertStatus({ id: 5, sourceType: 'body-worn-camera' }, true);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://primary.api.com/api/v1/admin/evidence/5/status',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ resolved: true }),
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('sends PUT request to esp32 status endpoint', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      });

      const result = await updateAlertStatus({ id: 'esp32-10', sourceType: 'esp32-sensor-log' }, false);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://primary.api.com/api/v1/admin/esp32sensorlogs/esp32-10/status',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ resolved: false }),
        })
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateEvidenceStatus', () => {
    it('wraps updateAlertStatus logic execution', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      });

      const result = await updateEvidenceStatus(42, true);
      expect(result).toEqual({ success: true });
    });
  });

  describe('uploadEsp32SensorLogsCsv', () => {
    it('throws error if fileAsset is missing', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');

      await expect(uploadEsp32SensorLogsCsv(null)).rejects.toThrow('CSV file is required.');
    });

    it('successfully uploads file object using FormData', async () => {
      AsyncStorage.getItem.mockResolvedValue('fake-token');
      getApiBaseUrls.mockReturnValue(['https://primary.api.com']);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ uploaded: true }),
      });

      const mockFile = { uri: 'file://path/to/log.csv', name: 'test.csv', mimeType: 'text/csv' };
      const result = await uploadEsp32SensorLogsCsv(mockFile, 'device-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://primary.api.com/api/v1/admin/esp32sensorlogs/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual({ uploaded: true });
    });
  });
});