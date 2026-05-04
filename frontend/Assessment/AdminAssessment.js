import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
	addAssessmentQuestion,
	createAssessment,
	deleteAssessment,
	deleteAssessmentQuestion,
	fetchAllAssessments,
	fetchAssessmentAttempts,
	fetchAssessmentQuestionsAdmin,
	resetUserAttempt,
	updateAssessmentQuestion,
	updateAssessmentSettings,
} from './assessmentApi.js';
import { requestProfileApi } from '../Profile/profileApi.js';

const createBlankQuestion = () => ({
	id: `new-${Date.now()}`,
	type: 'mcq',
	topic: 'General Knowledge',
	question: '',
	options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
	correctAnswer: 0,
	isNew: true,
});

const sameId = (left, right) => String(left) === String(right);

function AdminAssessment({ route, navigation }) {
	const defaultAssessmentId = route?.params?.assessmentId || null;
	const defaultModuleId = route?.params?.moduleId ? String(route.params.moduleId) : '';

	// Tab management
	const [currentTab, setCurrentTab] = useState('assessments'); // 'assessments', 'questions', 'attempts'

	// Assessment state
	const [assessments, setAssessments] = useState([]);
	const [selectedAssessmentId, setSelectedAssessmentId] = useState(defaultAssessmentId);
	const [assessmentModuleId, setAssessmentModuleId] = useState(defaultModuleId);
	const [assessmentTitle, setAssessmentTitle] = useState('');
	const [assessmentDuration, setAssessmentDuration] = useState('120');
	const [assessmentPassingScore, setAssessmentPassingScore] = useState('60');
	const [assessmentAttemptLimit, setAssessmentAttemptLimit] = useState('3');
	const [availableModules, setAvailableModules] = useState([]);

	// Questions state
	const [questions, setQuestions] = useState([]);
	const [selectedQuestionId, setSelectedQuestionId] = useState(null);

	// Attempts state
	const [attempts, setAttempts] = useState([]);

	// UI state
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [statusType, setStatusType] = useState('');
	const [error, setError] = useState('');

	const selectedQuestion = selectedQuestionId
		? questions.find((q) => sameId(q.id, selectedQuestionId))
		: questions[0];

	const moduleNameById = useMemo(() => {
		return availableModules.reduce((acc, module) => {
			acc[String(module.moduleId)] = module.title;
			return acc;
		}, {});
	}, [availableModules]);

	const loadModules = useCallback(async () => {
		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');
			if (!token) {
				setAvailableModules([]);
				return;
			}

			const response = await requestProfileApi('/api/v1/admin/modules', token, {
				method: 'GET',
			});

			const moduleList = Array.isArray(response?.data) ? response.data : [];
			setAvailableModules(
				moduleList.map((module) => ({
					moduleId: module.moduleId,
					title: module.title || `Module ${module.moduleId}`,
				}))
			);
		} catch (_error) {
			setAvailableModules([]);
		}
	}, []);

	// Load questions from backend
	const loadQuestions = useCallback(async () => {
		setLoading(true);
		setError('');
		setStatusMessage('');

		try {
			const { error: fetchError, questions: fetchedQuestions } =
				await fetchAssessmentQuestionsAdmin(selectedAssessmentId);

			if (fetchError) {
				throw new Error(fetchError);
			}

			setQuestions(fetchedQuestions || []);
			if (fetchedQuestions && fetchedQuestions.length > 0) {
				setSelectedQuestionId(String(fetchedQuestions[0].id));
			}

			return fetchedQuestions || [];
		} catch (err) {
			setError(err.message);
			Alert.alert('Error Loading Questions', err.message);
			return [];
		} finally {
			setLoading(false);
		}
	}, [selectedAssessmentId]);

	const clearStatus = () => {
		setStatusMessage('');
		setStatusType('');
	};

	const updateQuestion = (field, value) => {
		clearStatus();
		if (!selectedQuestion) return;

		const updated = {
			...selectedQuestion,
			[field]: value,
		};

		setQuestions((prev) =>
			prev.map((q) => (q.id === selectedQuestion.id ? updated : q))
		);
	};

	const updateOption = (index, value) => {
		clearStatus();
		if (!selectedQuestion) return;

		const newOptions = [...selectedQuestion.options];
		newOptions[index] = value;

		updateQuestion('options', newOptions);
	};

	const updateCorrectAnswer = (value) => {
		clearStatus();
		if (selectedQuestion?.type === 'mcq') {
			updateQuestion('correctAnswer', parseInt(value, 10));
		} else {
			updateQuestion('correctAnswer', value);
		}
	};

	const addQuestion = () => {
		clearStatus();
		const newQuestion = createBlankQuestion();
		setQuestions((prev) => [...prev, newQuestion]);
		setSelectedQuestionId(newQuestion.id);
		setStatusType('info');
		setStatusMessage('New question added. Fill in details and save.');
	};

	const deleteQuestion = async () => {
		if (!selectedQuestion) return;

		if (questions.length <= 1) {
			Alert.alert('Error', 'Assessment must have at least one question.');
			return;
		}

		Alert.alert('Delete Question', 'Are you sure you want to delete this question?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					setStatusType('info');
					setStatusMessage('Deleting question...');
					setSaving(true);
					try {
						const deletedQuestionId = selectedQuestion.id;

						if (!selectedQuestion.isNew) {
							const { error: deleteError } = await deleteAssessmentQuestion(
								selectedAssessmentId,
								selectedQuestion.id
							);
							if (deleteError) throw new Error(deleteError);
						}

						const refreshedQuestions = await loadQuestionsHandler();
						const stillExists = refreshedQuestions.some((question) => sameId(question.id, deletedQuestionId));

						if (stillExists) {
							throw new Error('Question still exists after delete attempt.');
						}

						setStatusType('success');
						setStatusMessage('Question deleted and verified successfully.');
					} catch (err) {
						setStatusType('error');
						setStatusMessage(`Question delete validation failed: ${err.message}`);
						Alert.alert('Error', err.message);
					} finally {
						setSaving(false);
					}
				},
			},
		]);
	};

	const saveQuestion = async () => {
		if (!selectedQuestion) return;

		if (!selectedQuestion.question.trim()) {
			Alert.alert('Validation Error', 'Question text is required.');
			return;
		}

		if (selectedQuestion.type === 'mcq') {
			if (selectedQuestion.options.some((opt) => !opt.trim())) {
				Alert.alert('Validation Error', 'All options must be filled in.');
				return;
			}
			if (selectedQuestion.correctAnswer === '' || selectedQuestion.correctAnswer === -1) {
				Alert.alert('Validation Error', 'Please select the correct answer.');
				return;
			}
		} else if (!selectedQuestion.correctAnswer.trim()) {
			Alert.alert('Validation Error', 'Correct answer is required.');
			return;
		}

		setSaving(true);
		try {
			if (selectedQuestion.isNew) {
				const { error: addError } = await addAssessmentQuestion(
					selectedAssessmentId,
					selectedQuestion.question,
					selectedQuestion.type,
					selectedQuestion.type === 'mcq' ? selectedQuestion.options : [],
					selectedQuestion.correctAnswer
				);

				if (addError) throw new Error(addError);
			} else {
				const { error: updateError } = await updateAssessmentQuestion(
					selectedQuestion.id,
					selectedQuestion.question,
					selectedQuestion.type,
					selectedQuestion.type === 'mcq' ? selectedQuestion.options : [],
					selectedQuestion.correctAnswer
				);

				if (updateError) throw new Error(updateError);
			}

			// Remove isNew flag if it was a new question
			const updated = { ...selectedQuestion };
			delete updated.isNew;
			setQuestions((prev) =>
				prev.map((q) => (q.id === selectedQuestion.id ? updated : q))
			);

			setStatusType('success');
			setStatusMessage('Question saved successfully.');
		} catch (err) {
			Alert.alert('Save Error', err.message);
		} finally {
			setSaving(false);
		}
	};

	// Load assessments for the module
	const loadAssessments = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const { error: fetchError, assessments: fetchedAssessments } =
				await fetchAllAssessments();
			if (fetchError) throw new Error(fetchError);

			setAssessments(fetchedAssessments || []);
			if (fetchedAssessments && fetchedAssessments.length > 0) {
				const selected =
					fetchedAssessments.find((a) => sameId(a.id, selectedAssessmentId)) ||
					fetchedAssessments[0];
				setSelectedAssessmentId(String(selected.id));
				setAssessmentModuleId(String(selected.moduleId || ''));
				setAssessmentTitle(selected.title);
				setAssessmentDuration(String(selected.durationMinutes || 120));
				setAssessmentPassingScore(String(selected.passingScore || 60));
				setAssessmentAttemptLimit(String(selected.attemptLimit || 3));
			} else {
				setSelectedAssessmentId(null);
				setAssessmentModuleId(defaultModuleId);
				setQuestions([]);
				setAttempts([]);
			}

			return fetchedAssessments || [];
		} catch (err) {
			setError(err.message);
			return [];
		} finally {
			setLoading(false);
		}
	}, [defaultModuleId, selectedAssessmentId]);

	// Load questions for selected assessment
	const loadQuestionsHandler = useCallback(async () => {
		if (!selectedAssessmentId) {
			setQuestions([]);
			return [];
		}

		setError('');
		try {
			const { error: fetchError, questions: fetchedQuestions } =
				await fetchAssessmentQuestionsAdmin(selectedAssessmentId);
			if (fetchError) throw new Error(fetchError);

			setQuestions(fetchedQuestions || []);
			if (fetchedQuestions && fetchedQuestions.length > 0) {
				setSelectedQuestionId(String(fetchedQuestions[0].id));
			}

			return fetchedQuestions || [];
		} catch (err) {
			setError(err.message);
			Alert.alert('Error Loading Questions', err.message);
			return [];
		}
	}, [selectedAssessmentId]);

	// Load attempts for selected assessment
	const loadAttempts = useCallback(async () => {
		setError('');
		try {
			const { error: fetchError, attempts: fetchedAttempts } =
				await fetchAssessmentAttempts(selectedAssessmentId);
			if (fetchError) throw new Error(fetchError);

			setAttempts(fetchedAttempts || []);
		} catch (err) {
			setError(err.message);
		}
	}, [selectedAssessmentId]);

	// Load initial data based on active tab
	useEffect(() => {
		loadModules();
	}, [loadModules]);

	// Load initial data based on active tab
	useEffect(() => {
		if (currentTab === 'assessments') {
			loadAssessments();
		} else if (currentTab === 'questions' && selectedAssessmentId) {
			loadQuestionsHandler();
		} else if (currentTab === 'attempts' && selectedAssessmentId) {
			loadAttempts();
		}
	}, [currentTab, loadAssessments, loadQuestionsHandler, loadAttempts, selectedAssessmentId]);

	const createNewAssessment = async () => {
		if (!assessmentTitle.trim()) {
			Alert.alert('Validation Error', 'Assessment title is required.');
			return;
		}

		if (!assessmentModuleId.trim()) {
			Alert.alert('Validation Error', 'Module ID is required.');
			return;
		}

		setSaving(true);
		try {
			const { error: createError, assessmentId: newAssessmentId } =
				await createAssessment(
					parseInt(assessmentModuleId, 10),
					assessmentTitle,
					parseInt(assessmentPassingScore, 10),
					parseInt(assessmentDuration, 10)
				);

			if (createError) throw new Error(createError);

			setStatusType('success');
			setStatusMessage('Assessment created successfully!');
			setAssessmentTitle('');
			setAssessmentModuleId(defaultModuleId);
			setAssessmentDuration('120');
			setAssessmentPassingScore('60');
			loadAssessments();
		} catch (err) {
			Alert.alert('Error Creating Assessment', err.message);
		} finally {
			setSaving(false);
		}
	};

	// Update assessment settings
	const updateSettings = async () => {
		if (!selectedAssessmentId) return;

		setSaving(true);
		try {
			const { error: updateError } = await updateAssessmentSettings(
				selectedAssessmentId,
				parseInt(assessmentPassingScore, 10),
				parseInt(assessmentDuration, 10),
				parseInt(assessmentAttemptLimit, 10)
			);

			if (updateError) throw new Error(updateError);

			setStatusType('success');
			setStatusMessage('Assessment settings updated successfully!');
		} catch (err) {
			Alert.alert('Error Updating Settings', err.message);
		} finally {
			setSaving(false);
		}
	};

	// Reset user attempt
	const resetAttemptConfirm = (attemptId, userName) => {
		Alert.alert(
			'Reset Attempt',
			`Reset attempt for ${userName}? They will be able to retake the assessment.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Reset',
					style: 'destructive',
					onPress: async () => {
						setSaving(true);
						try {
							const { error: resetError } = await resetUserAttempt(
								selectedAssessmentId,
								attemptId
							);

							if (resetError) throw new Error(resetError);

							setStatusType('success');
							setStatusMessage(`Attempt reset for ${userName}.`);
							loadAttempts();
						} catch (err) {
							Alert.alert('Error Resetting Attempt', err.message);
						} finally {
							setSaving(false);
						}
					},
				},
			]
		);
	};

	const openResultVerification = (attempt) => {
		navigation.navigate('AdminResultVerification', {
			result: {
				...attempt,
				parkGuideName: attempt.userName,
				moduleName: assessmentTitle || 'Assessment',
				assessmentId: selectedAssessmentId,
				passingScore: Number(assessmentPassingScore) || 60,
			},
			parkGuideName: attempt.userName,
			moduleName: assessmentTitle || 'Assessment',
			dateAttempt: attempt.submittedAt,
			timeUsedSeconds: attempt.timeUsedSeconds,
			finalScore: attempt.score,
			assessmentId: selectedAssessmentId,
			passingScore: Number(assessmentPassingScore) || 60,
		});
	};

	// Delete assessment
	const deleteAssessmentConfirm = () => {
		const assessment = assessments.find((a) => sameId(a.id, selectedAssessmentId));
		if (!assessment) return;

		Alert.alert(
			'Delete Assessment',
			`Are you sure you want to delete "${assessment.title}"? This cannot be undone.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						setStatusType('info');
						setStatusMessage('Deleting assessment...');
						setSaving(true);
						try {
								const deletedAssessmentId = selectedAssessmentId;

							const { error: deleteError } = await deleteAssessment(
								selectedAssessmentId
							);

							if (deleteError) throw new Error(deleteError);

								const refreshedAssessments = await loadAssessments();
								const stillExists = refreshedAssessments.some((assessmentItem) => sameId(assessmentItem.id, deletedAssessmentId));

								if (stillExists) {
									throw new Error('Assessment still exists after delete attempt.');
								}

								setStatusType('success');
								setStatusMessage('Assessment deleted and verified successfully.');
						} catch (err) {
								setStatusType('error');
								setStatusMessage(`Assessment delete validation failed: ${err.message}`);
								Alert.alert('Error Deleting Assessment', err.message);
						} finally {
							setSaving(false);
						}
					},
				},
			]
		);
	};

	const answeredQuestionCount = useMemo(
		() => questions.filter((q) => q.question.trim().length > 0).length,
		[questions]
	);

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color="#2E6B4D" />
					<Text style={styles.loadingText}>Loading assessment questions...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContainer}>
					<Text style={styles.errorTitle}>Failed to Load Assessment</Text>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={loadQuestions}>
						<Text style={styles.retryButtonText}>Try Again</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tab, currentTab === 'assessments' && styles.tabActive]}
					onPress={() => setCurrentTab('assessments')}
				>
					<Text style={[styles.tabText, currentTab === 'assessments' && styles.tabTextActive]}>Assessments</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, currentTab === 'questions' && styles.tabActive]}
					onPress={() => setCurrentTab('questions')}
				>
					<Text style={[styles.tabText, currentTab === 'questions' && styles.tabTextActive]}>Questions</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, currentTab === 'attempts' && styles.tabActive]}
					onPress={() => setCurrentTab('attempts')}
				>
					<Text style={[styles.tabText, currentTab === 'attempts' && styles.tabTextActive]}>Attempts</Text>
				</TouchableOpacity>
			</View>

			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				{currentTab === 'assessments' && (
					<>
						<View style={styles.headerSection}>
							<Text style={styles.headerKicker}>Admin Panel</Text>
							<Text style={styles.headerTitle}>Assessment Management</Text>
							<Text style={styles.headerSubtitle}>Create and manage assessments</Text>
							<Text style={styles.statsText}>Total: {assessments.length} assessment(s)</Text>
						</View>

						{statusMessage && (
							<View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : statusType === 'error' ? styles.statusError : styles.statusInfo]}>
								<Text style={styles.statusText}>{statusMessage}</Text>
							</View>
						)}

						<View style={styles.card}>
							<Text style={styles.cardTitle}>Create New Assessment</Text>
							<Text style={styles.label}>Module ID</Text>
							<TextInput
								style={styles.input}
								value={assessmentModuleId}
								onChangeText={setAssessmentModuleId}
								placeholder="Enter module ID"
								placeholderTextColor="#AAA"
								keyboardType="number-pad"
							/>
							{availableModules.length > 0 && (
								<>
									<Text style={styles.helperText}>Or select from created modules</Text>
									<ScrollView
										style={styles.moduleListContainer}
										contentContainerStyle={styles.moduleListContent}
										showsVerticalScrollIndicator
										nestedScrollEnabled
									>
										{availableModules.map((module) => {
											const selected = String(module.moduleId) === String(assessmentModuleId);
											return (
												<TouchableOpacity
													key={module.moduleId}
													style={[styles.assessmentItem, selected && styles.assessmentItemActive]}
													onPress={() => setAssessmentModuleId(String(module.moduleId))}
												>
													<View style={{ flex: 1 }}>
														<Text style={styles.assessmentItemTitle}>{module.title}</Text>
														<Text style={styles.assessmentItemSubtitle}>Module ID: {module.moduleId}</Text>
													</View>
												</TouchableOpacity>
											);
										})}
									</ScrollView>
								</>
							)}
							<Text style={styles.label}>Title</Text>
							<TextInput
								style={styles.input}
								value={assessmentTitle}
								onChangeText={setAssessmentTitle}
								placeholder="e.g. Module 1 Final Exam"
								placeholderTextColor="#AAA"
							/>

							<Text style={styles.label}>Duration (minutes)</Text>
							<TextInput
								style={styles.input}
								value={assessmentDuration}
								onChangeText={setAssessmentDuration}
								placeholder="120"
								placeholderTextColor="#AAA"
								keyboardType="number-pad"
							/>

							<Text style={styles.label}>Passing Score (%)</Text>
							<TextInput
								style={styles.input}
								value={assessmentPassingScore}
								onChangeText={setAssessmentPassingScore}
								placeholder="60"
								placeholderTextColor="#AAA"
								keyboardType="number-pad"
							/>

							<Text style={styles.label}>Attempt Limit</Text>
							<TextInput
								style={styles.input}
								value={assessmentAttemptLimit}
								onChangeText={setAssessmentAttemptLimit}
								placeholder="3"
								placeholderTextColor="#AAA"
								keyboardType="number-pad"
							/>

							<TouchableOpacity
								style={[styles.saveButton, saving && styles.saveButtonDisabled]}
								onPress={createNewAssessment}
								disabled={saving}
								activeOpacity={0.8}
							>
								{saving ? (
									<ActivityIndicator color="#FFFFFF" size="small" />
								) : (
									<Text style={styles.saveButtonText}>Create Assessment</Text>
								)}
							</TouchableOpacity>
						</View>

						{assessments.length > 0 && (
							<View style={styles.card}>
								<View style={styles.cardHeader}>
									<Text style={styles.cardTitle}>Existing Assessments</Text>
								</View>
								{assessments.map((a) => (
									<TouchableOpacity
										key={a.id}
										style={[styles.assessmentItem, sameId(selectedAssessmentId, a.id) && styles.assessmentItemActive]}
										onPress={() => {
											setSelectedAssessmentId(String(a.id));
											setAssessmentModuleId(String(a.moduleId || ''));
											setAssessmentTitle(a.title);
											setAssessmentDuration(String(a.durationMinutes));
											setAssessmentPassingScore(String(a.passingScore));
											setAssessmentAttemptLimit(String(a.attemptLimit));
											clearStatus();
										}}
									>
										<View style={{ flex: 1 }}>
											<Text style={styles.assessmentItemTitle}>{a.title}</Text>
											<Text style={styles.assessmentItemSubtitle}>
												{moduleNameById[String(a.moduleId)] || `Module ${a.moduleId}`} • {a.questionCount} questions • Pass: {a.passingScore}%
											</Text>
										</View>
									</TouchableOpacity>
								))}
							</View>
						)}

						{selectedAssessmentId && assessments.find((a) => sameId(a.id, selectedAssessmentId)) && (
							<View style={styles.card}>
								<View style={styles.cardHeader}>
									<Text style={styles.cardTitle}>Assessment Settings</Text>
									<TouchableOpacity
										style={styles.deleteButton}
										onPress={deleteAssessmentConfirm}
										disabled={saving}
									>
										<Text style={styles.deleteButtonText}>DELETE V2</Text>
									</TouchableOpacity>
								</View>

								<Text style={styles.label}>Assessment Title</Text>
								<TextInput
									style={styles.input}
									value={assessmentTitle}
									onChangeText={setAssessmentTitle}
									placeholder="e.g. Module 1 Final Exam"
									placeholderTextColor="#AAA"
								/>

								<Text style={styles.label}>Duration (minutes)</Text>
								<TextInput
									style={styles.input}
									value={assessmentDuration}
									onChangeText={setAssessmentDuration}
									keyboardType="number-pad"
								/>

								<Text style={styles.label}>Passing Score (%)</Text>
								<TextInput
									style={styles.input}
									value={assessmentPassingScore}
									onChangeText={setAssessmentPassingScore}
									keyboardType="number-pad"
								/>

								<Text style={styles.label}>Attempt Limit</Text>
								<TextInput
									style={styles.input}
									value={assessmentAttemptLimit}
									onChangeText={setAssessmentAttemptLimit}
									keyboardType="number-pad"
								/>

								<TouchableOpacity
									style={[styles.saveButton, saving && styles.saveButtonDisabled]}
									onPress={updateSettings}
									disabled={saving}
									activeOpacity={0.8}
								>
									{saving ? (
										<ActivityIndicator color="#FFFFFF" size="small" />
									) : (
										<Text style={styles.saveButtonText}>Save Settings</Text>
									)}
								</TouchableOpacity>
							</View>
						)}
					</>
				)}

				{currentTab === 'questions' && (
					<>
						<View style={styles.headerSection}>
							<Text style={styles.headerKicker}>Admin Panel</Text>
							<Text style={styles.headerTitle}>Question Management</Text>
							<Text style={styles.headerSubtitle}>Edit and manage assessment questions</Text>
							<Text style={styles.statsText}>Questions: {answeredQuestionCount} / {questions.length}</Text>
						</View>

						{statusMessage && (
							<View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : statusType === 'error' ? styles.statusError : styles.statusInfo]}>
								<Text style={styles.statusText}>{statusMessage}</Text>
							</View>
						)}

						{/* Assessment Selector */}
						<View style={styles.card}>
							<Text style={styles.label}>Select Assessment</Text>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.assessmentSelectorContainer}
							>
								{assessments.length === 0 ? (
									<Text style={styles.emptyText}>No assessments available. Create one first.</Text>
								) : (
									assessments.map((assessment) => (
										<TouchableOpacity
											key={assessment.id}
											style={[
												styles.assessmentSelectorButton,
												sameId(selectedAssessmentId, assessment.id) && styles.assessmentSelectorButtonActive,
											]}
											onPress={() => {
												setSelectedAssessmentId(String(assessment.id));
												setAssessmentTitle(assessment.title);
												clearStatus();
											}}
										>
											<Text
												style={[
													styles.assessmentSelectorButtonText,
													sameId(selectedAssessmentId, assessment.id) && styles.assessmentSelectorButtonTextActive,
												]}
											>
												{assessment.title}
											</Text>
										</TouchableOpacity>
									))
								)}
							</ScrollView>
						</View>

						<View style={styles.card}>
							<View style={styles.cardHeader}>
								<Text style={styles.cardTitle}>Questions</Text>
								<TouchableOpacity
									style={styles.addButton}
									onPress={addQuestion}
									disabled={saving}
									activeOpacity={0.8}
								>
									<Text style={styles.addButtonText}>+ Add</Text>
								</TouchableOpacity>
							</View>

							{questions.length === 0 ? (
								<Text style={styles.emptyText}>No questions yet. Add one to get started.</Text>
							) : (
								<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionsList}>
									{questions.map((q, index) => (
										<TouchableOpacity
											key={q.id}
											style={[styles.questionTab, sameId(selectedQuestionId, q.id) && styles.questionTabActive]}
											onPress={() => {
												clearStatus();
												setSelectedQuestionId(String(q.id));
											}}
											activeOpacity={0.7}
										>
											<Text style={[styles.questionTabText, sameId(selectedQuestionId, q.id) && styles.questionTabTextActive]}>
												Q{index + 1}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							)}
						</View>

						{selectedQuestion && (
							<View style={styles.card}>
								<View style={styles.cardHeader}>
									<Text style={styles.cardTitle}>Edit Question</Text>
									<TouchableOpacity
										style={styles.deleteButton}
										onPress={deleteQuestion}
										disabled={saving}
										activeOpacity={0.8}
									>
										<Text style={styles.deleteButtonText}>DELETE V2</Text>
									</TouchableOpacity>
								</View>

								<Text style={styles.label}>Question Type</Text>
								<View style={styles.typeSelector}>
									<TouchableOpacity
										style={[styles.typeOption, selectedQuestion.type === 'mcq' && styles.typeOptionActive]}
										onPress={() => updateQuestion('type', 'mcq')}
									>
										<Text style={[styles.typeOptionText, selectedQuestion.type === 'mcq' && styles.typeOptionTextActive]}>
											Multiple Choice
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.typeOption, selectedQuestion.type === 'fill' && styles.typeOptionActive]}
										onPress={() => updateQuestion('type', 'fill')}
									>
										<Text style={[styles.typeOptionText, selectedQuestion.type === 'fill' && styles.typeOptionTextActive]}>
											Fill Blank
										</Text>
									</TouchableOpacity>
								</View>

								<Text style={styles.label}>Question Topic</Text>
								<TextInput
									style={styles.input}
									value={selectedQuestion.topic}
									onChangeText={(value) => updateQuestion('topic', value)}
									placeholder="e.g. Conservation"
									placeholderTextColor="#AAA"
								/>

								<Text style={styles.label}>Question Text</Text>
								<TextInput
									style={[styles.input, styles.inputLarge]}
									value={selectedQuestion.question}
									onChangeText={(value) => updateQuestion('question', value)}
									placeholder="Enter the question"
									placeholderTextColor="#AAA"
									multiline
									numberOfLines={3}
								/>

								{selectedQuestion.type === 'mcq' ? (
									<>
										<Text style={styles.label}>Answer Options</Text>
										{selectedQuestion.options.map((option, index) => (
											<View key={index} style={styles.optionRow}>
												<TextInput
													style={[styles.input, styles.optionInput]}
													value={option}
													onChangeText={(value) => updateOption(index, value)}
													placeholder={`Option ${index + 1}`}
													placeholderTextColor="#AAA"
												/>
												<TouchableOpacity
													style={[styles.correctCheckbox, selectedQuestion.correctAnswer === index && styles.correctCheckboxActive]}
													onPress={() => updateCorrectAnswer(index)}
												>
													<Text style={styles.correctCheckboxText}>✓</Text>
												</TouchableOpacity>
											</View>
										))}
										<Text style={styles.helperText}>Tap ✓ to mark correct answer</Text>
									</>
								) : (
									<>
										<Text style={styles.label}>Correct Answer</Text>
										<TextInput
											style={[styles.input, styles.inputLarge]}
											value={selectedQuestion.correctAnswer}
											onChangeText={(value) => updateCorrectAnswer(value)}
											placeholder="Enter the correct answer"
											placeholderTextColor="#AAA"
											multiline
											numberOfLines={2}
										/>
									</>
								)}

								<TouchableOpacity
									style={[styles.saveButton, saving && styles.saveButtonDisabled]}
									onPress={saveQuestion}
									disabled={saving}
									activeOpacity={0.8}
								>
									{saving ? (
										<ActivityIndicator color="#FFFFFF" size="small" />
									) : (
										<Text style={styles.saveButtonText}>Save Question</Text>
									)}
								</TouchableOpacity>
							</View>
						)}
					</>
				)}

				{currentTab === 'attempts' && (
					<>
						<View style={styles.headerSection}>
							<Text style={styles.headerKicker}>Admin Panel</Text>
							<Text style={styles.headerTitle}>Student Attempts</Text>
							<Text style={styles.headerSubtitle}>View and manage student submissions</Text>
							<Text style={styles.statsText}>Total: {attempts.length} attempt(s)</Text>
						</View>

						{statusMessage && (
							<View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : statusType === 'error' ? styles.statusError : styles.statusInfo]}>
								<Text style={styles.statusText}>{statusMessage}</Text>
							</View>
						)}

						{/* Assessment Selector */}
						<View style={styles.card}>
							<Text style={styles.label}>Select Assessment</Text>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.assessmentSelectorContainer}
							>
								{assessments.length === 0 ? (
									<Text style={styles.emptyText}>No assessments available.</Text>
								) : (
									assessments.map((assessment) => (
										<TouchableOpacity
											key={assessment.id}
											style={[
												styles.assessmentSelectorButton,
												selectedAssessmentId === assessment.id && styles.assessmentSelectorButtonActive,
											]}
											onPress={() => {
												setSelectedAssessmentId(assessment.id);
												setAssessmentTitle(assessment.title);
												clearStatus();
											}}
										>
											<Text
												style={[
													styles.assessmentSelectorButtonText,
													selectedAssessmentId === assessment.id && styles.assessmentSelectorButtonTextActive,
												]}
											>
												{assessment.title}
											</Text>
										</TouchableOpacity>
									))
								)}
							</ScrollView>
						</View>

						{attempts.length === 0 ? (
							<View style={styles.card}>
								<Text style={styles.emptyText}>No attempts yet.</Text>
							</View>
						) : (
							attempts.map((attempt) => (
								<View key={attempt.id} style={styles.card}>
									<View style={styles.attemptHeader}>
										<View style={{ flex: 1 }}>
											<Text style={styles.attemptName}>{attempt.userName}</Text>
											<Text style={styles.attemptEmail}>{attempt.userEmail}</Text>
										</View>
										<View style={[styles.attemptBadge, attempt.passed ? styles.attemptBadgePass : styles.attemptBadgeFail]}>
											<Text style={styles.attemptBadgeText}>{attempt.score}%</Text>
										</View>
									</View>
									<Text style={styles.attemptDetail}>
										Submitted: {new Date(attempt.submittedAt).toLocaleDateString()} {new Date(attempt.submittedAt).toLocaleTimeString()}
									</Text>
									<Text style={styles.attemptDetail}>Time: {Math.round(attempt.timeUsedSeconds / 60)} min</Text>
									<View style={styles.attemptActionRow}>
										<TouchableOpacity
											style={styles.reviewButton}
											onPress={() => openResultVerification(attempt)}
										>
											<Text style={styles.reviewButtonText}>Review Result</Text>
										</TouchableOpacity>

										<TouchableOpacity
											style={[styles.resetButton, saving && styles.resetButtonDisabled]}
											onPress={() => resetAttemptConfirm(attempt.id, attempt.userName)}
											disabled={saving}
										>
											<Text style={styles.resetButtonText}>Reset Attempt</Text>
										</TouchableOpacity>
									</View>
								</View>
							))
						)}
					</>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#FBFCF8',
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		color: '#3A4D39',
		fontWeight: '600',
	},
	errorTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#D63F3F',
		marginBottom: 8,
	},
	errorText: {
		fontSize: 14,
		color: '#5A5A5A',
		marginBottom: 16,
		textAlign: 'center',
		lineHeight: 20,
	},
	retryButton: {
		backgroundColor: '#4F772D',
		paddingVertical: 10,
		paddingHorizontal: 24,
		borderRadius: 8,
	},
	retryButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
	},
	content: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		paddingBottom: 24,
	},
	headerSection: {
		marginBottom: 16,
	},
	headerKicker: {
		fontSize: 11,
		fontWeight: '700',
		color: '#5A6B51',
		letterSpacing: 0.8,
		marginBottom: 4,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#1A1A1A',
		marginBottom: 6,
		letterSpacing: -0.3,
	},
	headerSubtitle: {
		fontSize: 13,
		fontWeight: '500',
		color: '#666666',
		marginBottom: 8,
		lineHeight: 18,
	},
	statsText: {
		fontSize: 12,
		fontWeight: '700',
		color: '#4F772D',
	},
	statusBox: {
		borderRadius: 10,
		paddingVertical: 11,
		paddingHorizontal: 12,
		marginBottom: 12,
		borderLeftWidth: 4,
	},
	statusSuccess: {
		backgroundColor: '#E8F5E0',
		borderLeftColor: '#4F772D',
	},
	statusError: {
		backgroundColor: '#FFE8E8',
		borderLeftColor: '#D63F3F',
	},
	statusInfo: {
		backgroundColor: '#E8F2FF',
		borderLeftColor: '#1E88E5',
	},
	statusText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#333333',
	},
	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E8EDE2',
		paddingVertical: 14,
		paddingHorizontal: 14,
		marginBottom: 12,
	},
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
	},
	cardTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#1A1A1A',
	},
	label: {
		fontSize: 15,
		fontWeight: '700',
		color: '#3A4D39',
		marginBottom: 6,
		letterSpacing: 0.1,
	},
	input: {
		borderWidth: 1,
		borderColor: '#D8DCF0',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 11,
		fontSize: 14,
		color: '#1A1A1A',
		backgroundColor: '#F9FAFC',
		fontWeight: '500',
		marginBottom: 12,
	},
	inputLarge: {
		textAlignVertical: 'top',
		minHeight: 80,
	},
	addButton: {
		backgroundColor: '#4F772D',
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	addButtonText: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '700',
	},
	emptyText: {
		fontSize: 13,
		fontWeight: '500',
		color: '#999999',
		fontStyle: 'italic',
		textAlign: 'center',
		paddingVertical: 16,
	},
	questionsList: {
		gap: 6,
		paddingVertical: 8,
	},
	questionTab: {
		backgroundColor: '#F5F8F2',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#D8DCF0',
		paddingVertical: 9,
		paddingHorizontal: 14,
		minWidth: 50,
		alignItems: 'center',
	},
	questionTabActive: {
		backgroundColor: '#4F772D',
		borderColor: '#4F772D',
	},
	questionTabText: {
		fontSize: 12,
		fontWeight: '700',
		color: '#3A4D39',
	},
	questionTabTextActive: {
		color: '#FFFFFF',
	},
	typeSelector: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12,
	},
	typeOption: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#D8DCF0',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 10,
		alignItems: 'center',
		backgroundColor: '#F9FAFC',
	},
	typeOptionActive: {
		backgroundColor: '#4F772D',
		borderColor: '#4F772D',
	},
	typeOptionText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#3A4D39',
	},
	typeOptionTextActive: {
		color: '#FFFFFF',
	},
	optionRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 8,
		alignItems: 'center',
	},
	optionInput: {
		flex: 1,
	},
	correctCheckbox: {
		width: 40,
		height: 40,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: '#D8DCF0',
		backgroundColor: '#F9FAFC',
		justifyContent: 'center',
		alignItems: 'center',
	},
	correctCheckboxActive: {
		backgroundColor: '#4F772D',
		borderColor: '#4F772D',
	},
	correctCheckboxText: {
		fontSize: 16,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	helperText: {
		fontSize: 11,
		fontWeight: '500',
		color: '#999999',
		marginBottom: 12,
		marginTop: 4,
	},
	moduleListContainer: {
		maxHeight: 220,
		borderWidth: 1,
		borderColor: '#E8EDE2',
		borderRadius: 10,
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 8,
		paddingTop: 6,
		marginBottom: 6,
	},
	moduleListContent: {
		paddingBottom: 6,
	},
	deleteButton: {
		backgroundColor: '#6B0F1A',
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: '#2A060A',
		shadowColor: '#000000',
		shadowOpacity: 0.16,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 2 },
	elevation: 2,
	},
	deleteButtonText: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '800',
		letterSpacing: 0.6,
	},
	saveButton: {
		backgroundColor: '#4F772D',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginTop: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
	},
	saveButtonDisabled: {
		opacity: 0.6,
	},
	saveButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
	tabBar: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#E8EDE2',
		backgroundColor: '#FFFFFF',
	},
	tab: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		alignItems: 'center',
		borderBottomWidth: 3,
		borderBottomColor: 'transparent',
	},
	tabActive: {
		borderBottomColor: '#4F772D',
	},
	tabText: {
		fontSize: 13,
		fontWeight: '600',
		color: '#999999',
	},
	tabTextActive: {
		color: '#4F772D',
	},
	assessmentItem: {
		flexDirection: 'row',
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: 8,
		marginBottomVertical: 8,
		borderWidth: 1,
		borderColor: '#E8EDE2',
		backgroundColor: '#FBFCF8',
	},
	assessmentItemActive: {
		backgroundColor: '#E8F5E0',
		borderColor: '#4F772D',
	},
	assessmentItemTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: '#1A1A1A',
		marginBottom: 6,
	},
	assessmentItemSubtitle: {
		fontSize: 12,
		fontWeight: '500',
		color: '#666666',
	},
	attemptHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	attemptName: {
		fontSize: 14,
		fontWeight: '700',
		color: '#1A1A1A',
		marginBottom: 2,
	},
	attemptEmail: {
		fontSize: 12,
		fontWeight: '500',
		color: '#666666',
	},
	attemptBadge: {
		width: 60,
		height: 60,
		borderRadius: 30,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	attemptBadgePass: {
		backgroundColor: '#E8F5E0',
	},
	attemptBadgeFail: {
		backgroundColor: '#FFE8E8',
	},
	attemptBadgeText: {
		fontSize: 16,
		fontWeight: '700',
		color: '#1A1A1A',
	},
	attemptDetail: {
		fontSize: 12,
		fontWeight: '500',
		color: '#666666',
		marginBottom: 6,
	},
	attemptActionRow: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 10,
	},
	reviewButton: {
		flex: 1,
		backgroundColor: '#EAF2E0',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		alignItems: 'center',
	},
	reviewButtonText: {
		color: '#3A4D39',
		fontSize: 12,
		fontWeight: '700',
	},
	resetButton: {
		flex: 1,
		backgroundColor: '#FFF3E0',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		alignItems: 'center',
	},
	resetButtonDisabled: {
		opacity: 0.6,
	},
	resetButtonText: {
		color: '#FF9800',
		fontSize: 12,
		fontWeight: '700',
	},
	assessmentSelectorContainer: {
		gap: 8,
		paddingVertical: 4,
	},
	assessmentSelectorButton: {
		backgroundColor: '#F5F8F2',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#D8DCF0',
		paddingVertical: 10,
		paddingHorizontal: 14,
		minWidth: 120,
		alignItems: 'center',
		justifyContent: 'center',
	},
	assessmentSelectorButtonActive: {
		backgroundColor: '#4F772D',
		borderColor: '#4F772D',
	},
	assessmentSelectorButtonText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#3A4D39',
	},
	assessmentSelectorButtonTextActive: {
		color: '#FFFFFF',
	},
});

export default AdminAssessment;
