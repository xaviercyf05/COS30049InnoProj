import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import * as assessmentApi from './assessmentApi.js';
import GuideAssessment from './GuideAssessment.js';
import SubmittedPage from './SubmittedPage.js';

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
}));

jest.mock('../Profile/profileApi.js', () => ({
	API_ORIGIN: 'https://api.test',
}));

jest.mock('./assessmentApi.js', () => ({
	__esModule: true,
	fetchAssessmentQuestions: jest.fn(),
	submitAssessmentAttempt: jest.fn(),
	fetchAssessmentDetails: jest.fn(),
	checkAttemptEligibility: jest.fn(),
	fetchAssessmentHistory: jest.fn(),
	fetchAllAssessments: jest.fn(),
	addAssessmentQuestion: jest.fn(),
	updateAssessmentQuestion: jest.fn(),
	deleteAssessmentQuestion: jest.fn(),
	fetchAssessmentQuestionsAdmin: jest.fn(),
	createAssessment: jest.fn(),
	updateAssessmentSettings: jest.fn(),
	deleteAssessment: jest.fn(),
	fetchAssessmentAttempts: jest.fn(),
	resetUserAttempt: jest.fn(),
	linkBadgeToAssessment: jest.fn(),
	unlinkBadgeFromAssessment: jest.fn(),
	getAssessmentBadge: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

global.fetch = jest.fn();
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockQuestions = [
	{
		id: 'q1',
		type: 'mcq',
		topic: 'Fauna',
		question: 'What is the primary animal?',
		options: [
			{ id: '1', text: 'Option A' },
			{ id: '2', text: 'Option B' },
		],
	},
	{
		id: 'q2',
		type: 'fill',
		topic: 'Flora',
		question: 'Name the main flower.',
		options: [],
	},
];

describe('Assessment Module Integration and Unit Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('assessmentApi Unit Tests', () => {
		it('should return error when authorization token is missing', async () => {
			AsyncStorage.getItem.mockResolvedValueOnce(null);

			const realApi = jest.requireActual('./assessmentApi.js');
			const result = await realApi.fetchAssessmentQuestions('mod123');
			expect(result.error).toBe('Authentication required');
		});

		it('should submit attempt with formatted answers payload', async () => {
			AsyncStorage.getItem.mockResolvedValueOnce('mock_token');
			global.fetch.mockResolvedValueOnce({
				ok: true,
				headers: { get: () => 'application/json' },
				json: async () => ({
					data: {
						score: 85,
						passed: true,
						correctCount: 2,
						totalQuestions: 2,
					},
				}),
			});

			const answers = { q1: '1', q2: 'Rafflesia' };
			const questions = [
				{ id: 'q1', type: 'mcq' },
				{ id: 'q2', type: 'fill' },
			];

			const realApi = jest.requireActual('./assessmentApi.js');
			const result = await realApi.submitAssessmentAttempt(101, answers, 120, questions);

			expect(result.error).toBeNull();
			expect(result.score).toBe(85);
			expect(result.passed).toBe(true);
			
			const callArguments = global.fetch.mock.calls[0];
			expect(callArguments[0]).toBe('https://api.test/api/v1/assessments/submit');
			expect(callArguments[1].method).toBe('POST');
			
			const bodyParsed = JSON.parse(callArguments[1].body);
			expect(bodyParsed.assessmentId).toBe(101);
			expect(bodyParsed.timeUsedSeconds).toBe(120);
			expect(bodyParsed.answers).toEqual([
				{ questionId: 'q1', optionId: 1 },
				{ questionId: 'q2', answer: 'Rafflesia' }
			]);
		});
	});

	describe('GuideAssessment Standard Component Tests', () => {
		const route = {
			params: {
				moduleId: 'mod123',
				moduleName: 'Maludam National Park',
				moduleOrder: 1,
				totalModules: 5,
			},
		};

		it('should render loading state initially and then display questions', async () => {
			assessmentApi.fetchAssessmentQuestions.mockResolvedValueOnce({
				error: null,
				questions: mockQuestions,
				assessmentId: 101,
			});

			render(<GuideAssessment navigation={mockNavigation} route={route} />);

			expect(screen.getByText('Loading assessment...')).toBeTruthy();

			await waitFor(() => {
				expect(screen.getByText('What is the primary animal?')).toBeTruthy();
				expect(screen.getByText('Name the main flower.')).toBeTruthy();
			});

			expect(screen.getByText('Answered: 0/2')).toBeTruthy();
			expect(screen.getByText('Time Left: 02:00:00')).toBeTruthy();
		});

		it('should track answers progress when interact with inputs', async () => {
			assessmentApi.fetchAssessmentQuestions.mockResolvedValueOnce({
				error: null,
				questions: mockQuestions,
				assessmentId: 101,
			});

			render(<GuideAssessment navigation={mockNavigation} route={route} />);

			await waitFor(() => {
				expect(screen.getByText('Option A')).toBeTruthy();
			});

			fireEvent.press(screen.getByText('Option A'));
			expect(screen.getByText('Answered: 1/2')).toBeTruthy();

			const fillInput = screen.getByPlaceholderText('Type your answer');
			fireEvent.changeText(fillInput, 'Orchid');
			expect(screen.getByText('Answered: 2/2')).toBeTruthy();
		});

		it('should show incomplete warning alert if submission has blank inputs', async () => {
			assessmentApi.fetchAssessmentQuestions.mockResolvedValueOnce({
				error: null,
				questions: mockQuestions,
				assessmentId: 101,
			});

			render(<GuideAssessment navigation={mockNavigation} route={route} />);

			await waitFor(() => {
				expect(screen.getByText('Submit Assessment')).toBeTruthy();
			});

			fireEvent.press(screen.getByText('Submit Assessment'));

			expect(Alert.alert).toHaveBeenCalledWith(
				'Incomplete Assessment',
				expect.stringContaining('You still have 2 unanswered questions'),
				expect.any(Array)
			);
		});

		it('should complete standard submit form logic down to navigation call', async () => {
			assessmentApi.fetchAssessmentQuestions.mockResolvedValueOnce({
				error: null,
				questions: mockQuestions,
				assessmentId: 101,
			});
			assessmentApi.submitAssessmentAttempt.mockResolvedValueOnce({
				error: null,
				score: 90,
				passed: true,
				correctCount: 2,
				feedbackMessage: 'Excellent!',
				attemptId: 55,
				passingScore: 60,
			});

			render(<GuideAssessment navigation={mockNavigation} route={route} />);

			await waitFor(() => {
				expect(screen.getByText('Option A')).toBeTruthy();
			});

			fireEvent.press(screen.getByText('Option A'));
			fireEvent.changeText(screen.getByPlaceholderText('Type your answer'), 'Orchid');

			fireEvent.press(screen.getByText('Submit Assessment'));

			await waitFor(() => {
				expect(mockNavigate).toHaveBeenCalledWith('SubmittedPage', expect.objectContaining({
					score: 90,
					answeredCount: 2,
					totalQuestions: 2,
				}));
			});
		});
	});

	describe('GuideAssessment Countdown Force-Submit Test Block', () => {
		const route = {
			params: {
				moduleId: 'mod123',
				moduleName: 'Maludam National Park',
				moduleOrder: 1,
				totalModules: 5,
			},
		};

		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should trigger automated force submission when countdown reaches zero', async () => {
			assessmentApi.fetchAssessmentQuestions.mockResolvedValueOnce({
				error: null,
				questions: mockQuestions,
				assessmentId: 101,
			});
			assessmentApi.submitAssessmentAttempt.mockResolvedValueOnce({
				error: null,
				score: 0,
				passed: false,
				correctCount: 0,
			});

			render(<GuideAssessment navigation={mockNavigation} route={route} />);

			await act(async () => {
				jest.advanceTimersByTime(1);
			});

			await waitFor(() => {
				expect(screen.queryByText('Loading assessment...')).toBeNull();
			});

			await act(async () => {
				jest.advanceTimersByTime(7200 * 1000);
			});

			expect(Alert.alert).toHaveBeenCalledWith(
				'Time is up',
				'The assessment timer has ended. Your answers will be submitted now.'
			);

			await waitFor(() => {
				expect(assessmentApi.submitAssessmentAttempt).toHaveBeenCalled();
			});
		});
	});

	describe('SubmittedPage Component Tests', () => {
		it('should display passed interface configuration correctly', () => {
			const passedRoute = {
				params: {
					moduleName: 'Maludam Wildlife',
					moduleOrder: 2,
					timeUsed: '00:15:30',
					answeredCount: 10,
					totalQuestions: 10,
					score: 80,
					passingScore: 60,
					correctCount: 8,
					feedbackMessage: 'Great job done!',
				},
			};

			render(<SubmittedPage navigation={mockNavigation} route={passedRoute} />);

			expect(screen.getByText('✓ Passed')).toBeTruthy();
			expect(screen.getByText('Assessment Submitted')).toBeTruthy();
			expect(screen.getByText('Module 2: Maludam Wildlife')).toBeTruthy();
			expect(screen.getByText('80%')).toBeTruthy();
			expect(screen.getByText('8 / 10 correct')).toBeTruthy();
			expect(screen.getByText('00:15:30')).toBeTruthy();
			expect(screen.getByText('Great job done!')).toBeTruthy();
			expect(screen.getByText('Congratulations! You passed the assessment. Your progress has been recorded.')).toBeTruthy();
		});

		it('should display failed interface configuration correctly', () => {
			const failedRoute = {
				params: {
					moduleName: 'Bako Botanical',
					moduleOrder: 3,
					timeUsed: '01:02:15',
					answeredCount: 9,
					totalQuestions: 10,
					score: 40,
					passingScore: 70,
					correctCount: 4,
					feedbackMessage: 'Please read section B again.',
				},
			};

			render(<SubmittedPage navigation={mockNavigation} route={failedRoute} />);

			expect(screen.getByText('✗ Failed')).toBeTruthy();
			expect(screen.getByText('40%')).toBeTruthy();
			expect(screen.getByText('Please read section B again.')).toBeTruthy();
			expect(screen.getByText('You did not pass this assessment. Please review the material and try again.')).toBeTruthy();
		});

		it('should fallback securely to generic layout on lack of params payload', () => {
			render(<SubmittedPage navigation={mockNavigation} route={{}} />);

			expect(screen.getByText('Assessment Submitted')).toBeTruthy();
			expect(screen.getByText('Back to Dashboard')).toBeTruthy();
		});

		it('should navigate back towards main screen when dashboard execution element is triggered', () => {
			render(<SubmittedPage navigation={mockNavigation} route={{}} />);

			const homeButton = screen.getByText('Back to Dashboard');
			fireEvent.press(homeButton);

			expect(mockNavigate).toHaveBeenCalledWith('Home');
		});
	});
});