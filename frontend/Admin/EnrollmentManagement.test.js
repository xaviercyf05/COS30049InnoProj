import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EnrollmentManagementScreen from './EnrollmentManagement';

// 1. Define the mock data
const mockPaymentsData = {
	data: [
		{
			paymentId: '123',
			userName: 'John Doe',
			userId: 'user1',
			moduleId: 'mod1',
			moduleTitle: 'Forestry 101',
			modulePrice: '100.00',
			reference: 'REF123',
			evidenceName: 'receipt.pdf',
			evidenceFile: '/files/receipt.pdf',
			createdAt: '2023-10-01T10:00:00Z',
			status: 'pending',
			reviewRemark: '',
		},
	],
};

// 2. Create a trackable, re-mockable Jest function wrapper prefixed with "mock"
const mockRequestProfileApiImpl = jest.fn();

// 3. Mock the profile API module safely using the wrapper
jest.mock('../Profile/profileApi.js', () => ({
	API_ORIGIN: 'http://mock-api',
	getApiBaseUrls: jest.fn(() => ['http://mock-api']),
	requestProfileApi: (...args) => mockRequestProfileApiImpl(...args),
	resolveApiAssetUri: jest.fn((uri) => `http://mock-api${uri}`),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(() => Promise.resolve('mock-token')),
}));

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../auth/withRoleGuard.js', () => (Component) => Component);

const mockNavigation = {
	addListener: jest.fn((event, callback) => {
		if (event === 'focus') {
			callback();
		}
		return jest.fn();
	}),
	canGoBack: jest.fn(() => true),
	goBack: jest.fn(),
	navigate: jest.fn(),
};

describe('EnrollmentManagementScreen', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		AsyncStorage.getItem.mockResolvedValue('mock-token');
		// Reset implementation and provide default successful data resolve for every test
		mockRequestProfileApiImpl.mockReset();
		mockRequestProfileApiImpl.mockImplementation(() => Promise.resolve(mockPaymentsData));
	});

	it('renders list and summary metrics', async () => {
		const { getByText } = render(<EnrollmentManagementScreen navigation={mockNavigation} />);
		await waitFor(() => {
			expect(getByText('John Doe')).toBeTruthy();
			expect(getByText('Module: Forestry 101')).toBeTruthy();
		});
	});

	it('marks evidence as verified', async () => {
		const { getByText, queryByText } = render(<EnrollmentManagementScreen navigation={mockNavigation} />);
		await waitFor(() => expect(getByText('John Doe')).toBeTruthy());
		
		const verifyButton = getByText('Mark Verified');
		fireEvent.press(verifyButton);
		
		await waitFor(() => {
			expect(queryByText('Mark Verified')).toBeNull();
		});
	});

	it('approves enrollment request', async () => {
		const { getByText, queryByText } = render(<EnrollmentManagementScreen navigation={mockNavigation} />);
		await waitFor(() => expect(getByText('John Doe')).toBeTruthy());
		
		// Evidence must be verified before approval becomes clickable
		fireEvent.press(getByText('Mark Verified'));
		await waitFor(() => expect(queryByText('Mark Verified')).toBeNull());
		
		const approveButton = getByText('Approve Enrollment');
		fireEvent.press(approveButton);
		
		await waitFor(() => {
			expect(mockRequestProfileApiImpl).toHaveBeenCalledWith(
				'/api/v1/admin/payments/123/status',
				'mock-token',
				{ method: 'PUT', body: { status: 'approved', remark: 'Approved by admin.' } }
			);
		});
	});

	it('rejects enrollment request', async () => {
		const { getByText } = render(<EnrollmentManagementScreen navigation={mockNavigation} />);
		await waitFor(() => expect(getByText('John Doe')).toBeTruthy());
		
		const rejectButton = getByText('Reject');
		fireEvent.press(rejectButton);
		
		await waitFor(() => {
			expect(mockRequestProfileApiImpl).toHaveBeenCalledWith(
				'/api/v1/admin/payments/123/status',
				'mock-token',
				{ method: 'PUT', body: { status: 'rejected', remark: 'Rejected by admin.' } }
			);
		});
	});

	it('opens view evidence modal', async () => {
		const { getByText } = render(<EnrollmentManagementScreen navigation={mockNavigation} />);
		await waitFor(() => expect(getByText('John Doe')).toBeTruthy());
		
		const viewButton = getByText('View Evidence');
		fireEvent.press(viewButton);
		
		expect(getByText('Payment Evidence')).toBeTruthy();
		expect(getByText('Reference: REF123')).toBeTruthy();
	});
});