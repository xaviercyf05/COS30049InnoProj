import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MFASettings from './MFASettings';
import { supportsPasskeys, createPasskey } from './passkeyClient';
import withRoleGuard from './withRoleGuard';
import { requestProfileApi } from '../Profile/profileApi';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('../Profile/profileApi', () => ({
  requestProfileApi: jest.fn(),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.ReactNativePasskeys = {
    create: jest.fn(),
    get: jest.fn(),
  };
  RN.Alert.alert = jest.fn();
  return RN;
});

global.fetch = jest.fn();

const DummyComponent = () => <React.Fragment />;

describe('Security Modules Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('passkeyClient.js Utilities', () => {
    const { ReactNativePasskeys } = require('react-native').NativeModules;

    it('should correctly assert passkey support status on native platforms', () => {
      Platform.OS = 'android';
      expect(supportsPasskeys()).toBe(true);
    });

    it('should route native registration parameters straight to the native bridge payload', async () => {
      Platform.OS = 'android';
      const mockOptions = { challenge: 'abcdef' };
      ReactNativePasskeys.create.mockResolvedValue({ id: 'cred_123' });

      const result = await createPasskey(mockOptions);
      expect(ReactNativePasskeys.create).toHaveBeenCalledWith(mockOptions);
      expect(result).toEqual({ id: 'cred_123' });
    });
  });

  describe('withRoleGuard HOC Wrapper', () => {
    const mockNavigation = {
      reset: jest.fn(),
      navigate: jest.fn(),
    };

    it('should kick non-authenticated anonymous traffic out back to the Login gateway', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      const GuardedScreen = withRoleGuard(DummyComponent);

      render(<GuardedScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      });
    });

    it('should successfully pass authorized identities onwards to the underlying route entry point', async () => {
      AsyncStorage.getItem.mockResolvedValue('valid_token');
      requestProfileApi.mockResolvedValue({
        data: { role: 'Admin', viewerRole: 'Admin' }
      });

      const GuardedScreen = withRoleGuard(DummyComponent, { allowedRoles: ['Admin'] });
      const { queryByText } = render(<GuardedScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(queryByText('Checking access...')).toBeNull();
        expect(queryByText('Restricted Page')).toBeNull();
      });
    });

    it('should completely block accounts missing necessary elevated clearance tiers', async () => {
      AsyncStorage.getItem.mockResolvedValue('valid_token');
      requestProfileApi.mockResolvedValue({
        data: { role: 'User' }
      });

      const GuardedScreen = withRoleGuard(DummyComponent, { 
        allowedRoles: ['Admin'], 
        screenName: 'Admin Control Room' 
      });
      const { getByText } = render(<GuardedScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByText('Restricted Page')).toBeTruthy();
        expect(getByText(/Access denied. Admin Control Room is only available to Admin/)).toBeTruthy();
      });
    });
  });

  describe('MFASettings Component UI & Network Actions', () => {
    const defaultProps = {
      token: 'user_jwt_token',
      userId: 'user_123',
      onMFAStatusChange: jest.fn(),
    };

    it('should query backend infrastructure on mount to update existing configuration snapshots', async () => {
      AsyncStorage.getItem.mockResolvedValue('user_jwt_token');
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { enabled: true, setupAt: '2026-01-01T00:00:00.000Z', recoveryCodesRemaining: 8, totalRecoveryCodes: 10 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { passkeys: [] } }),
        });

      const { getByText } = render(<MFASettings {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('🔒 Enabled')).toBeTruthy();
        expect(getByText('Recovery Codes: 8 / 10')).toBeTruthy();
      });
    });

    it('should orchestrate structural setups cleanly inside the multistep TOTP confirmation workflow', async () => {
      AsyncStorage.getItem.mockResolvedValue('user_jwt_token');

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { enabled: false } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { passkeys: [] } }),
        });

      const { getByText } = render(<MFASettings {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('🔓 Disabled')).toBeTruthy();
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            qrCode: 'https://link-to-qr.com/image.png',
            secret: 'JBSWY3DPEHPK3PXP',
            recoveryCodes: ['ABCD-1234', 'EFGH-5678'],
          },
        }),
      });

      const enableBtn = getByText('Enable Two-Factor Authentication');
      fireEvent.press(enableBtn);

      await waitFor(() => {
        expect(getByText('Set Up Two-Factor Authentication')).toBeTruthy();
        expect(getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
        expect(getByText('ABCD-1234')).toBeTruthy();
      });
    });
  });
});