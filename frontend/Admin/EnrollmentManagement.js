import React, { useMemo, useState, useEffect } from 'react';
import {
	Alert,
	FlatList,
	Modal,
	Platform,
	SafeAreaView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import withRoleGuard from '../auth/withRoleGuard.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi, resolveApiAssetUri } from '../Profile/profileApi.js';

const COLORS = {
	bg: '#F7F5EF',
	card: '#FFFFFF',
	heading: '#20372A',
	body: '#4E6257',
	border: '#E5EBDD',
	olive: '#66704B',
	approved: '#2E7D32',
	pending: '#F59E0B',
	rejected: '#C73737',
	verified: '#2563EB',
	soft: '#EDF2E6',
};

const DEFAULT_REQUESTS = [];

function getStatusStyle(status) {
	if (status === 'approved') {
		return { backgroundColor: '#E7F5EB', color: COLORS.approved };
	}

	if (status === 'rejected') {
		return { backgroundColor: '#FDECEC', color: COLORS.rejected };
	}

	return { backgroundColor: '#FFF5DB', color: COLORS.pending };
}

function EnrollmentManagementScreen({ navigation, useSharedChrome = false }) {
	const insets = useSafeAreaInsets();
	const [requests, setRequests] = useState(DEFAULT_REQUESTS);
	const [selectedRequest, setSelectedRequest] = useState(null);
	const [modalVisible, setModalVisible] = useState(false);
	const [notice, setNotice] = useState('');

	const getAuthToken = async () => {
		const token = await AsyncStorage.getItem('auth_token');
		if (!token) throw new Error('Session expired.');
		return token;
	};

	const formatDate = (value) => {
		if (!value) return '';
		try {
			const d = new Date(value);
			return d.toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
		} catch (_e) {
			return String(value);
		}
	};

	const loadRequests = async () => {
		try {
			console.log('[EnrollmentManagement] Loading payment requests...');
			const token = await getAuthToken();
			console.log('[EnrollmentManagement] Token retrieved:', !!token);
			const resp = await requestProfileApi('/api/v1/admin/payments', token, { method: 'GET' });
			console.log('[EnrollmentManagement] API response:', resp);
			const rows = Array.isArray(resp.data) ? resp.data : [];
			console.log('[EnrollmentManagement] Rows:', rows);
			const mapped = rows.map((r) => ({
				id: `P-${r.paymentId}`,
				paymentId: r.paymentId,
				guideName: r.userName || 'Unknown',
				guideId: r.userId,
				park: r.moduleTitle || '-',
				module: r.moduleTitle || '-',
				fee: '-',
				paymentMethod: '-',
				paymentReference: r.reference || '-',
				evidenceLabel: r.evidenceName || (r.evidenceFile || '').split('/').pop() || '-',
				evidenceUrl: r.evidenceFile ? resolveApiAssetUri(r.evidenceFile) : null,
				submittedAt: formatDate(r.createdAt),
				evidenceVerified: r.status === 'approved',
				status: r.status || 'pending',
				note: r.reviewRemark || '',
				raw: r,
			}));

			console.log('[EnrollmentManagement] Mapped requests:', mapped);
			setRequests(mapped);
		} catch (error) {
			console.error('[EnrollmentManagement] Error loading payments:', error);
			setRequests([]);
			setNotice(`Unable to load payment requests: ${error?.message || error}`);
		}
	};

	useEffect(() => {
		loadRequests();
		const unsub = navigation.addListener('focus', () => loadRequests());
		return unsub;
	}, []);

	const summary = useMemo(() => {
		const pending = requests.filter((item) => item.status === 'pending').length;
		const approved = requests.filter((item) => item.status === 'approved').length;
		const rejected = requests.filter((item) => item.status === 'rejected').length;
		const verified = requests.filter((item) => item.evidenceVerified).length;

		return {
			total: requests.length,
			pending,
			approved,
			rejected,
			verified,
		};
	}, [requests]);

	const handleBack = () => {
		if (navigation.canGoBack()) {
			navigation.goBack();
			return;
		}

		navigation.navigate('Home');
	};

	const openEvidence = (request) => {
		setSelectedRequest(request);
		setModalVisible(true);
	};

	const updateRequest = (requestId, updater, successMessage) => {
		setRequests((current) =>
			current.map((item) => (item.id === requestId ? updater(item) : item))
		);
		setNotice(successMessage);
	};

	const verifyEvidence = (requestId) => {
		updateRequest(
			requestId,
			(item) => ({ ...item, evidenceVerified: true, note: 'Evidence verified by admin.' }),
			'Payment evidence marked as verified.'
		);
	};

	const approveRequest = async (request) => {
		if (!request.evidenceVerified) {
			Alert.alert('Verification required', 'Verify the payment evidence before approving this enrollment request.');
			return;
		}

		try {
			const token = await getAuthToken();
			await requestProfileApi(`/api/v1/admin/payments/${request.paymentId}/status`, token, {
				method: 'PUT',
				body: { status: 'approved', remark: 'Approved by admin.' },
			});

			setNotice('Enrollment request approved.');
			loadRequests();
		} catch (error) {
			Alert.alert('Error', error?.message || 'Failed to approve request.');
		}
	};

	const rejectRequest = async (request) => {
		try {
			const token = await getAuthToken();
			await requestProfileApi(`/api/v1/admin/payments/${request.paymentId}/status`, token, {
				method: 'PUT',
				body: { status: 'rejected', remark: 'Rejected by admin.' },
			});

			setNotice('Enrollment request rejected.');
			loadRequests();
		} catch (error) {
			Alert.alert('Error', error?.message || 'Failed to reject request.');
		}
	};

	const renderSummaryCard = (value, label, tone) => (
		<View style={styles.summaryCard}>
			<Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
			<Text style={styles.summaryLabel}>{label}</Text>
		</View>
	);

	return (
		<SafeAreaView style={styles.safeArea}>
			{!useSharedChrome ? (
				<View
					style={[
						styles.topBar,
						{ paddingTop: Platform.OS === 'web' ? 14 : Math.max(10, insets.top + 4) },
					]}
				>
					<TouchableOpacity style={styles.backButton} onPress={handleBack}>
						<Text style={styles.backButtonText}>{'< Back'}</Text>
					</TouchableOpacity>
					<Text style={styles.topTitle}>Enrollment Approvals</Text>
					<View style={styles.topSpacer} />
				</View>
			) : null}

			<FlatList
				data={requests}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.listContent}
				ListHeaderComponent={(
					<View>
						<View style={styles.heroCard}>
							<Text style={styles.heroTagText}>Training Fee Verification</Text>
							<Text style={styles.heroTitle}>Approve module enrollment after payment review</Text>
							<Text style={styles.heroSubtitle}>
								Park guides must settle the training fee first. Verify the payment evidence, then approve the request so they can access the module.
							</Text>
						</View>

						<View style={styles.summaryRow}>
							{renderSummaryCard(summary.total, 'Total requests', COLORS.heading)}
							{renderSummaryCard(summary.pending, 'Pending review', COLORS.pending)}
							{renderSummaryCard(summary.verified, 'Evidence verified', COLORS.verified)}
							{renderSummaryCard(summary.approved, 'Approved', COLORS.approved)}
						</View>

						{notice ? (
							<View style={styles.noticeCard}>
								<Text style={styles.noticeText}>{notice}</Text>
							</View>
						) : null}
					</View>
				)}
				renderItem={({ item }) => {
					const statusStyle = getStatusStyle(item.status);
					const approveDisabled = !item.evidenceVerified || item.status !== 'pending';

					return (
						<View style={styles.card}>
							<View style={styles.cardHeader}>
								<View>
									<Text style={styles.cardTitle}>{item.guideName}</Text>
								</View>
							</View>

							<Text style={styles.detail}>Module: {item.park}</Text>
							<Text style={styles.detail}>Fee: {item.fee}</Text>
							<Text style={styles.detail}>Submitted: {item.submittedAt}</Text>

							<View style={styles.evidenceRow}>
								<View style={[styles.evidencePill, item.evidenceVerified ? styles.evidenceVerified : styles.evidencePending]}>
									<Text style={styles.evidencePillText}>
										{item.evidenceVerified ? 'Evidence verified' : 'Evidence waiting review'}
									</Text>
								</View>
								<Text style={styles.evidenceLabel}>{item.evidenceLabel}</Text>
							</View>

							<View style={styles.actionRow}>
								<TouchableOpacity style={styles.secondaryButton} onPress={() => openEvidence(item)}>
									<Text style={styles.secondaryButtonText}>View Evidence</Text>
								</TouchableOpacity>

								{!item.evidenceVerified && item.status === 'pending' ? (
									<TouchableOpacity style={styles.verifyButton} onPress={() => verifyEvidence(item.id)}>
										<Text style={styles.verifyButtonText}>Mark Verified</Text>
									</TouchableOpacity>
								) : null}
							</View>

							{item.status === 'pending' ? (
								<View style={styles.actionRow}>
									<TouchableOpacity
										style={[styles.approveButton, approveDisabled && styles.approveButtonDisabled]}
										onPress={() => approveRequest(item)}
										disabled={approveDisabled}
									>
										<Text style={styles.approveButtonText}>Approve Enrollment</Text>
									</TouchableOpacity>

									<TouchableOpacity style={styles.rejectButton} onPress={() => rejectRequest(item)}>
										<Text style={styles.rejectButtonText}>Reject</Text>
									</TouchableOpacity>
								</View>
							) : null}
						</View>
					);
				}}
			/>

			<Modal
				animationType="fade"
				transparent
				visible={modalVisible}
				statusBarTranslucent
				onRequestClose={() => setModalVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Payment Evidence</Text>
						{selectedRequest ? (
							<>
								<Text style={styles.modalDetail}>Guide: {selectedRequest.guideName}</Text>
								<Text style={styles.modalDetail}>Module: {selectedRequest.module}</Text>
								<Text style={styles.modalDetail}>Reference: {selectedRequest.paymentReference}</Text>
								<Text style={styles.modalDetail}>File: {selectedRequest.evidenceLabel}</Text>
								{selectedRequest.evidenceUrl ? (
									<TouchableOpacity onPress={() => Linking.openURL(selectedRequest.evidenceUrl)} style={{ marginTop: 8 }}>
										<Text style={{ color: '#2563EB', fontWeight: '700' }}>Open evidence</Text>
									</TouchableOpacity>
								) : null}
								<Text style={styles.modalDetail}>
									Status: {selectedRequest.evidenceVerified ? 'Verified' : 'Pending review'}
								</Text>
								<Text style={styles.modalNote}>{selectedRequest.note}</Text>
							</>
						) : null}

						<TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
							<Text style={styles.modalButtonText}>Close</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: COLORS.bg,
	},
	topBar: {
		backgroundColor: COLORS.card,
		borderBottomWidth: 1,
		borderBottomColor: COLORS.border,
		paddingBottom: 12,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	backButton: {
		backgroundColor: COLORS.soft,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
		minWidth: 92,
		alignItems: 'center',
	},
	backButtonText: {
		color: COLORS.olive,
		fontSize: 12,
		fontWeight: '700',
	},
	topTitle: {
		flex: 1,
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '800',
		color: COLORS.heading,
	},
	topSpacer: {
		width: 92,
	},
	listContent: {
		padding: 16,
		paddingBottom: 36,
	},
	heroCard: {
		backgroundColor: COLORS.card,
		borderRadius: 24,
		padding: 18,
		borderWidth: 1,
		borderColor: COLORS.border,
		marginBottom: 14,
	},
	heroTag: {
		alignSelf: 'flex-start',
		backgroundColor: COLORS.soft,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		marginBottom: 12,
	},
	heroTagText: {
		color: COLORS.olive,
		fontSize: 12,
		fontWeight: '800',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	heroTitle: {
		fontSize: 26,
		fontWeight: '800',
		color: COLORS.heading,
		letterSpacing: -0.6,
	},
	heroSubtitle: {
		marginTop: 8,
		color: COLORS.body,
		lineHeight: 21,
		fontSize: 14,
	},
	summaryRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	summaryCard: {
		width: '48%',
		backgroundColor: COLORS.card,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.border,
		paddingVertical: 14,
		paddingHorizontal: 14,
		marginBottom: 10,
	},
	summaryValue: {
		fontSize: 24,
		fontWeight: '800',
		letterSpacing: -0.4,
	},
	summaryLabel: {
		marginTop: 6,
		color: COLORS.body,
		fontSize: 12,
		fontWeight: '700',
	},
	noticeCard: {
		backgroundColor: '#EEF6FF',
		borderRadius: 16,
		padding: 12,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: '#D8E7FF',
	},
	noticeText: {
		color: '#24508F',
		fontSize: 13,
		fontWeight: '600',
	},
	card: {
		backgroundColor: COLORS.card,
		borderRadius: 22,
		borderWidth: 1,
		borderColor: COLORS.border,
		padding: 16,
		marginBottom: 12,
	},
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 10,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: '800',
		color: COLORS.heading,
	},
	cardMeta: {
		marginTop: 4,
		color: COLORS.body,
		fontSize: 12,
		fontWeight: '600',
	},
	statusBadge: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	statusText: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.4,
	},
	detail: {
		color: COLORS.body,
		fontSize: 13,
		lineHeight: 19,
		marginTop: 3,
	},
	noteText: {
		marginTop: 8,
		color: COLORS.heading,
		fontSize: 13,
		lineHeight: 19,
	},
	evidenceRow: {
		marginTop: 12,
	},
	evidencePill: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	evidenceVerified: {
		backgroundColor: '#EAF5FF',
	},
	evidencePending: {
		backgroundColor: '#FFF3D9',
	},
	evidencePillText: {
		fontSize: 11,
		fontWeight: '800',
		color: COLORS.heading,
		letterSpacing: 0.3,
	},
	evidenceLabel: {
		marginTop: 6,
		color: '#6A766C',
		fontSize: 12,
	},
	actionRow: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 12,
	},
	secondaryButton: {
		flex: 1,
		backgroundColor: COLORS.soft,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: 'center',
	},
	secondaryButtonText: {
		color: COLORS.olive,
		fontSize: 13,
		fontWeight: '800',
	},
	verifyButton: {
		flex: 1,
		backgroundColor: '#E0ECFF',
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: 'center',
	},
	verifyButtonText: {
		color: COLORS.verified,
		fontSize: 13,
		fontWeight: '800',
	},
	approveButton: {
		flex: 1,
		backgroundColor: COLORS.approved,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: 'center',
	},
	approveButtonDisabled: {
		opacity: 0.45,
	},
	approveButtonText: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '800',
	},
	rejectButton: {
		width: 90,
		backgroundColor: '#FFECEC',
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: 'center',
	},
	rejectButtonText: {
		color: COLORS.rejected,
		fontSize: 13,
		fontWeight: '800',
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(18, 29, 21, 0.54)',
		justifyContent: 'center',
		padding: 20,
	},
	modalCard: {
		backgroundColor: COLORS.card,
		borderRadius: 22,
		padding: 18,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '800',
		color: COLORS.heading,
	},
	modalDetail: {
		marginTop: 8,
		color: COLORS.body,
		fontSize: 14,
		lineHeight: 20,
	},
	modalNote: {
		marginTop: 12,
		color: COLORS.heading,
		fontSize: 14,
		lineHeight: 20,
	},
	modalButton: {
		marginTop: 16,
		backgroundColor: COLORS.olive,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: 'center',
	},
	modalButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '800',
	},
});

export default withRoleGuard(EnrollmentManagementScreen, {
	allowedRoles: ['Admin'],
	screenName: 'Enrollment Approvals',
});
