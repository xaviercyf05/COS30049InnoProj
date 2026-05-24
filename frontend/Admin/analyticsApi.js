import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';

const API_ORIGIN = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.innopappserver.xyz';

export const workbookSheets = [
  {
    key: 'parkGuides',
    title: 'Park Guides',
    subtitle: 'Guide roster, park assignment, active guide coverage, and account management',
    accent: '#6E815D'
  },
  {
    key: 'progress',
    title: 'Progress',
    subtitle: 'Learning module progress and earned badges for all park guides',
    accent: '#3E6F62'
  },
  {
    key: 'modules',
    title: 'Module Enrollment',
    subtitle: 'Module enrollment distribution across park guides',
    accent: '#8A6E46'
  },
  {
    key: 'badges',
    title: 'Badge Distribution',
    subtitle: 'Achievement distribution across park guides',
    accent: '#4D7A72'
  }
];

export const PIE_COLORS = ['#5D745D', '#7A8B68', '#A07C57', '#C2A06E', '#4D7A72', '#5B8B7B', '#7CA08F', '#A9C2B3'];

export function createEmptyAnalyticsData() {
  return workbookSheets.reduce((accumulator, sheet) => {
    accumulator[sheet.key] = {
      title: sheet.title,
      subtitle: sheet.subtitle,
      kpis: [],
      columns: [],
      rows: []
    };
    return accumulator;
  }, {});
}

export function normalizePieSlices(slices) {
  return (slices || []).map((slice, index) => ({
    ...slice,
    value: Number(slice.value) || 0,
    color: slice.color || PIE_COLORS[index % PIE_COLORS.length]
  }));
}

export function normalizeAdminUser(user, index = 0) {
  const userId = user?.userId ?? user?.UserID ?? user?.id ?? user?.ID ?? null;
  const status = String(user?.status || user?.Status || (user?.isActive === false ? 'Inactive' : 'Active')).trim() || 'Active';
  const role = String(user?.role || user?.Role || user?.roleName || '').trim() || 'User';

  return {
    id: String(userId || index),
    userId: userId !== null && userId !== undefined && userId !== '' ? Number(userId) || userId : null,
    username: String(user?.username || user?.Username || '').trim(),
    fullName: String(user?.fullName || user?.FullName || user?.name || '').trim() || 'Unnamed Park Guide',
    email: String(user?.email || user?.Email || '').trim(),
    role,
    status,
    isActive: status.toLowerCase() === 'active',
    joinDate: user?.joinDate || user?.createdAt || user?.CreatedAt || null,
  };
}

export async function fetchAnalyticsDashboardData() {
  let token = null;
  try {
    token = await AsyncStorage.getItem('auth_token');
  } catch (e) {
    token = null;
  }

  // Web builds using Expo may not use AsyncStorage; fallback to localStorage
  if (!token && typeof window !== 'undefined' && window.localStorage) {
    try {
      token = window.localStorage.getItem('auth_token');
    } catch (e) {
      // ignore
    }
  }

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_ORIGIN}/api/v1/admin/analytics/dashboard`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  }

  if (!payload?.success || !payload?.data) {
    throw new Error('Invalid analytics response from server');
  }

  const normalized = { ...createEmptyAnalyticsData(), ...payload.data };

  // Ensure pie slices have numeric values and consistent coloring across sheets
  workbookSheets.forEach((sheet) => {
    if (normalized[sheet.key] && normalized[sheet.key].pieSlices) {
      normalized[sheet.key] = {
        ...normalized[sheet.key],
        pieSlices: normalizePieSlices(normalized[sheet.key].pieSlices)
      };
    }
  });

  return normalized;
}

export async function fetchAdminParkGuideAccounts() {
  const token = await getStoredAuthToken();

  const response = await requestProfileApi('/api/v1/admin/users', token, {
    method: 'GET'
  });

  const users = Array.isArray(response.data) ? response.data : [];

  return users
    .map((user, index) => normalizeAdminUser(user, index))
    .filter((user) => {
      const normalizedRole = String(user.role || '').toLowerCase();
      return normalizedRole !== 'admin' && !normalizedRole.includes('administrator');
    });
}

export async function updateAdminUserStatus(userId, status) {
  const token = await getStoredAuthToken();

  return requestProfileApi(`/api/v1/admin/users/${userId}/status`, token, {
    method: 'PUT',
    body: {
      status,
    }
  });
}

async function getStoredAuthToken() {
  let token = null;

  try {
    token = await AsyncStorage.getItem('auth_token');
  } catch (error) {
    token = null;
  }

  if (!token && typeof window !== 'undefined' && window.localStorage) {
    try {
      token = window.localStorage.getItem('auth_token');
    } catch (error) {
      token = null;
    }
  }

  if (!token) {
    throw new Error('Authentication required');
  }

  return token;
}
