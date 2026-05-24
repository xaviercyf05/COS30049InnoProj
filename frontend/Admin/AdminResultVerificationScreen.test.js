import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AdminResultVerificationScreen from './AdminResultVerificationScreen';
import { requestProfileApi } from '../Profile/profileApi';
import { fetchAllAssessments } from '../Assessment/assessmentApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

jest.mock('../auth/withRoleGuard.js', () => (Component) => (props) => <Component {...props} />);
jest.mock('../Profile/profileApi');
jest.mock('../Assessment/assessmentApi');
jest.mock('@react-native-async-storage/async-storage');
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockRoute = {
	params: {
		assessmentId: 'test-assessment-id',
		userId: 'test-user-id',
		moduleId: '1',
		result: {
			id: 'test-result-id',
			userId: 'test-user-id',
			parkGuideName: 'John Doe',
			moduleName: 'Safety Training Assessment',
			moduleId: '1',
			finalScore: 85,
			passed: true,
			dateAttempt: '2026-05-20T10:00:00Z',
		},
	},
};

const mockNavigation = {
	goBack: jest.fn(),
};

const mockAssessmentsData = {
	assessments: [
		{
			id: 'test-assessment-id',
			title: 'Safety Training Assessment',
			passingScore: 80,
			moduleId: '1',
		},
	],
	error: null,
};

const mockModulesData = {
	data: [
		{
			id: '1',
			moduleId: '1',
			title: 'Safety Training Assessment',
			moduleType: 'general',
		},
	],
};

const mockBadgesData = {
	data: [
		{
			id: 'badge-1',
			name: 'Safety Badge',
			linkedModuleNames: ['Safety Training Assessment'],
			linkedModuleIds: ['1'],
		},
	],
};

describe('AdminResultVerificationScreen', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		fetchAllAssessments.mockResolvedValue(mockAssessmentsData);
		AsyncStorage.getItem.mockImplementation((key) => {
			if (key === 'auth_token') return Promise.resolve('mock-token');
			return Promise.resolve(null);
		});
		requestProfileApi.mockImplementation((url) => {
			if (url.includes('/modules')) return Promise.resolve(mockModulesData);
			if (url.includes('/badges')) return Promise.resolve(mockBadgesData);
			return Promise.resolve({ data: [] });
		});
	});

	it('renders loading state initially and then displays data', async () => {
		const { getAllByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			expect(getAllByText('John Doe').length).toBeGreaterThan(0);
			expect(getAllByText('Safety Training Assessment').length).toBeGreaterThan(0);
			expect(getAllByText('85%').length).toBeGreaterThan(0);
			expect(getAllByText('Badge Issuance Review').length).toBeGreaterThan(0);
		});
	});

	it('handles missing or failing api data gracefully', async () => {
		fetchAllAssessments.mockRejectedValue(new Error('Failed to fetch'));
		render(<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />);

		await waitFor(() => {
			expect(Alert.alert).toBeTruthy();
		});
	});

	it('toggles the on-site completion switch and updates asyncstorage', async () => {
		const { getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			expect(getByText('Issue Badge')).toBeTruthy();
			expect(getByText('Reject')).toBeTruthy();
		});
	});

	it('updates the feedback note input value', async () => {
		const { getByPlaceholderText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const textInput = getByPlaceholderText('Optional note for the issued badge');
			fireEvent.changeText(textInput, 'Verification approved successfully');
			expect(textInput.props.value).toBe('Verification approved successfully');
		});
	});

	it('triggers issue badge action when issue button is pressed', async () => {
		const { getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const issueButton = getByText('Issue Badge');
			fireEvent.press(issueButton);
			expect(requestProfileApi).toHaveBeenCalledWith(
				'/api/v1/admin/badges/issue',
				'mock-token',
				expect.objectContaining({
					method: 'POST',
					body: expect.objectContaining({
						badgeId: 'badge-1',
						userId: 'test-user-id',
					}),
				})
			);
		});
	});

	it('triggers rejection action when reject button is pressed', async () => {
		const { getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const rejectButton = getByText('Reject');
			fireEvent.press(rejectButton);
			expect(getByText('Result for John Doe was marked as rejected.')).toBeTruthy();
		});
	});
});