import { Platform } from 'react-native';

const API_ORIGIN = 'https://api.innopappserver.xyz';
const PROFILE_IMAGE_BASE_URL = `${API_ORIGIN}/uploads/profile-images`;

function getWebImageBaseUrl() {
  const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;

  if (configuredProxy) {
    return `${configuredProxy}/uploads/profile-images`;
  }

  return PROFILE_IMAGE_BASE_URL;
}

const getApiBaseUrls = () => {
  // Default to direct backend access on every platform.
  const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;

  if (configuredProxy) {
    return Platform.OS === 'web'
      ? [...new Set([configuredProxy, API_ORIGIN])]
      : [API_ORIGIN];
  }

  return [API_ORIGIN];
};

const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (isJson) {
    return response.json();
  }

  const text = await response.text();
  return { message: text };
};

export function resolveProfileImageUri(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }

  const normalizedPath = imagePath.trim().replace(/\\/g, '/');

  if (!normalizedPath) {
    return null;
  }

  if (/^(data:|blob:|file:)/i.test(normalizedPath)) {
    return normalizedPath;
  }

  const imageBaseUrl = Platform.OS === 'web' ? getWebImageBaseUrl() : PROFILE_IMAGE_BASE_URL;

  if (/^https?:/i.test(normalizedPath)) {
    if (Platform.OS === 'web' && normalizedPath.includes('/uploads/profile-images/')) {
      const filePart = normalizedPath.split('/uploads/profile-images/')[1]?.split('?')[0]?.split('#')[0];
      if (filePart) {
        return `${imageBaseUrl}/${filePart}`;
      }
    }

    return normalizedPath;
  }

  const uploadsSegmentWithSlash = '/uploads/profile-images/';
  const uploadsSegmentNoSlash = 'uploads/profile-images/';
  let uploadsIndex = normalizedPath.indexOf(uploadsSegmentWithSlash);
  let segmentLength = uploadsSegmentWithSlash.length;

  if (uploadsIndex < 0) {
    uploadsIndex = normalizedPath.indexOf(uploadsSegmentNoSlash);
    segmentLength = uploadsSegmentNoSlash.length;
  }

  if (uploadsIndex >= 0) {
    const filePart = normalizedPath.slice(uploadsIndex + segmentLength).split('?')[0].split('#')[0];
    if (filePart) {
      return `${imageBaseUrl}/${filePart}`;
    }
  }

  if (!normalizedPath.includes('/')) {
    return `${imageBaseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/uploads/profile-images/')) {
    const filePart = normalizedPath.replace('/uploads/profile-images/', '').split('?')[0].split('#')[0];
    if (filePart) {
      return `${imageBaseUrl}/${filePart}`;
    }
  }

  return `${API_ORIGIN}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

export function pickProfileImagePath(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  return (
    profile.profileImageUrl ||
    profile.ProfileImageUrl ||
    profile.profileImageURL ||
    profile.avatarUrl ||
    null
  );
}

export async function requestProfileApi(path, token, options = {}) {
  const baseUrls = getApiBaseUrls();
  const attemptedUrls = [];
  let lastNetworkError = null;

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}${path}`;
    attemptedUrls.push(url);

    try {
      const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body && !isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        body: isFormDataBody
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });

      const payload = await parseResponseBody(response);

      if (!response.ok) {
        const error = new Error(payload?.message || `Request failed with status ${response.status}.`);
        error.status = response.status;
        error.payload = payload;
        error.attemptedUrls = attemptedUrls;
        throw error;
      }

      return {
        data: payload?.data ?? payload,
        message: payload?.message || '',
        attemptedUrls,
      };
    } catch (error) {
      if (typeof error?.status === 'number') {
        throw error;
      }

      lastNetworkError = error;
    }
  }

  const fallbackError = new Error(
    `Unable to reach API. Tried: ${attemptedUrls.join(', ')}`
  );
  fallbackError.cause = lastNetworkError;
  fallbackError.attemptedUrls = attemptedUrls;
  throw fallbackError;
}
