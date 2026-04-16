import React, { useState } from 'react';
import {
  NavigationContainer
} from '@react-navigation/native';
import {
  createNativeStackNavigator
} from '@react-navigation/native-stack';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';

import AnnounceScreen from './announce';
import ModuleScreen from './module';

const Stack = createNativeStackNavigator();
const { height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

function CustomHeader({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // Sample Notifications
  const notifications = [
    {
      id: 1,
      title: "New Announcement",
      message: "Level 3 Training for Gunung Mulu National Park is now open",
      time: "2 min ago",
      read: false,
    },
    {
      id: 2,
      title: "Module Updated",
      message: "New content added to 1.3 Eco-tourism module",
      time: "1 hour ago",
      read: false,
    },
    {
      id: 3,
      title: "New Announcement",
      message: "Level 1 Training - Bako National Park schedule updated",
      time: "Yesterday",
      read: true,
    },
    {
      id: 4,
      title: "System Alert",
      message: "Maintenance scheduled for tomorrow 10:00 AM",
      time: "2 days ago",
      read: true,
    },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayedNotifications = showAllNotifications
    ? notifications
    : notifications.slice(0, 3);

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>🌲 SFC Digital Park Guide</Text>

      <View style={styles.headerRight}>
        {/* Notification Bell */}
        <TouchableOpacity
          onPress={() => {
            setNotificationVisible(!notificationVisible);
            if (!notificationVisible) setShowAllNotifications(false);
          }}
        >
          <View>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827312.png' }}
              style={styles.icon}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* User Menu */}
        <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
          <Text style={styles.userEmoji}>👷‍♂️</Text>
        </TouchableOpacity>
      </View>

      {/* ==================== NOTIFICATION DROPDOWN ==================== */}
      {notificationVisible && (
        <View style={[
          styles.notificationDropdown,
          !isWeb && styles.notificationDropdownMobile
        ]}>
          <Text style={styles.dropdownTitle}>
            Notifications {showAllNotifications && `(${notifications.length})`}
          </Text>

          <ScrollView
            style={styles.notificationList}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.notificationListContent}
          >
            {displayedNotifications.map((notif) => (
              <View key={notif.id} style={styles.notificationItem}>
                <View style={styles.notificationContent}>
                  <Text style={[styles.notifTitle, !notif.read && styles.unread]}>
                    {notif.title}
                  </Text>
                  <Text style={styles.notifMessage} numberOfLines={3}>
                    {notif.message}
                  </Text>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
                {!notif.read && <View style={styles.unreadDot} />}
              </View>
            ))}
          </ScrollView>

          {notifications.length > 3 && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllNotifications(!showAllNotifications)}
            >
              <Text style={styles.showMoreText}>
                {showAllNotifications
                  ? "Show Less"
                  : `Show More Notifications (${notifications.length - 3} more)`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ==================== USER MENU DROPDOWN ==================== */}
      {menuVisible && (
        <View style={styles.dropdown}>
          <View style={styles.userSection}>
            <Text style={styles.dropdownEmoji}>👷‍♂️</Text>
            <Text style={styles.username}>Angeline Chiu</Text>
          </View>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Announcements');
            }}
          >
            <Text style={styles.dropdownText}>📢 Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Modules');
            }}
          >
            <Text style={styles.dropdownText}>📚 Modules</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dropdownItem}>
            <Text style={styles.dropdownText}>🏅 Badges</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dropdownItem}>
            <Text style={styles.dropdownText}>📅 Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setMenuVisible(false)}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          header: (props) => <CustomHeader {...props} />,
        }}
      >
        <Stack.Screen name="Announcements" component={AnnounceScreen} />
        <Stack.Screen name="Modules" component={ModuleScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ==================== STYLES ==================== */
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333d29',
    paddingHorizontal: 10,
    paddingTop: 25,
    paddingBottom: 15,
    zIndex: 100,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  icon: {
    width: 26,
    height: 26,
    tintColor: '#fff',
  },
  userEmoji: {
    fontSize: 32,
  },

  /* Badge */
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e63939',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Notification Dropdown */
  notificationDropdown: {
    position: 'absolute',
    top: 88,
    right: 20,
    width: 340,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 20,
    shadowColor: '#3A4D39',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1000,
    overflow: 'hidden',
  },
  notificationDropdownMobile: {
    width: '92%',
    maxWidth: 360,
    top: 75,
    right: 16,
    maxHeight: screenHeight * 0.72,
  },

  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4D39',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationList: {
    maxHeight: 420,
  },
  notificationListContent: {
    paddingHorizontal: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A4D39',
    marginBottom: 4,
  },
  unread: {
    color: '#1A2421',
    fontWeight: '700',
  },
  notifMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: '#e63939',
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 8,
  },

  showMoreButton: {
    padding: 16,
    backgroundColor: '#f8f7f2',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  showMoreText: {
    color: '#936639',
    fontWeight: '700',
    fontSize: 15,
  },

  /* User Menu Dropdown */
  dropdown: {
    position: 'absolute',
    top: 88,
    right: 20,
    width: 230,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1000,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  dropdownEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#414833',
  },
  dropdownItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownText: {
    fontSize: 15.5,
    color: '#414833',
  },
  logoutButton: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: '#fdf0f0',
    borderRadius: 15,
    alignItems: 'center',
  },
  logoutText: {
    color: '#cd5c5c',
    fontWeight: '600',
  },
});
