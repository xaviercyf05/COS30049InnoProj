import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Grade1Screen from './Grade1Screen';
import Grade2Screen from './Grade2Screen';
import Grade3Screen from './Grade3Screen';
import BadgeScreen from './BadgePage';

const Stack = createNativeStackNavigator();

/* ---------------- HOME SCREEN ---------------- */
function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SFC Training</Text>

        <View>
          <View style={styles.headerRight}>
            {/* Notification Bell */}
            <TouchableOpacity>
              <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827312.png' }}
                style={styles.icon}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
                <Image
                  source={{ uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg' }}
                  style={styles.userImage}
                />
            </TouchableOpacity>
          </View>

          {menuVisible && (
            <View style={styles.dropdown}>
              <View style={styles.topSection}>

                {/* USER HEADER (IMAGE + NAME) */}
                <View style={styles.userSection}>
                  <Image
                    source={{ uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg' }}
                    style={styles.dropdownImage}
                  />
                  <Text style={styles.username}>User 123</Text>
                </View>

                {/* MENU ITEMS */}
                <View style={styles.menuSection}>
                  <TouchableOpacity style={styles.dropdownItem}>
                    <Text style={styles.dropdownText}>👤 Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('Badges');
                    }}
                  >
                    <Text style={styles.dropdownText}>🏅 Badges</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dropdownItem}>
                    <Text style={styles.dropdownText}>📅 Calendar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dropdownItem}>
                    <Text style={styles.dropdownText}>📢 Announcement</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* LOGOUT BUTTON */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => setMenuVisible(false)}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>

            </View>
          )}
        </View>
      </View>

      {/* Dashboard Title */}
      <Text style={styles.pageTitle}>Dashboard</Text>

      {/* Cards */}
      <View style={styles.cardContainer}>

        {/* Grade 1 */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Grade1')}
          style={styles.cardWrapper}
        >
          <ImageBackground
            source={{ uri: 'https://imgs.mongabay.com/wp-content/uploads/sites/20/2018/03/09165734/20171123-153037-4-2.jpg' }}
            style={styles.card}
            imageStyle={{ borderRadius: 20 }}
          >
            <View style={styles.overlay} />

            <Text style={styles.cardTitle}>Grade 1</Text>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '40%' }]} />
              <Text style={styles.progressText}>40%</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Grade 2 */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Grade2')}
          style={styles.cardWrapper}
        >
          <ImageBackground
            source={{ uri: 'https://mongabay-images.s3.amazonaws.com/780/malaysia/sabah_sepilok_0337.jpg' }}
            style={styles.card}
            imageStyle={{ borderRadius: 20 }}
          >
            <View style={styles.overlay} />
            <Text style={styles.cardTitle}>Grade 2</Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '65%' }]} />
              <Text style={styles.progressText}>65%</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Grade 3 */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Grade3')}
          style={styles.cardWrapper}
        >
          <ImageBackground
            source={{ uri: 'https://gofbonline.com/wp-content/uploads/2017/06/sustainability-sarawak-banner.jpg' }}
            style={styles.card}
            imageStyle={{ borderRadius: 20 }}
          >
            <View style={styles.overlay} />
            <Text style={styles.cardTitle}>Grade 3</Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '20%' }]} />
              <Text style={styles.progressText}>20%</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

      </View>
    </View>
  );
}

/* ---------------- MAIN APP ---------------- */
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }} // hide default header
        />
        <Stack.Screen name="Grade1" component={Grade1Screen} />
        <Stack.Screen name="Grade2" component={Grade2Screen} />
        <Stack.Screen name="Grade3" component={Grade3Screen} />
        <Stack.Screen name="Badges" component={BadgeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8', 
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 20, // Account for notch
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0E8',
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3A4D39', // Dark Sage
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

  /* Dropdown */
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
    backgroundColor: '#FDF0F0', // Soft pastel red
    alignItems: 'center',
  },
  logoutText: {
    color: '#CD5C5C',
    fontWeight: '600',
  },

  /* Content */
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2421',
    marginHorizontal: 24,
    marginTop: 30,
    marginBottom: 10,
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
    fontSize: 16,      // Slightly larger for premium readability
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
  },
});
