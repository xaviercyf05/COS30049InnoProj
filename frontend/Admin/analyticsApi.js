import AsyncStorage from '@react-native-async-storage/async-storage';

const API_ORIGIN = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.innopappserver.xyz';

export const workbookSheets = [
  {
    key: 'parkGuides',
    title: 'Park Guides',
    subtitle: 'Guide roster, park assignment, and active guide coverage',
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
  },
  {
    key: 'station',
    title: 'Station Coverage',
    subtitle: 'Park guides assigned to each station',
    accent: '#B55A4C'
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
    color: slice.color || PIE_COLORS[index % PIE_COLORS.length]
  }));
}

export async function fetchAnalyticsDashboardData() {
  const token = await AsyncStorage.getItem('innopapp_auth_token');
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

  if (normalized.modules) {
    normalized.modules = {
      ...normalized.modules,
      pieSlices: normalizePieSlices(normalized.modules.pieSlices)
    };
  }

  if (normalized.badges) {
    normalized.badges = {
      ...normalized.badges,
      pieSlices: normalizePieSlices(normalized.badges.pieSlices)
    };
  }

  return normalized;
}
