import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';

import AnnounceScreen from './announce';
import ModuleScreen from './module';

const Stack = createNativeStackNavigator();

function CustomHeader({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>&#127795; SFC Digital Park Guide</Text>

      <View style={styles.headerRight}>
        {/* Notification Bell */}
        <TouchableOpacity>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827312.png' }}
            style={styles.icon}
          />
        </TouchableOpacity>

        {/* User Emoji */}
        <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
          <Text style={styles.userEmoji}>👷‍♂️</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
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

/* ==================== HEADER STYLES ==================== */
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333d29',
    paddingHorizontal: 10,
    paddingTop: 25,
    paddingBottom: 15,
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

  dropdown: {
    position: 'absolute',
    top: 95,
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