import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';

const AdminProfile = ({ navigation }) => {

  const admin = {
    fullName: 'Aina Rahman',
    email: 'aina.rahman@parkadmin.com',
    password: 'ParkAdmin123',
    role: 'Park Admin',
    station: 'Rainforest National Park HQ',
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
              <Text style={styles.subtitle}>
                Review your park admin information before approving updates, schedules, and operational records.
              </Text>
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
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>Team management</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>Operations</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>Safety first</Text></View>
              </View>
            </View>
          </View>
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
            <Text style={styles.fieldLabel}>Password</Text>
            <Text style={styles.fieldValue}>•••••••••••</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Station</Text>
            <Text style={styles.fieldValue}>{admin.station}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditAdminProfile')}
            activeOpacity={0.9}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1E18',
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
    backgroundColor: 'rgba(111, 164, 118, 0.18)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 220,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(198, 164, 113, 0.12)',
  },
  heroCard: {
    backgroundColor: '#173427',
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
    color: '#A7CFA8',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '700',
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F3F7EF',
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(243, 247, 239, 0.78)',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '100%',
  },
  badge: {
    backgroundColor: 'rgba(243, 247, 239, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#F3F7EF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    resizeMode: 'cover',
    backgroundColor: '#D7E3D1',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#F6FAF1',
    fontSize: 22,
    fontWeight: '800',
  },
  profileLabel: {
    color: '#A7CFA8',
    marginTop: 4,
    fontSize: 14,
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
    color: '#E7F0E2',
    fontSize: 12,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#F4F1E8',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginHorizontal: 100,
    marginVertical: 20,
  },
  sectionTitle: {
    color: '#1D3A2D',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldRow: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D4DDD1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: '#4D6A58',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#173427',
    fontSize: 15,
    fontWeight: '600',
  },
  editButton: {
    marginTop: 8,
    backgroundColor: '#2E6B4D',
    paddingVertical: 12,
    width: '30%',
    alignSelf: 'flex-end',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#13301F',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  editButtonText: {
    color: '#F5FAF2',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
});

export default AdminProfile;
