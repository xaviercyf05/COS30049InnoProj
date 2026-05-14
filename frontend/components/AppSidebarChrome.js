import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bell } from "lucide-react-native";

import {
  pickProfileImagePath,
  requestProfileApi,
  resolveProfileImageUri,
} from "../Profile/profileApi.js";

const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return past.toLocaleDateString(); 
};

const SESSION_STORAGE_KEYS = [
  "auth_token",
  "innopapp_auth_role",
  "innopapp_auth_username",
  "innopapp_auth_user_id",
];

const DEFAULT_PROFILE_IMAGE =
  "https://static.vecteezy.com/system/resources/previews/036/280/651/original/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector.jpg";

const DEFAULT_NOTIFICATIONS = [];

const SCREEN_TITLES = {
  Home: "Dashboard",
  Module: "Training Modules",
  Assessment: "Assessment",
  SubmittedPage: "Assessment Submitted",
  Announcements: "Announcements",
  AdminAnnouncements: "Admin Announcements",
  AdminAssessment: "Assessments",
  Badges: "Badges",
  Profile: "My Profile",
  EditProfile: "Edit Profile",
  AddModule: "Add Module",
  AdminModules: "Module Library",
  AdminRegistrations: "Registration Requests",
  AdminEnrollments: "Enrollment Management",
  AdminBadges: "Badge Management",
  AddBadge: "Add Badge",
  EditBadge: "Edit Badge",
  AdminResultVerification: "Result Verification",
  Analytics: "Analytics Dashboard",
  AdminFeature: "Admin Feature",
};

function resolveScreenTitle(route, explicitTitle) {
  if (explicitTitle) {
    return explicitTitle;
  }

  if (route?.params?.title) {
    return route.params.title;
  }

  return SCREEN_TITLES[route?.name] || "SFC Training";
}

