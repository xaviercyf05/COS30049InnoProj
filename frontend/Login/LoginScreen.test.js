import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { 
  persistAuthSession, 
  clearAuthSession, 
  getStoredAuthSession, 
  refreshAuthSession,
  AUTH_STORAGE_KEYS
} from './authSession';
import LoadingScreen from './LoadingScreen';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
      return Promise.resolve(null);
    }),
    getItem: jest.fn((key) => {
      return Promise.resolve(store[key] || null);
    }),
    multiSet: jest.fn((pairs) => {
      pairs.forEach(([key, value]) => {
        store[key] = String(value);
      });
      return Promise.resolve(null);
    }),
    multiRemove: jest.fn((keys) => {
      keys.forEach((key) => {
        delete store[key];
      });
      return Promise.resolve(null);
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve(null);
    }),
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Switch = (props) => {
    const View = RN.View;
    return <View testID={props.testID} accessibilityLabel={props.accessibilityLabel} {...props} />;
  };
  return RN;
});

jest.mock('../auth/passkeyClient.js', () => ({
  createPasskey: jest.fn(),
  getPasskey: jest.fn(() => Promise.resolve('mocked-credential-id')),
  supportsPasskeys: jest.fn(() => true),
}));

import { requestProfileApi } from '../Profile/profileApi.js';
jest.mock('../Profile/profileApi.js', () => ({
  API_ORIGIN: 'https://api.innopappserver.xyz',
  getApiBaseUrls: jest.fn(() => ['https://api.innopappserver.xyz']),
  requestProfileApi: jest.fn(),
}));

global.fetch = jest.fn();

const mockNavigation = {
  reset: jest.fn(),
  navigate: jest.fn(),
};

describe('Unified Authentication Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('authSession.js Utilities', () => {
    test('persistAuthSession stores data correctly into AsyncStorage', async () => {
      await persistAuthSession({
        accessToken: 'access-jwt-123',
        refreshToken: 'refresh-jwt-123',
        role: 'Guide',
        username: 'sarawak_ranger',
        userId: 42,
        stayLoggedIn: true,
      });

      expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
        ['auth_token', 'access-jwt-123'],
        ['innopapp_auth_refresh_token', 'refresh-jwt-123'],
        ['innopapp_auth_stayLoggedIn', 'true'],
        ['innopapp_auth_role', 'Guide'],
        ['innopapp_auth_username', 'sarawak_ranger'],
        ['innopapp_auth_user_id', '42']
      ]);
    });

    test('getStoredAuthSession parses and constructs session layout correctly', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return Promise.resolve('access-abc');
        if (key === 'innopapp_auth_refresh_token') return Promise.resolve('refresh-abc');
        if (key === 'innopapp_auth_stayLoggedIn') return Promise.resolve('true');
        if (key === 'innopapp_auth_role') return Promise.resolve('Admin');
        if (key === 'innopapp_auth_username') return Promise.resolve('john_doe');
        if (key === 'innopapp_auth_user_id') return Promise.resolve('99');
        return Promise.resolve(null);
      });

      const session = await getStoredAuthSession();
      expect(session).toEqual({
        accessToken: 'access-abc',
        refreshToken: 'refresh-abc',
        stayLoggedIn: true,
        role: 'Admin',
        username: 'john_doe',
        userId: '99',
      });
    });

    test('clearAuthSession wipes all authentication storage markers', async () => {
      await clearAuthSession();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(AUTH_STORAGE_KEYS);
    });

    test('refreshAuthSession hits the correct network endpoint and resolves payload data', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, data: { token: 'new-access-token' } }),
      });

      const data = await refreshAuthSession('old-refresh-token');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/refresh'), expect.any(Object));
      expect(data.token).toBe('new-access-token');
    });
  });

  describe('LoadingScreen Logic Integration', () => {
    test('routes straight to Login if no accessToken exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      render(<LoadingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      });
    });

    test('routes straight to Login if stayLoggedIn is unflagged', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return Promise.resolve('token-present');
        if (key === 'innopapp_auth_refresh_token') return Promise.resolve('refresh-present');
        if (key === 'innopapp_auth_stayLoggedIn') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      render(<LoadingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      });
    });

    test('routes straight to Home if user session is functional and authenticated profile evaluates fine', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return Promise.resolve('token-present');
        if (key === 'innopapp_auth_refresh_token') return Promise.resolve('refresh-present');
        if (key === 'innopapp_auth_stayLoggedIn') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      
      requestProfileApi.mockResolvedValueOnce({ success: true });

      render(<LoadingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      });
    });

    test('attempts refresh token update and moves Home if profile validation breaks initially', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return Promise.resolve('token-expired');
        if (key === 'innopapp_auth_refresh_token') return Promise.resolve('valid-refresh');
        if (key === 'innopapp_auth_stayLoggedIn') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      requestProfileApi.mockRejectedValueOnce(new Error('Unauthorized'));

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ 
          success: true, 
          data: { token: 'brand-new-token', refreshToken: 'brand-new-refresh' } 
        }),
      });

      render(<LoadingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      });
    });
  });
});