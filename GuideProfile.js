import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GuideProfile = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isPhone = width < 900;

  const guide = {
    fullName: 'John Doe',
    email: 'john.doe@gmail.com',
    username: 'johndoe_park',
    phoneNumber: '012-345 6789',
    password: 'ParkGuide123',
    role: 'Park Guide',
    userId: 'PG-1234',
    station: 'Bako National Park',
    progress: 'Chapter 2 (78%)',
    chapterStatus: {
      chapter1: 'Completed',
      chapter2: 'In Progress',
      chapter3: 'Incomplete',
      onSiteTraining: 'Incomplete',
    },
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
              <Text style={styles.kicker}>National Park Guide</Text>
              <Text style={styles.header}>Guide Profile</Text>
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
              <Text style={styles.profileName}>{guide.fullName}</Text>
              <Text style={styles.profileLabel}>{guide.role}</Text>
              <Text style={styles.profileSubLabel}>User ID: {guide.userId}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>Bako National Park</Text></View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heroEditButton}
            onPress={() => navigation.navigate('EditGuideProfile')}
            activeOpacity={0.9}
          >
            <Text style={styles.heroEditButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoGrid, !isPhone && styles.infoGridDesktop]}>
          <View style={[styles.formCard, !isPhone && styles.infoCardDesktop]}>
            <Text style={styles.sectionTitle}>Guide Information</Text>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <Text style={styles.fieldValue}>{guide.fullName}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{guide.email}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Username</Text>
              <Text style={styles.fieldValue}>{guide.username}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <Text style={styles.fieldValue}>{guide.phoneNumber}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Password</Text>
              <Text style={styles.fieldValue}>•••••••••••</Text>
            </View>

            <View style={styles.fieldRowLast}>
              <Text style={styles.fieldLabel}>Station</Text>
              <Text style={styles.fieldValue}>{guide.station}</Text>
            </View>
          </View>

          <View style={[styles.progressCard, !isPhone && styles.infoCardDesktop, !isPhone && styles.progressCardDesktop]}>
            <Text style={styles.sectionTitle}>Progress & Status</Text>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Progress</Text>
              <Text style={styles.fieldValue}>{guide.progress}</Text>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>Chapter 1</Text>
                <Text style={styles.statusValue}>{guide.chapterStatus.chapter1}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>Chapter 2</Text>
                <Text style={styles.statusValue}>{guide.chapterStatus.chapter2}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>Chapter 3</Text>
                <Text style={styles.statusValue}>{guide.chapterStatus.chapter3}</Text>
              </View>
              <View style={styles.statusRowLast}>
                <Text style={styles.statusText}>On-Site Training</Text>
                <Text style={styles.statusValue}>{guide.chapterStatus.onSiteTraining}</Text>
              </View>
            </View>
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
    backgroundColor: 'rgba(164, 172, 134, 0.22)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 220,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(182, 173, 144, 0.16)',
  },
  heroCard: {
    backgroundColor: '#414833',
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
    backgroundColor: 'rgba(194, 197, 170, 0.3)',
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
  profileSubLabel: {
    color: 'rgba(231, 240, 226, 0.9)',
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
    color: '#E7F0E2',
    fontSize: 12,
    fontWeight: '600',
  },
  heroEditButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: '#656D4A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A4AC86',
  },
  heroEditButtonText: {
    color: '#FBFCF8',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  infoGrid: {
    flexDirection: 'column',
    gap: 0,
    marginTop: 6,
    marginHorizontal: 30,
    alignItems: 'stretch',
  },
  infoGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  formCard: {
    backgroundColor: '#C2C5AA',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#A4AC86',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    width: '100%',
    marginTop: 25,
    marginHorizontal: 0,
  },
  progressCard: {
    backgroundColor: '#C2C5AA',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#A4AC86',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    width: '100%',
    marginTop: 20,
    marginHorizontal: 0,
  },
  infoCardDesktop: {
    flex: 1,
  },
  progressCardDesktop: {
    marginTop: 25,
  },
  sectionTitle: {
    color: '#333D29',
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
    color: '#414833',
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
  statusCard: {
    marginTop: 2,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#A4AC86',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#B6AD90',
  },
  statusRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  statusText: {
    color: '#414833',
    fontSize: 14,
    fontWeight: '600',
  },
  statusValue: {
    color: '#333D29',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default GuideProfile;