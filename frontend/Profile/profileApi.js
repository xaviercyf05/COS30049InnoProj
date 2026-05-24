import { Platform } from 'react-native';

export const API_ORIGIN = 'https://api.innopappserver.xyz';
const PROFILE_IMAGE_BASE_URL = `${API_ORIGIN}/uploads/profile-images`;

function getWebImageBaseUrl() {
  const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;

  if (configuredProxy) {
    return `${configuredProxy}/uploads/profile-images`;
  }

  return PROFILE_IMAGE_BASE_URL;
}

export const getApiBaseUrls = () => {
  // Default to direct backend access on every platform.
  const configuredProxy = process.env.EXPO_PUBLIC_API_WEB_PROXY;

  if (configuredProxy) {
    return Platform.OS === 'web'
      ? [...new Set([configuredProxy, API_ORIGIN])]
      : [API_ORIGIN];
  }

  return [API_ORIGIN];
};

function inferImageMimeType(imageAsset) {
  const explicitMimeType = String(imageAsset?.mimeType || imageAsset?.type || '').trim();

  if (explicitMimeType.toLowerCase().startsWith('image/')) {
    return explicitMimeType;
  }

  const fileName = String(imageAsset?.fileName || imageAsset?.name || '').toLowerCase();

  if (fileName.endsWith('.png')) {
    return 'image/png';
  }

  if (fileName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (fileName.endsWith('.gif')) {
    return 'image/gif';
  }

  if (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg')) {
    return 'image/jpeg';
  }

  return 'image/jpeg';
}

export function resolveApiAssetUri(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') {
    return null;
  }

  const normalizedPath = assetPath.trim().replace(/\\/g, '/');

  if (!normalizedPath) {
    return null;
  }

  if (/^(data:|blob:|file:)/i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (/^https?:/i.test(normalizedPath)) {
    return normalizedPath;
  }

  const preferredBaseUrl = getApiBaseUrls()[0] || API_ORIGIN;
  const normalizedBaseUrl = String(preferredBaseUrl).replace(/\/+$/, '');
  const normalizedRelativePath = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;

  return `${normalizedBaseUrl}${normalizedRelativePath}`;
}

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

export async function uploadModuleCoverImage(token, imageAsset) {
  if (!imageAsset || (!imageAsset.file && !imageAsset.uri)) {
    throw new Error('Please select an image before uploading.');
  }

  const formData = new FormData();

  if (imageAsset.file) {
    formData.append('coverImage', imageAsset.file);
  } else {
    const fileName =
      imageAsset.fileName ||
      imageAsset.name ||
      `module-cover-${Date.now()}.jpg`;

    formData.append('coverImage', {
      uri: imageAsset.uri,
      name: fileName,
      type: inferImageMimeType(imageAsset),
    });
  }

  const response = await requestProfileApi('/api/v1/admin/modules/cover-image', token, {
    method: 'POST',
    body: formData,
  });

  const moduleImageUrl = String(response?.data?.moduleImageUrl || '').trim();

  if (!moduleImageUrl) {
    throw new Error('Cover image upload succeeded but no URL was returned.');
  }

  return moduleImageUrl;
}
