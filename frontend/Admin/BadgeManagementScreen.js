import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import withRoleGuard from '../auth/withRoleGuard.js';
import { pickProfileImagePath, resolveProfileImageUri } from '../Profile/profileApi.js';

const INITIAL_BADGES = [
  { id: 1, name: 'Bako National Park', unlocked: true },
  { id: 2, name: 'Similajau National Park', unlocked: true },
  { id: 3, name: 'Kubah National Park', unlocked: true },
  { id: 4, name: 'Gunung Mulu National Park', unlocked: false },
  { id: 5, name: 'Maludam National Park', unlocked: false },
];

function BadgeManagementScreen({ navigation, route, currentProfile }) {
  const [badges, setBadges] = useState(INITIAL_BADGES);
  const [activeMenu, setActiveMenu] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const createdBadge = route?.params?.createdBadge;
  const updatedBadge = route?.params?.updatedBadge;

  useEffect(() => {
    if (!createdBadge) {
      return;
    }

    setBadges((previous) => {
      const alreadyExists = previous.some((badge) => badge.id === createdBadge.id);
      if (alreadyExists) {
        return previous;
      }

      return [createdBadge, ...previous];
    });

    navigation.setParams({ createdBadge: undefined });
  }, [createdBadge, navigation]);

  useEffect(() => {
    if (!updatedBadge) {
      return;
    }

    setBadges((previous) =>
      previous.map((badge) =>
        badge.id === updatedBadge.id ? { ...badge, ...updatedBadge } : badge
      )
    );

    navigation.setParams({ updatedBadge: undefined });
  }, [updatedBadge, navigation]);

  const earnedBadges = badges.filter((badge) => badge.unlocked).length;
  const displayName = currentProfile?.fullName || currentProfile?.username || 'Admin';
  const avatarSource = useMemo(() => {
    const resolvedProfileImagePath = pickProfileImagePath(currentProfile);

    if (resolvedProfileImagePath) {
      return { uri: resolveProfileImageUri(resolvedProfileImagePath) };
    }

    return {
      uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg',
    };
  }, [currentProfile]);

  const openDeleteModal = (id) => {
    setActiveMenu(null);
    setSelectedId(id);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    setBadges((previous) => previous.filter((badge) => badge.id !== selectedId));
    setDeleteModalVisible(false);
    setSelectedId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileRow}>
        <Image source={avatarSource} style={styles.profileImage} />
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileSubtext}>
            {earnedBadges} / {badges.length} badges unlocked
          </Text>
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Badge Management</Text>

        <TouchableOpacity
          style={styles.addButtonInline}
          onPress={() => navigation.navigate('AddBadge')}
        >
          <Text style={styles.addButtonText}>+ Add Badge</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridWrapper}>
        <View style={styles.grid}>
          {badges.map((badge) => (
            <View key={badge.id} style={styles.badgeCard}>
              <TouchableOpacity
                style={styles.menuIcon}
                onPress={() => setActiveMenu(activeMenu === badge.id ? null : badge.id)}
              >
                <Text style={styles.menuDots}>...</Text>
              </TouchableOpacity>

              {activeMenu === badge.id && (
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveMenu(null);
                      navigation.navigate('EditBadge', { badge });
                    }}
                  >
                    <Text style={styles.menuText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setActiveMenu(null);
                      openDeleteModal(badge.id);
                    }}
                  >
                    <Text style={[styles.menuText, styles.menuDeleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png' }}
                style={[styles.badgeIcon, { opacity: badge.unlocked ? 1 : 0.35 }]}
              />

              <Text style={styles.badgeText}>{badge.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete badge?</Text>
            <Text style={styles.modalText}>This frontend change cannot be undone.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={confirmDelete}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    padding: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  profileMeta: {
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#20372A',
  },
  profileSubtext: {
    marginTop: 4,
    color: '#4B6252',
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3A4D39',
  },
  addButtonInline: {
    backgroundColor: '#656D4A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  gridWrapper: {
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'flex-start',
  },
  badgeCard: {
    width: '31%',
    minWidth: 130,
    margin: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECE3',
    elevation: 3,
  },
  badgeIcon: {
    width: 50,
    height: 50,
  },
  badgeText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    color: '#4E5D53',
  },
  menuIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 20,
  },
  menuDots: {
    fontSize: 16,
    fontWeight: '700',
    color: '#596856',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 28,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE5D8',
    width: 110,
    borderRadius: 8,
    paddingVertical: 4,
    elevation: 8,
    zIndex: 30,
  },
  menuText: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2F4030',
  },
  menuDeleteText: {
    color: '#C73737',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    color: '#293F32',
  },
  modalText: {
    fontSize: 13,
    color: '#5A6958',
    marginBottom: 18,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#DDE2D8',
  },
  deleteBtn: {
    backgroundColor: '#C73737',
  },
  cancelText: {
    color: '#2B3A2A',
    fontWeight: '600',
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default withRoleGuard(BadgeManagementScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Badge Management',
});
