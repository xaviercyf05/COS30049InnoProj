import React, { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	ImageBackground,
	Platform,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginPage from './Login/LoginPage.js';
import LoadingScreen from './Login/LoadingScreen.js';
import RegisterScreen from './Register/RegisterScreen.js';
import SubmissionScreen from './Register/SubmissionScreen.js';
import ModuleScreen from './Module/ModuleScreen.js';
import GuideAssessment from './Assessment/GuideAssessment.js';
import AssessmentSubmittedPage from './Assessment/SubmittedPage.js';
import AdminAssessment from './Assessment/AdminAssessment.js';
import AnnouncementScreen from './Announcement/AnnouncementScreen.js';
import BadgeScreen from './Badge/BadgePage.js';
import AddModuleScreen from './Admin/AddModuleScreen.js';
import AdminModuleManagerScreen from './Admin/AdminModuleManagerScreen.js';
import AdminAnnouncementScreen from './Admin/AdminAnnouncementScreen.js';
import AdminRegistrationManagementScreen from './Admin/AdminRegistrationManagementScreen.js';
import BadgeManagementScreen from './Admin/BadgeManagementScreen.js';
import AddBadgeScreen from './Admin/AddBadgeScreen.js';
import EditBadgeScreen from './Admin/EditBadgeScreen.js';
import ProfileScreen from './Profile/ProfileScreen.js';
import EditProfileScreen from './Profile/EditProfileScreen.js';
import {
	pickProfileImagePath,
	requestProfileApi,
	resolveApiAssetUri,
	resolveProfileImageUri,
} from './Profile/profileApi.js';

const Stack = createNativeStackNavigator();
const SESSION_STORAGE_KEYS = [
	'innopapp_auth_token',
	'innopapp_auth_role',
	'innopapp_auth_username',
	'innopapp_auth_user_id',
];

function AdminFeatureScreen({ route }) {
	const title = route?.params?.title || 'Admin Feature';
	const description =
		route?.params?.description ||
		'This feature is available in the admin dashboard flow and can be wired to backend APIs next.';

	return (
		<View style={styles.adminFeatureContainer}>
			<Text style={styles.adminFeatureTitle}>{title}</Text>
			<Text style={styles.adminFeatureText}>{description}</Text>
		</View>
	);
}

function HomeScreen({ navigation }) {
	const insets = useSafeAreaInsets();
	const isMobile = Platform.OS !== 'web';
	const statusBarInset =
		Platform.OS === 'android'
			? StatusBar.currentHeight || insets.top || 0
			: insets.top;
	const headerTopPadding = isMobile
		? Math.max(12, statusBarInset + 6)
		: Math.max(10, statusBarInset + 4);
	const [menuVisible, setMenuVisible] = useState(false);
	const [notificationVisible, setNotificationVisible] = useState(false);
	const [showAllNotifications, setShowAllNotifications] = useState(false);
	const [profile, setProfile] = useState(null);
	const [profileLoading, setProfileLoading] = useState(true);
	const [modulesLoading, setModulesLoading] = useState(true);
	const [notifications, setNotifications] = useState([
		{
			id: 1,
			title: 'New Announcement',
			message: 'Level 3 Training for Gunung Mulu National Park is now open.',
			time: '2 min ago',
			read: false,
		},
		{
			id: 2,
			title: 'Module Updated',
			message: 'New content was added to 1.3 Eco-tourism module.',
			time: '1 hour ago',
			read: false,
		},
		{
			id: 3,
			title: 'Assessment Reminder',
			message: 'Remember to complete your General Module assessment this week.',
			time: 'Yesterday',
			read: true,
		},
		{
			id: 4,
			title: 'System Notice',
			message: 'Scheduled maintenance starts tomorrow at 10:00 AM.',
			time: '2 days ago',
			read: true,
		},
	]);
	const [userModules, setUserModules] = useState([]);

	const loadProfile = useCallback(async () => {
		setProfileLoading(true);
		setModulesLoading(true);
		setUserModules([]);

		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');

			if (!token) {
				await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
				setProfile(null);
				navigation.reset({
					index: 0,
					routes: [{ name: 'Login' }],
				});
				return;
			}

			const response = await requestProfileApi('/api/v1/user/profile', token, {
				method: 'GET',
			});

			const loadedProfile = response.data;
			setProfile(loadedProfile);

			if (loadedProfile?.viewerRole || loadedProfile?.role) {
				await AsyncStorage.setItem(
					'innopapp_auth_role',
					loadedProfile.viewerRole || loadedProfile.role
				);
			}

			const [notificationsResponse, modulesResponse] = await Promise.all([
				requestProfileApi('/api/v1/notifications', token, { method: 'GET' }).catch(() => null),
				requestProfileApi('/api/v1/modules/dashboard', token, { method: 'GET' }).catch(() => null),
			]);

			if (Array.isArray(notificationsResponse?.data)) {
				setNotifications(
					notificationsResponse.data.map((item, index) => ({
						id: item.notificationId || index + 1,
						title: item.title || 'Notification',
						message: item.message || '',
						time: 'Recently',
						read: false,
					}))
				);
			}

			if (Array.isArray(modulesResponse?.data) && modulesResponse.data.length > 0) {
				setUserModules(
					modulesResponse.data.map((module, index) => ({
						id: String(module.moduleId || index + 1),
						moduleId: module.moduleId,
						title: module.title || `Module ${index + 1}`,
						image: resolveApiAssetUri(module.image) || module.image,
						progressPercent: Number(module.progressPercent || 0),
					}))
				);
			} else {
				setUserModules([]);
			}
		} catch (error) {
			await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
			setProfile(null);
			setUserModules([]);
			navigation.reset({
				index: 0,
				routes: [{ name: 'Login' }],
			});
		} finally {
			setModulesLoading(false);
			setProfileLoading(false);
		}
	}, [navigation]);

	useEffect(() => {
		loadProfile();

		const unsubscribe = navigation.addListener('focus', () => {
			loadProfile();
		});

		return unsubscribe;
	}, [loadProfile, navigation]);

	const performLogout = async () => {
		try {
			await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
			setProfile(null);
			navigation.reset({
				index: 0,
				routes: [{ name: 'Login' }],
			});
		} catch (error) {
			Alert.alert('Error', 'Unable to log out right now. Please try again.');
		}
	};

	const handleLogout = () => {
		if (Platform.OS === 'web') {
			const confirmed = typeof window !== 'undefined'
				? window.confirm('Are you sure you want to log out?')
				: true;

			if (!confirmed) {
				return;
			}

			void performLogout();
			return;
		}

		Alert.alert('Log Out', 'Are you sure you want to log out?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Log Out',
				style: 'destructive',
				onPress: () => {
					void performLogout();
				},
			},
		]);
	};

	const effectiveRole = profile?.viewerRole || profile?.role || 'User';
	const isAdmin = effectiveRole === 'Admin';
	const displayName = profile?.fullName || profile?.username || 'User';
	const resolvedProfileImagePath = pickProfileImagePath(profile);
	const profileImageSource = resolvedProfileImagePath
		? { uri: resolveProfileImageUri(resolvedProfileImagePath) }
		: { uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg' };

	const openAdminFeature = (title, description) => {
		setMenuVisible(false);
		setNotificationVisible(false);

		if (title === 'Assessments') {
			navigation.navigate('AdminAssessment');
			return;
		}

		navigation.navigate('AdminFeature', { title, description });
	};

	const openBadges = () => {
		setMenuVisible(false);
		setNotificationVisible(false);
		navigation.navigate(isAdmin ? 'AdminBadges' : 'Badges');
	};

	const openAnnouncements = () => {
		setMenuVisible(false);
		setNotificationVisible(false);
		navigation.navigate(isAdmin ? 'AdminAnnouncements' : 'Announcements');
	};

	const openAdminModules = () => {
		setMenuVisible(false);
		setNotificationVisible(false);
		navigation.navigate('AdminModules');
	};

	const openAdminRegistrations = () => {
		setMenuVisible(false);
		setNotificationVisible(false);
		navigation.navigate('AdminRegistrations');
	};

	const unreadCount = notifications.filter((item) => !item.read).length;
	const displayedNotifications = showAllNotifications
		? notifications
		: notifications.slice(0, 3);

	if (profileLoading && !profile) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color="#2E6B4D" />
				<Text style={styles.centerText}>Loading dashboard...</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<View
				style={[
					styles.header,
					{ paddingTop: headerTopPadding },
					isMobile && styles.headerMobile,
				]}
			>
				<Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>SFC Training</Text>

				<View style={styles.headerOverlayWrapper}>
					<View style={[styles.headerRight, isMobile && styles.headerRightMobile]}>
						<TouchableOpacity
							onPress={() => {
								setNotificationVisible((previous) => {
									const nextState = !previous;
									if (nextState) {
										setShowAllNotifications(false);
										setMenuVisible(false);
									}
									return nextState;
								});
							}}
						>
							<View>
								<Image
									source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827312.png' }}
									style={[styles.icon, isMobile && styles.iconMobile]}
								/>
								{unreadCount > 0 && (
									<View style={styles.badge}>
										<Text style={styles.badgeText}>{unreadCount}</Text>
									</View>
								)}
							</View>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => {
								setMenuVisible((previous) => {
									const nextState = !previous;
									if (nextState) {
										setNotificationVisible(false);
									}
									return nextState;
								});
							}}
						>
							<Image
								source={profileImageSource}
								style={[styles.userImage, isMobile && styles.userImageMobile]}
							/>
						</TouchableOpacity>
					</View>

					{notificationVisible && (
						<View
							style={[
								styles.notificationDropdown,
								Platform.OS !== 'web' && styles.notificationDropdownMobile,
							]}
						>
							<Text style={styles.dropdownTitle}>
								Notifications {showAllNotifications ? `(${notifications.length})` : ''}
							</Text>

							<ScrollView
								style={styles.notificationList}
								contentContainerStyle={styles.notificationListContent}
								showsVerticalScrollIndicator
								nestedScrollEnabled
							>
								{displayedNotifications.map((item) => (
									<View key={item.id} style={styles.notificationItem}>
										<View style={styles.notificationContent}>
											<Text style={[styles.notificationItemTitle, !item.read && styles.unread]}>
												{item.title}
											</Text>
											<Text style={styles.notificationItemMessage} numberOfLines={3}>
												{item.message}
											</Text>
											<Text style={styles.notificationItemTime}>{item.time}</Text>
										</View>
										{!item.read && <View style={styles.unreadDot} />}
									</View>
								))}
							</ScrollView>

							{notifications.length > 3 && (
								<TouchableOpacity
									style={styles.showMoreButton}
									onPress={() => setShowAllNotifications((previous) => !previous)}
								>
									<Text style={styles.showMoreText}>
										{showAllNotifications
											? 'Show Less'
											: `Show More Notifications (${notifications.length - 3} more)`}
									</Text>
								</TouchableOpacity>
							)}
						</View>
					)}

					{menuVisible && (
						<View style={styles.dropdown}>
							<View style={styles.topSection}>
								<View style={styles.userSection}>
									<Image
										source={profileImageSource}
										style={styles.dropdownImage}
									/>
									<Text style={styles.username}>{displayName}</Text>
								</View>

								<View style={styles.menuSection}>
									<TouchableOpacity
										style={styles.dropdownItem}
										onPress={() => {
											setMenuVisible(false);
											navigation.navigate('Profile');
										}}
									>
										<Text style={styles.dropdownText}>Profile</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.dropdownItem}
										onPress={openBadges}
									>
										<Text style={styles.dropdownText}>{isAdmin ? 'Badge Management' : 'Badges'}</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.dropdownItem}
										onPress={() => openAdminFeature('Calendar', 'View and manage schedule and training calendar entries.')}
									>
										<Text style={styles.dropdownText}>Calendar</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.dropdownItem}
										onPress={openAnnouncements}
									>
										<Text style={styles.dropdownText}>{isAdmin ? 'Admin Announcements' : 'Announcements'}</Text>
									</TouchableOpacity>

									{isAdmin && (
										<>
											<TouchableOpacity
												style={styles.dropdownItem}
												onPress={openAdminModules}
											>
												<Text style={styles.dropdownText}>Module Library</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={styles.dropdownItem}
												onPress={openAdminRegistrations}
											>
												<Text style={styles.dropdownText}>Registration Requests</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={styles.dropdownItem}
												onPress={() => openAdminFeature('Assessments', 'Manage assessment content, attempt settings, and review workflows.')}
											>
												<Text style={styles.dropdownText}>Assessments</Text>
											</TouchableOpacity>
										</>
									)}
								</View>
							</View>

							<TouchableOpacity
								style={styles.logoutButton}
								onPress={() => {
									setMenuVisible(false);
									setNotificationVisible(false);
									handleLogout();
								}}
							>
								<Text style={styles.logoutText}>Logout</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</View>

			<Text style={styles.pageTitle}>{isAdmin ? 'Admin Dashboard' : 'Dashboard'}</Text>

			{isAdmin && (
				<View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
					<Text style={styles.sectionLabel}>Module Management</Text>
					<View style={[styles.adminActions, isMobile && styles.adminActionsMobile]}>
						<TouchableOpacity
							style={[styles.secondaryAddButton, isMobile && styles.secondaryAddButtonMobile]}
							onPress={() => navigation.navigate('AdminModules')}
						>
							<Text style={styles.secondaryAddButtonText}>Manage Modules</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.addButton, isMobile && styles.addButtonMobile]}
							onPress={() => navigation.navigate('AddModule')}
						>
							<Text style={styles.addButtonText}>Add Module</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			<View style={styles.cardContainer}>
				{modulesLoading ? (
					<View style={styles.modulesStatusCard}>
						<ActivityIndicator size="small" color="#2E6B4D" />
						<Text style={styles.modulesStatusText}>Loading modules...</Text>
					</View>
				) : userModules.length === 0 ? (
					<View style={styles.modulesStatusCard}>
						<Text style={styles.modulesStatusTitle}>No modules available yet</Text>
						<Text style={styles.modulesStatusText}>
							Your training modules will appear here after they are published.
						</Text>
					</View>
				) : (
					userModules.map((module) => (
						<TouchableOpacity
							key={module.id}
							onPress={() => {
								const moduleIndex = userModules.findIndex((item) => item.id === module.id);
								const hasIncompletePreviousModule = userModules
									.slice(0, Math.max(0, moduleIndex))
									.some((item) => Number(item.progressPercent || 0) < 100);

								if (hasIncompletePreviousModule) {
									Alert.alert(
										'Module Locked',
										'Please complete earlier modules before opening this one.'
									);
									return;
								}

								navigation.navigate('Module', {
									moduleName: module.title,
									moduleId: module.moduleId,
									moduleOrder: moduleIndex + 1,
									totalModules: userModules.length,
									moduleProgressPercent: module.progressPercent,
								});
							}}
							style={styles.cardWrapper}
						>
							<ImageBackground
								source={{ uri: module.image }}
								style={styles.card}
								imageStyle={{ borderRadius: 20 }}
							>
								<View style={styles.overlay} />
								<Text style={styles.cardTitle}>{module.title}</Text>

								<View style={styles.progressBar}>
									<View style={[styles.progressFill, { width: `${module.progressPercent}%` }]} />
									<Text style={styles.progressText}>{module.progressPercent}%</Text>
								</View>
							</ImageBackground>
						</TouchableOpacity>
					))
					)}
		</View>
		</View>
	);
}

