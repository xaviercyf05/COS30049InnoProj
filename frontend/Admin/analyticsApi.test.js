import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';
import {
  workbookSheets,
  PIE_COLORS,
  createEmptyAnalyticsData,
  normalizePieSlices,
  normalizeAdminUser,
  fetchAnalyticsDashboardData,
  fetchAdminParkGuideAccounts,
  updateAdminUserStatus
} from './analyticsApi.js';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
}));

describe('analyticsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    delete global.window;
  });

  test('workbookSheets and PIE_COLORS are defined with correct values', () => {
    expect(workbookSheets).toBeDefined();
    expect(workbookSheets.length).toBe(4);
    expect(workbookSheets[0].key).toBe('parkGuides');
    expect(PIE_COLORS).toBeDefined();
    expect(PIE_COLORS.length).toBe(8);
  });

  test('createEmptyAnalyticsData generates default layout object', () => {
    const data = createEmptyAnalyticsData();
    expect(data.parkGuides).toBeDefined();
    expect(data.parkGuides.title).toBe('Park Guides');
    expect(data.parkGuides.kpis).toEqual([]);
    expect(data.progress).toBeDefined();
    expect(data.modules).toBeDefined();
    expect(data.badges).toBeDefined();
  });

  test('normalizePieSlices converts and assigns fallback colors', () => {
    const slices = [{ value: '15', color: '#FF0000' }, { value: '25' }, { value: null }];
    const result = normalizePieSlices(slices);
    
    expect(result[0].value).toBe(15);
    expect(result[0].color).toBe('#FF0000');
    expect(result[1].value).toBe(25);
    expect(result[1].color).toBe(PIE_COLORS[1]);
    expect(result[2].value).toBe(0);
    expect(result[2].color).toBe(PIE_COLORS[2]);
  });

  test('normalizePieSlices handles null or undefined input', () => {
    expect(normalizePieSlices(null)).toEqual([]);
    expect(normalizePieSlices(undefined)).toEqual([]);
  });

  test('normalizeAdminUser processes varied properties correctly', () => {
    const user1 = { id: '101', status: 'Active', role: 'Guide', fullName: 'Jane Doe', email: 'jane@example.com', createdAt: '2026-01-01' };
    const res1 = normalizeAdminUser(user1);
    expect(res1.id).toBe('101');
    expect(res1.userId).toBe(101);
    expect(res1.isActive).toBe(true);
    expect(res1.role).toBe('Guide');
    expect(res1.joinDate).toBe('2026-01-01');

    const user2 = { UserID: 202, isActive: false, roleName: 'Supervisor' };
    const res2 = normalizeAdminUser(user2, 1);
    expect(res2.id).toBe('202');
    expect(res2.userId).toBe(202);
    expect(res2.status).toBe('Inactive');
    expect(res2.isActive).toBe(false);
    expect(res2.fullName).toBe('Unnamed Park Guide');
    expect(res2.role).toBe('Supervisor');

    const user3 = {};
    const res3 = normalizeAdminUser(user3, 99);
    expect(res3.id).toBe('99');
    expect(res3.userId).toBeNull();
    expect(res3.status).toBe('Active');
    expect(res3.role).toBe('User');
  });

  test('fetchAnalyticsDashboardData handles successful fetch using AsyncStorage token', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-storage-token');
    const mockPayload = {
      success: true,
      data: {
        parkGuides: { pieSlices: [{ value: '12' }] }
      }
    };
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue(mockPayload)
    });

    const result = await fetchAnalyticsDashboardData();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('auth_token');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/admin/analytics/dashboard'), expect.any(Object));
    expect(result.parkGuides.pieSlices[0].value).toBe(12);
    expect(result.parkGuides.pieSlices[0].color).toBe(PIE_COLORS[0]);
  });

  test('fetchAnalyticsDashboardData falls back to localStorage token when AsyncStorage fails', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('Async error'));
    global.window = {
      localStorage: {
        getItem: jest.fn().mockReturnValue('valid-local-token')
      }
    };
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({ success: true, data: {} })
    });

    const result = await fetchAnalyticsDashboardData();
    expect(global.window.localStorage.getItem).toHaveBeenCalledWith('auth_token');
    expect(result).toBeDefined();
  });

  test('fetchAnalyticsDashboardData throws error when no authentication token exists', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await expect(fetchAnalyticsDashboardData()).rejects.toThrow('Authentication required');
  });

  test('fetchAnalyticsDashboardData throws error when response is not ok', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({ message: 'Forbidden access error' })
    });
    await expect(fetchAnalyticsDashboardData()).rejects.toThrow('Forbidden access error');
  });

  test('fetchAnalyticsDashboardData throws generic status error for non-json responses', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'text/html' }
    });
    await expect(fetchAnalyticsDashboardData()).rejects.toThrow('HTTP 500');
  });

  test('fetchAnalyticsDashboardData throws error when payload success is false', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({ success: false })
    });
    await expect(fetchAnalyticsDashboardData()).rejects.toThrow('Invalid analytics response from server');
  });

  test('fetchAdminParkGuideAccounts filters out admin and administrator roles', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    const mockServerUsers = [
      { id: 10, role: 'Park Guide', fullName: 'Guide Test 1' },
      { id: 11, role: 'Admin', fullName: 'Administrator Test 1' },
      { id: 12, role: 'System Administrator', fullName: 'Administrator Test 2' },
      { id: 13, role: 'Lead Guide', fullName: 'Guide Test 2' }
    ];
    requestProfileApi.mockResolvedValue({ data: mockServerUsers });

    const result = await fetchAdminParkGuideAccounts();
    expect(requestProfileApi).toHaveBeenCalledWith('/api/v1/admin/users', 'valid-token', { method: 'GET' });
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('10');
    expect(result[1].id).toBe('13');
  });

  test('fetchAdminParkGuideAccounts defaults to empty array if response data is non-array', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    requestProfileApi.mockResolvedValue({ data: null });
    const result = await fetchAdminParkGuideAccounts();
    expect(result).toEqual([]);
  });

  test('updateAdminUserStatus triggers PUT request with correct body configuration', async () => {
    AsyncStorage.getItem.mockResolvedValue('valid-token');
    requestProfileApi.mockResolvedValue({ success: true });

    const result = await updateAdminUserStatus('999', 'Suspended');
    expect(requestProfileApi).toHaveBeenCalledWith('/api/v1/admin/users/999/status', 'valid-token', {
      method: 'PUT',
      body: { status: 'Suspended' }
    });
    expect(result).toEqual({ success: true });
  });
});