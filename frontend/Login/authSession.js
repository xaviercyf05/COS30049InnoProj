import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN, getApiBaseUrls } from '../Profile/profileApi.js';
import { Platform } from 'react-native';

export const AUTH_STORAGE_KEYS = [
  'auth_token',
  'innopapp_auth_refresh_token',
  'innopapp_auth_role',
  'innopapp_auth_username',
  'innopapp_auth_user_id',
  'innopapp_auth_stayLoggedIn',
];

export async function persistAuthSession({
  accessToken,
  refreshToken,
  role,
  username,
  userId,
  stayLoggedIn,
}) {
  const sessionPairs = [
    ['auth_token', accessToken],
    ['innopapp_auth_refresh_token', refreshToken],
    ['innopapp_auth_stayLoggedIn', String(!!stayLoggedIn)],
  ];

  if (role) {
    sessionPairs.push(['innopapp_auth_role', role]);
  }

  if (username) {
    sessionPairs.push(['innopapp_auth_username', username]);
  }

  if (userId !== undefined && userId !== null) {
    sessionPairs.push(['innopapp_auth_user_id', String(userId)]);
  }

  await AsyncStorage.multiSet(sessionPairs);
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
}

export async function getStoredAuthSession() {
  const [accessToken, refreshToken, stayLoggedIn, role, username, userId] = await Promise.all([
    AsyncStorage.getItem('auth_token'),
    AsyncStorage.getItem('innopapp_auth_refresh_token'),
    AsyncStorage.getItem('innopapp_auth_stayLoggedIn'),
    AsyncStorage.getItem('innopapp_auth_role'),
    AsyncStorage.getItem('innopapp_auth_username'),
    AsyncStorage.getItem('innopapp_auth_user_id'),
  ]);

  return {
    accessToken,
    refreshToken,
    stayLoggedIn: stayLoggedIn === 'true',
    role,
    username,
    userId,
  };
}

export async function refreshAuthSession(refreshToken) {
  const baseUrls = Platform.OS === 'web' ? getApiBaseUrls() : [API_ORIGIN];
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.toLowerCase().includes('application/json')
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok || !payload?.success || !payload?.data?.token) {
        const error = new Error(payload?.message || 'Unable to refresh session.');
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to refresh session.');
}