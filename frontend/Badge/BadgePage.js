import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export default function BadgeScreen() {
  const badges = [
    { id: 1, name: 'Bako National Park', unlocked: true },
    { id: 2, name: 'Similajau National Park', unlocked: true },
    { id: 3, name: 'Kubah National Park', unlocked: true },
    { id: 4, name: 'Gunung Mulu National Park', unlocked: false },
    { id: 5, name: 'Maludam National Park', unlocked: false },
  ];

  const earnedBadges = badges.filter((badge) => badge.unlocked).length;
  const totalBadges = badges.length;

  return (
    <View style={styles.container}>
      <View style={styles.userSection}>
        <Image
          source={{ uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg' }}
          style={styles.userImage}
        />
        <Text style={styles.username}>User 123</Text>
        <Text style={styles.progress}>
          {earnedBadges} / {totalBadges} badges earned
        </Text>
      </View>

      <View style={styles.gridWrapper}>
        <View style={styles.grid}>
          {badges.map((badge) => (
            <TouchableOpacity key={badge.id} style={styles.badgeCard}>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png' }}
                style={[styles.badgeIcon, { opacity: badge.unlocked ? 1 : 0.3 }]}
              />
              <Text style={styles.badgeText}>{badge.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 10,
  },
  username: {
    fontWeight: 'bold',
  },
  progress: {
    color: '#666',
  },
  gridWrapper: {
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '90%',
  },
  badgeCard: {
    width: '30%',
    margin: '1.5%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    color: '#555',
  },
});