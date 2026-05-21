import { NativeModules, Platform } from 'react-native';

function getNativePasskeysModule() {
  return NativeModules?.ReactNativePasskeys || null;
}

function getWebPasskeysModule() {
  try {
    return require('react-native-passkeys');
  } catch (error) {
    return null;
  }
}

export function supportsPasskeys() {
  if (Platform.OS === 'web') {
    return typeof globalThis !== 'undefined' && typeof globalThis.PublicKeyCredential !== 'undefined';
  }

  return !!getNativePasskeysModule();
}

export async function createPasskey(optionsJSON) {
  if (Platform.OS === 'web') {
    const webPasskeys = getWebPasskeysModule();

    if (!webPasskeys) {
      throw new Error('Passkeys are not available in this browser runtime.');
    }

    return webPasskeys.create(optionsJSON);
  }

  const nativePasskeys = getNativePasskeysModule();

  if (!nativePasskeys) {
    throw new Error('Passkeys are not available in this Android runtime. Use a development build with the native passkeys module installed.');
  }

  return nativePasskeys.create(optionsJSON);
}

export async function getPasskey(optionsJSON) {
  if (Platform.OS === 'web') {
    const webPasskeys = getWebPasskeysModule();

    if (!webPasskeys) {
      throw new Error('Passkeys are not available in this browser runtime.');
    }

    return webPasskeys.get(optionsJSON);
  }

  const nativePasskeys = getNativePasskeysModule();

  if (!nativePasskeys) {
    throw new Error('Passkeys are not available in this Android runtime. Use a development build with the native passkeys module installed.');
  }

  return nativePasskeys.get(optionsJSON);
}