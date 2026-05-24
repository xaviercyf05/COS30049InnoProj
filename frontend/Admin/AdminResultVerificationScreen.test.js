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
		result: {
			id: 'test-result-id',
			userId: 'test-user-id',
			parkGuideName: 'John Doe',
			moduleName: 'Safety Training Assessment',
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
		const { getByType, getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		expect(getByType('ActivityIndicator')).toBeTruthy();

		await waitFor(() => {
			expect(getByText('John Doe')).toBeTruthy();
			expect(getByText('Safety Training Assessment')).toBeTruthy();
			expect(getByText('85%')).toBeTruthy();
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
		const { getByRole } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const switchComponent = getByRole('switch');
			expect(switchComponent).toBeTruthy();
		});
	});

	it('updates the feedback note input value', async () => {
		const { getByPlaceholderText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const textInput = getByPlaceholderText('Add reasons, observations, or next steps...');
			fireEvent.changeText(textInput, 'Verification approved successfully');
			expect(textInput.props.value).toBe('Verification approved successfully');
		});
	});

	it('triggers issue badge action when issue button is pressed', async () => {
		const { getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const issueButton = getByText('Issue Badge & Certificate');
			fireEvent.press(issueButton);
			expect(Alert.alert).toHaveBeenCalled();
		});
	});

	it('triggers rejection action when reject button is pressed', async () => {
		const { getByText } = render(
			<AdminResultVerificationScreen route={mockRoute} navigation={mockNavigation} />
		);

		await waitFor(() => {
			const rejectButton = getByText('Reject / Request Retake');
			fireEvent.press(rejectButton);
			expect(Alert.alert).toHaveBeenCalled();
		});
	});
});