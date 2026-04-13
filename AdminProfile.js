import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AdminProfile = ({ navigation }) => {

  const admin = {
    fullName: 'Aina Rahman',
    email: 'aina.rahman@parkadmin.com',
    username: 'aina_rahman_admin',
    phoneNumber: '013-456 7890',
    password: 'ParkAdmin123',
    role: 'Park Admin',
    userId: 'AD-2048',
    station: 'Kubah National Park',
  };

  const defaultAvatar = require('./assets/icon.png');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.kicker}>National Park Admin</Text>
              <Text style={styles.header}>Admin Profile</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Park Staff</Text>
            </View>
          </View>

          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Image source={defaultAvatar} style={styles.image} />
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{admin.fullName}</Text>
              <Text style={styles.profileLabel}>{admin.role}</Text>
              <Text style={styles.profileSubLabel}>User ID: {admin.userId}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>{admin.station}</Text></View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heroEditButton}
            onPress={() => navigation.navigate('EditAdminProfile')}
            activeOpacity={0.9}
          >
            <Text style={styles.heroEditButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Admin Information</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <Text style={styles.fieldValue}>{admin.fullName}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{admin.email}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Text style={styles.fieldValue}>{admin.username}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Text style={styles.fieldValue}>{admin.phoneNumber}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Password</Text>
            <Text style={styles.fieldValue}>•••••••••••</Text>
          </View>

          <View style={styles.fieldRowLast}>
            <Text style={styles.fieldLabel}>Station</Text>
            <Text style={styles.fieldValue}>{admin.station}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(147, 102, 57, 0.2)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 220,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(166, 138, 100, 0.14)',
  },
  heroCard: {
    backgroundColor: '#582F0E',
    borderRadius: 28,
    padding: 20,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    marginHorizontal: 30,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  kicker: {
    color: '#C2C5AA',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '700',
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FBFCF8',
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 10,
    color: '#B6AD90',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '100%',
  },
  badge: {
    backgroundColor: 'rgba(194, 197, 170, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#FBFCF8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
  },
  imageContainer: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 4,
    backgroundColor: 'rgba(194, 197, 170, 0.28)',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    resizeMode: 'cover',
    backgroundColor: '#B6AD90',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#FBFCF8',
    fontSize: 22,
    fontWeight: '800',
  },
  profileLabel: {
    color: '#B6AD90',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  profileSubLabel: {
    color: 'rgba(251, 252, 248, 0.9)',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: 'rgba(243, 247, 239, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    color: '#FBFCF8',
    fontSize: 12,
    fontWeight: '600',
  },
  heroEditButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: '#7F4F24',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A68A64',
  },
  heroEditButtonText: {
    color: '#FBFCF8',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  formCard: {
    backgroundColor: '#B6AD90',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#936639',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginHorizontal: 30,
    marginVertical: 30,
  },
  sectionTitle: {
    color: '#582F0E',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldRow: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A4AC86',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: '#7F4F24',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#333D29',
    fontSize: 15,
    fontWeight: '600',
  },
  fieldRowLast: {
    borderWidth: 1,
    borderColor: '#A4AC86',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

export default AdminProfile;
