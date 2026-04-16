import React, { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	ImageBackground,
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginPage from './Login/LoginPage.js';
import LoadingScreen from './Login/LoadingScreen.js';
import RegisterPlaceholderScreen from './Register/RegisterPlaceholderScreen.js';
import ModuleScreen from './Module/ModuleScreen.js';
import Grade1Screen from './Grade1Screen.js';
import Grade2Screen from './Grade2Screen.js';
import Grade3Screen from './Grade3Screen.js';
import BadgeScreen from './Badge/BadgePage.js';
import ProfileScreen from './Profile/ProfileScreen.js';
import EditProfileScreen from './Profile/EditProfileScreen.js';
import { pickProfileImagePath, requestProfileApi, resolveProfileImageUri } from './Profile/profileApi.js';

const Stack = createNativeStackNavigator();
const SESSION_STORAGE_KEYS = [
	'innopapp_auth_token',
	'innopapp_auth_role',
	'innopapp_auth_username',
	'innopapp_auth_user_id',
];

function HomeScreen({ navigation }) {
	const [menuVisible, setMenuVisible] = useState(false);
	const [profile, setProfile] = useState(null);
	const [profileLoading, setProfileLoading] = useState(true);

	const loadProfile = useCallback(async () => {
		setProfileLoading(true);

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
		} catch (error) {
			await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
			setProfile(null);
			navigation.reset({
				index: 0,
				routes: [{ name: 'Login' }],
			});
		} finally {
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

	const userModules = [
		{
			id: 'general',
			title: 'General',
			image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
			progressPercent: 55,
		},
		{
			id: 'park-1',
			title: 'Park 1',
			image: 'https://imgs.mongabay.com/wp-content/uploads/sites/20/2018/03/09165734/20171123-153037-4-2.jpg',
			progressPercent: 40,
		},
		{
			id: 'park-2',
			title: 'Park 2',
			image: 'https://mongabay-images.s3.amazonaws.com/780/malaysia/sabah_sepilok_0337.jpg',
			progressPercent: 65,
		},
		{
			id: 'park-3',
			title: 'Park 3',
			image: 'https://gofbonline.com/wp-content/uploads/2017/06/sustainability-sarawak-banner.jpg',
			progressPercent: 20,
		},
		{
			id: 'park-4',
			title: 'Park 4',
			image: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
			progressPercent: 10,
		},
		{
			id: 'park-5',
			title: 'Park 5',
			image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
			progressPercent: 5,
		},
	];

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
			<View style={styles.header}>
				<Text style={styles.headerTitle}>SFC Training</Text>

				<View>
					<View style={styles.headerRight}>
						<TouchableOpacity>
							<Image
								source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827312.png' }}
								style={styles.icon}
							/>
						</TouchableOpacity>

						<TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
							<Image
								source={profileImageSource}
								style={styles.userImage}
							/>
						</TouchableOpacity>
					</View>

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

									{!isAdmin && (
										<TouchableOpacity
											style={styles.dropdownItem}
											onPress={() => {
												setMenuVisible(false);
												navigation.navigate('Badges');
											}}
										>
											<Text style={styles.dropdownText}>Badges</Text>
										</TouchableOpacity>
									)}

									<TouchableOpacity style={styles.dropdownItem}>
										<Text style={styles.dropdownText}>{isAdmin ? 'Operations' : 'Calendar'}</Text>
									</TouchableOpacity>

									<TouchableOpacity style={styles.dropdownItem}>
										<Text style={styles.dropdownText}>{isAdmin ? 'Announcements' : 'Announcement'}</Text>
									</TouchableOpacity>
								</View>
							</View>

							<TouchableOpacity
								style={styles.logoutButton}
								onPress={() => {
									setMenuVisible(false);
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

			<View style={styles.cardContainer}>
				{isAdmin ? (
					<View style={styles.adminCard}>
						<Text style={styles.adminCardTitle}>Administrator Workspace</Text>
						<Text style={styles.adminCardText}>
							Your account is configured for administrative duties. Use profile and admin endpoints to manage users,
							 announcements, and schedules.
						</Text>
						<TouchableOpacity
							style={styles.adminActionButton}
							onPress={() => navigation.navigate('Profile')}
							activeOpacity={0.85}
						>
							<Text style={styles.adminActionText}>Open My Profile</Text>
						</TouchableOpacity>
					</View>
				) : (
					<>
						{userModules.map((module) => (
							<TouchableOpacity
								key={module.id}
								onPress={() => navigation.navigate('Module', { moduleName: module.title })}
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
						))}
					</>
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
					component={RegisterPlaceholderScreen}
					options={{ headerShown: true, title: 'Register' }}
				/>
				<Stack.Screen name="Home" component={HomeScreen} />
				<Stack.Screen name="Module" component={ModuleScreen} />
				<Stack.Screen
					name="Grade1"
					component={Grade1Screen}
					options={{ headerShown: true, title: 'Grade 1' }}
				/>
				<Stack.Screen
					name="Grade2"
					component={Grade2Screen}
					options={{ headerShown: true, title: 'Grade 2' }}
				/>
				<Stack.Screen
					name="Grade3"
					component={Grade3Screen}
					options={{ headerShown: true, title: 'Grade 3' }}
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
	headerTitle: {
		fontSize: 22,
		fontWeight: '700',
		color: '#3A4D39',
		letterSpacing: -0.5,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 18,
	},
	icon: {
		width: 24,
		height: 24,
		tintColor: '#3A4D39',
		opacity: 0.7,
	},
	userImage: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: '#E8E8E0',
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
		marginBottom: 20,
		marginHorizontal: 20,
		marginTop: 20,
	},
	cardContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		paddingHorizontal: 10,
		zIndex: 1,
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
});