function AppSidebarChrome({ navigation, route, title, children }) {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const sidebarTranslateX = useRef(new Animated.Value(-320)).current;

  const markSingleAsRead = async (id) => {
    const updatedNotifications = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    setNotifications(updatedNotifications);

    try {
      await AsyncStorage.setItem(
        "local_notifications_state",
        JSON.stringify(updatedNotifications),
      );
      const token = await AsyncStorage.getItem("auth_token");
      if (token) {
        await requestProfileApi(`/api/v1/notifications/${id}/read`, token, {
          method: "POST",
        });
      }
    } catch (error) {
      console.error("Error saving state:", error);
    }
  };

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);

    try {
      const token = await AsyncStorage.getItem("auth_token");

      if (!token) {
        setProfile(null);
        return;
      }

      const response = await requestProfileApi("/api/v1/user/profile", token, {
        method: "GET",
      });

      setProfile(response.data);

      const notificationsResponse = await requestProfileApi(
        "/api/v1/notifications",
        token,
        {
          method: "GET",
        },
      ).catch(() => null);

      if (Array.isArray(notificationsResponse?.data)) {
        const savedData = await AsyncStorage.getItem(
          "local_notifications_state",
        );
        const localState = savedData ? JSON.parse(savedData) : [];

        const mergedNotifications = notificationsResponse.data.map(
          (item, index) => {
            const id = item.notificationId || index + 1;
            const wasReadLocally = localState.find((n) => n.id === id)?.read;

            return {
              id: id,
              title: item.title || "Notification",
              message: item.message || "",
              time: formatTimeAgo(item.createdAt || item.created_at),
              read: item.isRead || wasReadLocally || false,
            };
          },
        );

        setNotifications(mergedNotifications);
      }
    } catch (_error) {
      setProfile(null);
      setNotifications(DEFAULT_NOTIFICATIONS);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const unsubscribe = navigation.addListener("focus", () => {
      loadProfile();
    });

    return unsubscribe;
  }, [loadProfile, navigation]);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const displayedNotifications = showAllNotifications
    ? notifications
    : notifications.slice(0, 3);

  useEffect(() => {
    if (menuVisible) {
      setSidebarMounted(true);
      Animated.timing(sidebarTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(sidebarTranslateX, {
      toValue: -320,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSidebarMounted(false);
      }
    });
  }, [menuVisible, sidebarTranslateX]);

  const effectiveRole = profile?.viewerRole || profile?.role || "User";
  const isAdmin = effectiveRole === "Admin";
  const displayName = profile?.fullName || profile?.username || "User";
  const screenTitle = resolveScreenTitle(route, title);
  const showBackButton = route?.name !== "Home";
  const resolvedProfileImagePath = pickProfileImagePath(profile);
  const profileImageSource = resolvedProfileImagePath
    ? { uri: resolveProfileImageUri(resolvedProfileImagePath) }
    : { uri: DEFAULT_PROFILE_IMAGE };

  const performLogout = async () => {
    try {
      await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (_error) {
      Alert.alert("Error", "Unable to log out right now. Please try again.");
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const openAdminFeature = (title, description) => {
    setMenuVisible(false);

    if (title === "Assessments") {
      navigation.navigate("AdminAssessment");
      return;
    }

    navigation.navigate("AdminFeature", { title, description });
  };

  const openBadges = () => {
    setMenuVisible(false);
    navigation.navigate(isAdmin ? "AdminBadges" : "Badges");
  };

  const openAnnouncements = () => {
    setMenuVisible(false);
    navigation.navigate(isAdmin ? "AdminAnnouncements" : "Announcements");
  };

  const openSecuritySettings = () => {
    setMenuVisible(false);
    navigation.navigate("Security");
  };

  const openAdminModules = () => {
    setMenuVisible(false);
    navigation.navigate("AdminModules");
  };

  const openAdminRegistrations = () => {
    setMenuVisible(false);
    navigation.navigate("AdminRegistrations");
  };

  const openAdminEnrollments = () => {
    setMenuVisible(false);
    navigation.navigate("AdminEnrollments");
  };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop:
              Platform.OS === "web" ? 14 : Math.max(10, insets.top + 4),
          },
        ]}
      >
        {showBackButton ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }

              if (route?.name && route.name !== "Home") {
                navigation.navigate("Home");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
          >
            <ArrowLeft color="#3A4D39" size={20} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonSpacer} />
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.appTitle}>{screenTitle}</Text>
          <Text style={styles.appSubtitle}>
            SFC Training • {isAdmin ? "Administrator" : "User"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
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
            activeOpacity={0.85}
          >
            <View>
              <Bell color="#3A4D39" size={20} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => {
              setMenuVisible((previous) => {
                const nextState = !previous;
                if (nextState) {
                  setNotificationVisible(false);
                }
                return nextState;
              });
            }}
            activeOpacity={0.9}
          >
            <Image source={profileImageSource} style={styles.profileImage} />
          </TouchableOpacity>
        </View>
      </View>

      {notificationVisible && (
        <View style={styles.notificationOverlay}>
          <TouchableOpacity
            style={styles.notificationBackdrop}
            activeOpacity={1}
            onPress={() => setNotificationVisible(false)}
          />
          <View style={styles.notificationDropdown}>
            <Text style={styles.dropdownTitle}>
              Notifications{" "}
              {showAllNotifications ? `(${notifications.length})` : ""}
            </Text>

            <ScrollView
              style={styles.notificationList}
              contentContainerStyle={styles.notificationListContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {displayedNotifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.notificationItem}
                  onPress={() => {
                    markSingleAsRead(item.id);
                    setNotificationVisible(false);
                    if (
                      item.title === "New Announcement" ||
                      item.title?.includes("Announcement")
                    ) {
                      navigation.navigate(
                        isAdmin ? "AdminAnnouncements" : "Announcements",
                      );
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationContent}>
                    <Text
                      style={[
                        styles.notificationItemTitle,
                        !item.read && styles.unread,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={styles.notificationItemMessage}
                      numberOfLines={3}
                    >
                      {item.message}
                    </Text>
                    <Text style={styles.notificationItemTime}>{item.time}</Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {notifications.length > 3 && (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => setShowAllNotifications((previous) => !previous)}
              >
                <Text style={styles.showMoreText}>
                  {showAllNotifications
                    ? "Show Less"
                    : `Show More Notifications (${notifications.length - 3} more)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.contentShell}>{children}</View>

      {sidebarMounted && (
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: sidebarTranslateX }] },
            ]}
          >
            <View style={styles.sidebarHeader}>
              <View style={styles.userSection}>
                <Image
                  source={profileImageSource}
                  style={styles.sidebarImage}
                />
                <Text style={styles.username}>{displayName}</Text>
                <Text style={styles.sidebarRole}>
                  {isAdmin ? "Administrator" : "User"}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.sidebarScroll}
              contentContainerStyle={styles.sidebarScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <View style={styles.sidebarSection}>
                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate("Home");
                  }}
                >
                  <Text style={styles.sidebarText}>Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate("Profile");
                  }}
                >
                  <Text style={styles.sidebarText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={openSecuritySettings}
                >
                  <Text style={styles.sidebarText}>Security</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={openBadges}
                >
                  <Text style={styles.sidebarText}>
                    {isAdmin ? "Badge Management" : "Badges"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() =>
                    openAdminFeature(
                      "Calendar",
                      "View and manage schedule and training calendar entries.",
                    )
                  }
                >
                  <Text style={styles.sidebarText}>Calendar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={openAnnouncements}
                >
                  <Text style={styles.sidebarText}>
                    {isAdmin ? "Admin Announcements" : "Announcements"}
                  </Text>
                </TouchableOpacity>

                {isAdmin && (
                  <>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={openAdminModules}
                    >
                      <Text style={styles.sidebarText}>Module Library</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={openAdminRegistrations}
                    >
                      <Text style={styles.sidebarText}>
                        Registration Requests
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={openAdminEnrollments}
                    >
                      <Text style={styles.sidebarText}>
                        Enrollment Management
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() =>
                        openAdminFeature(
                          "Assessments",
                          "Manage assessment content, attempt settings, and review workflows.",
                        )
                      }
                    >
                      <Text style={styles.sidebarText}>Assessments</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() => {
                        setMenuVisible(false);
                        navigation.navigate("AdminResultVerification");
                      }}
                    >
                      <Text style={styles.sidebarText}>
                        Result Verification
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() => {
                        setMenuVisible(false);
                        navigation.navigate("Analytics");
                      }}
                    >
                      <Text style={styles.sidebarText}>
                        Analytics Dashboard
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() => {
                        setMenuVisible(false);
                        navigation.navigate("SensorAlerts");
                      }}
                    >
                      <Text style={styles.sidebarText}>Sensor Alerts</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => {
                  setMenuVisible(false);
                  handleLogout();
                }}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>

              {profileLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#2E6B4D" />
                  <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

export function withSidebarChrome(WrappedComponent, chromeOptions = {}) {
  function ScreenWithSidebarChrome(props) {
    return (
      <AppSidebarChrome
        navigation={props.navigation}
        route={props.route}
        title={chromeOptions.title}
      >
        <WrappedComponent {...props} useSharedChrome />
      </AppSidebarChrome>
    );
  }

  ScreenWithSidebarChrome.displayName = `WithSidebarChrome(${WrappedComponent.displayName || WrappedComponent.name || "Screen"})`;

  return ScreenWithSidebarChrome;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FBFCF8",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF3",
    borderWidth: 1,
    borderColor: "#E7EDE1",
    marginRight: 10,
  },
  backButtonSpacer: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EA",
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 10005,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#20372A",
  },
  appSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#6A7A67",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF3",
    borderWidth: 1,
    borderColor: "#E7EDE1",
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E7EDE1",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#D63F3F",
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  notificationOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10050,
    justifyContent: "flex-start",
    pointerEvents: "box-none",
  },
  notificationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  notificationDropdown: {
    position: "absolute",
    top: 58,
    right: 16,
    width: 340,
    maxHeight: 420,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 20,
    shadowColor: "#3A4D39",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10051,
    overflow: "hidden",
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#304637",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EA",
  },
  notificationList: {
    maxHeight: 300,
  },
  notificationListContent: {
    paddingHorizontal: 8,
  },
  notificationItem: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F5EF",
    gap: 8,
    backgroundColor: "transparent",
  },
  notificationContent: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3A4D39",
    marginBottom: 3,
  },
  unread: {
    color: "#233427",
  },
  notificationItemMessage: {
    fontSize: 13,
    color: "#566658",
    lineHeight: 18,
  },
  notificationItemTime: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#7D8A7C",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#D66B6B",
    marginTop: 6,
  },
  showMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F7FAF3",
    borderTopWidth: 1,
    borderTopColor: "#EEF2EA",
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E6B4D",
    textAlign: "center",
  },
  contentShell: {
    flex: 1,
  },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10050,
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14, 22, 16, 0.28)",
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
    shadowColor: "#243426",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 18,
    zIndex: 10051,
  },
  sidebarHeader: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  sidebarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: "#E3E9DD",
    marginBottom: 10,
  },
  sidebarRole: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6C7A6B",
    marginTop: 2,
  },
  sidebarSection: {
    paddingTop: 4,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    flexGrow: 1,
  },
  sidebarFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2EA",
  },
  sidebarItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EA",
  },
  sidebarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3A4D39",
  },
  logoutButton: {
    marginTop: 15,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: "#FDF0F0",
    alignItems: "center",
  },
  logoutText: {
    color: "#CD5C5C",
    fontWeight: "600",
  },
  userSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  username: {
    fontWeight: "600",
    fontSize: 16,
    color: "#3A4D39",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C7A6B",
  },
});