export default function App() {
	return (
		<NavigationContainer>
			<Stack.Navigator initialRouteName="Loading" screenOptions={{ headerShown: false }}>
				<Stack.Screen name="Loading" component={LoadingScreen} />
				<Stack.Screen name="Login" component={LoginPage} />
				<Stack.Screen
					name="Register"
					component={RegisterScreen}
					options={{ headerShown: false, title: 'Register' }}
				/>
				<Stack.Screen
					name="Submission"
					component={SubmissionScreen}
					options={{ headerShown: false, title: 'Submission' }}
				/>
				<Stack.Screen name="Home" component={HomeScreen} />
				<Stack.Screen name="Module" component={ModuleScreen} />
				<Stack.Screen name="Assessment" component={GuideAssessment} />
				<Stack.Screen
					name="SubmittedPage"
					component={AssessmentSubmittedPage}
					options={{ headerShown: false, title: 'Assessment Submitted' }}
				/>
				<Stack.Screen name="Announcements" component={AnnouncementScreen} />
				<Stack.Screen name="AdminAnnouncements" component={AdminAnnouncementScreen} />
				<Stack.Screen
					name="AdminAssessment"
					component={AdminAssessment}
					options={{ headerShown: true, title: 'Assessments' }}
				/>
				<Stack.Screen
					name="Badges"
					component={BadgeScreen}
					options={{ headerShown: true, title: 'Badges' }}
				/>
				<Stack.Screen
					name="Profile"
					component={ProfileScreen}
					options={{ headerShown: true, title: 'My Profile' }}
				/>
				<Stack.Screen
					name="EditProfile"
					component={EditProfileScreen}
					options={{ headerShown: true, title: 'Edit Profile' }}
				/>
				<Stack.Screen
					name="AddModule"
					component={AddModuleScreen}
					options={{ headerShown: true, title: 'Add Module' }}
				/>
				<Stack.Screen
					name="AdminModules"
					component={AdminModuleManagerScreen}
				/>
				<Stack.Screen
					name="AdminRegistrations"
					component={AdminRegistrationManagementScreen}
				/>
				<Stack.Screen
					name="AdminBadges"
					component={BadgeManagementScreen}
					options={{ headerShown: true, title: 'Badge Management' }}
				/>
				<Stack.Screen
					name="AddBadge"
					component={AddBadgeScreen}
					options={{ headerShown: true, title: 'Add Badge' }}
				/>
				<Stack.Screen
					name="EditBadge"
					component={EditBadgeScreen}
					options={{ headerShown: true, title: 'Edit Badge' }}
				/>
				<Stack.Screen
					name="AdminFeature"
					component={AdminFeatureScreen}
					options={({ route }) => ({
						headerShown: true,
						title: route?.params?.title || 'Admin Feature',
					})}
				/>
			</Stack.Navigator>
		</NavigationContainer>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#FBFCF8',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 24,
		paddingTop: 20,
		paddingBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#F0F0E8',
		zIndex: 100,
	},
	headerMobile: {
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: '700',
		color: '#3A4D39',
		letterSpacing: -0.5,
	},
	headerTitleMobile: {
		fontSize: 20,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 18,
	},
	headerRightMobile: {
		gap: 12,
	},
	headerOverlayWrapper: {
		position: 'relative',
	},
	icon: {
		width: 24,
		height: 24,
		tintColor: '#3A4D39',
		opacity: 0.7,
	},
	iconMobile: {
		width: 23,
		height: 23,
	},
	badge: {
		position: 'absolute',
		top: -4,
		right: -6,
		backgroundColor: '#D63F3F',
		borderRadius: 10,
		minWidth: 18,
		height: 18,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 4,
	},
	badgeText: {
		color: '#FFFFFF',
		fontSize: 11,
		fontWeight: '800',
	},
	userImage: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: '#E8E8E0',
	},
	userImageMobile: {
		width: 38,
		height: 38,
		borderRadius: 19,
		marginLeft: 6,
	},
	notificationDropdown: {
		position: 'absolute',
		top: 56,
		right: 56,
		width: 340,
		maxHeight: 420,
		backgroundColor: 'rgba(255, 255, 255, 0.98)',
		borderRadius: 20,
		shadowColor: '#3A4D39',
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.14,
		shadowRadius: 20,
		elevation: 10,
		zIndex: 10000,
		overflow: 'hidden',
	},
	notificationDropdownMobile: {
		right: 0,
		width: 292,
	},
	dropdownTitle: {
		fontSize: 17,
		fontWeight: '700',
		color: '#304637',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#EEF2EA',
	},
	notificationList: {
		maxHeight: 300,
	},
	notificationListContent: {
		paddingHorizontal: 8,
	},
	notificationItem: {
		flexDirection: 'row',
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#F2F5EF',
		gap: 8,
	},
	notificationContent: {
		flex: 1,
	},
	notificationItemTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: '#3A4D39',
		marginBottom: 3,
	},
	unread: {
		color: '#233427',
	},
	notificationItemMessage: {
		fontSize: 13,
		color: '#566658',
		lineHeight: 18,
	},
	notificationItemTime: {
		marginTop: 4,
		fontSize: 11,
		fontWeight: '600',
		color: '#7D8A7C',
	},
	unreadDot: {
		width: 8,
		height: 8,
		borderRadius: 999,
		backgroundColor: '#D66B6B',
		marginTop: 6,
	},
	showMoreButton: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: '#F7FAF3',
		borderTopWidth: 1,
		borderTopColor: '#EEF2EA',
	},
	showMoreText: {
		fontSize: 13,
		fontWeight: '700',
		color: '#2E6B4D',
		textAlign: 'center',
	},
	dropdown: {
		position: 'absolute',
		top: 50,
		right: 20,
		width: 220,
		backgroundColor: 'rgba(255, 255, 255, 0.98)',
		borderRadius: 24,
		padding: 20,
		shadowColor: '#3A4D39',
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.1,
		shadowRadius: 20,
		elevation: 10,
		zIndex: 9999,
	},
	topSection: {},
	userSection: {
		alignItems: 'center',
		marginBottom: 15,
	},
	dropdownImage: {
		width: 60,
		height: 60,
		borderRadius: 30,
		marginBottom: 10,
	},
	username: {
		fontWeight: '600',
		fontSize: 16,
		color: '#3A4D39',
	},
	menuSection: {
		marginVertical: 10,
	},
	dropdownItem: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F5F5F0',
	},
	dropdownText: {
		color: '#555',
		fontSize: 15,
	},
	logoutButton: {
		marginTop: 15,
		paddingVertical: 12,
		borderRadius: 15,
		backgroundColor: '#FDF0F0',
		alignItems: 'center',
	},
	logoutText: {
		color: '#CD5C5C',
		fontWeight: '600',
	},
	pageTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 12,
		marginHorizontal: 20,
		marginTop: 20,
	},
	headerRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginHorizontal: 20,
		marginBottom: 8,
	},
	headerRowMobile: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		marginBottom: 14,
	},
	sectionLabel: {
		fontSize: 16,
		fontWeight: '700',
		color: '#3A4D39',
	},
	adminActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	adminActionsMobile: {
		width: '100%',
		marginTop: 12,
		justifyContent: 'space-between',
		gap: 0,
	},
	secondaryAddButton: {
		backgroundColor: '#EAF2E3',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	secondaryAddButtonMobile: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 40,
		paddingHorizontal: 10,
		paddingVertical: 10,
	},
	secondaryAddButtonText: {
		color: '#2E6B4D',
		fontWeight: '700',
	},
	addButton: {
		backgroundColor: '#656d4a',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		marginLeft: 10,
	},
	addButtonMobile: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 40,
		paddingHorizontal: 10,
		paddingVertical: 10,
		marginLeft: 12,
	},
	addButtonText: {
		color: '#fff',
		fontWeight: 'bold',
	},
	cardContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		paddingHorizontal: 10,
		zIndex: 1,
	},
	modulesStatusCard: {
		width: '100%',
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#E7ECE1',
		borderRadius: 14,
		paddingVertical: 22,
		paddingHorizontal: 18,
		marginHorizontal: 8,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	modulesStatusTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#2B4334',
		textAlign: 'center',
	},
	modulesStatusText: {
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '600',
		color: '#5D715D',
		textAlign: 'center',
	},
	cardWrapper: {
		flexBasis: '30%',
		flexGrow: 1,
		minWidth: 250,
		margin: 8,
		borderRadius: 22,
		backgroundColor: '#FFF',
		shadowColor: '#3A4D39',
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 5,
	},
	card: {
		height: 180,
		justifyContent: 'flex-end',
		padding: 16,
		overflow: 'hidden',
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.2)',
		borderRadius: 22,
	},
	cardTitle: {
		color: '#FFF',
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 10,
		letterSpacing: 0.5,
	},
	progressBar: {
		height: 4,
		backgroundColor: 'rgba(255,255,255,0.25)',
		borderRadius: 10,
		position: 'relative',
		marginBottom: 6,
	},
	progressFill: {
		height: '100%',
		backgroundColor: '#FFF',
		borderRadius: 10,
	},
	progressText: {
		position: 'absolute',
		top: -20,
		right: 0,
		fontSize: 10,
		fontWeight: '800',
		color: '#FFF',
		opacity: 0.9,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#FBFCF8',
		gap: 10,
	},
	centerText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#3A4D39',
	},
	adminCard: {
		width: '100%',
		backgroundColor: '#F4F1E8',
		borderWidth: 1,
		borderColor: '#D5DEC8',
		borderRadius: 20,
		padding: 18,
		marginHorizontal: 8,
	},
	adminCardTitle: {
		fontSize: 18,
		fontWeight: '800',
		color: '#1F372B',
	},
	adminCardText: {
		marginTop: 8,
		fontSize: 14,
		lineHeight: 20,
		color: '#4B6252',
	},
	adminActionButton: {
		marginTop: 14,
		alignSelf: 'flex-start',
		backgroundColor: '#2E6B4D',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 12,
	},
	adminActionText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '700',
	},
	adminFeatureContainer: {
		flex: 1,
		backgroundColor: '#FBFCF8',
		paddingHorizontal: 20,
		paddingTop: 26,
	},
	adminFeatureTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#1F372B',
	},
	adminFeatureText: {
		marginTop: 10,
		fontSize: 15,
		lineHeight: 22,
		color: '#4B6252',
	},
	assessmentContainer: {
		flex: 1,
		backgroundColor: '#FBFCF8',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	assessmentCard: {
		width: '100%',
		maxWidth: 480,
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#E7ECE1',
		borderRadius: 16,
		padding: 20,
	},
	assessmentTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#20372A',
	},
	assessmentSubtitle: {
		marginTop: 6,
		fontSize: 14,
		fontWeight: '700',
		color: '#4E6657',
	},
	assessmentText: {
		marginTop: 12,
		fontSize: 14,
		lineHeight: 22,
		color: '#4B6252',
	},
	assessmentBackButton: {
		marginTop: 16,
		alignSelf: 'flex-start',
		backgroundColor: '#2E6B4D',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
	},
	assessmentBackText: {
		color: '#FFFFFF',
		fontWeight: '700',
		fontSize: 14,
	},
});
