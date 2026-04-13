import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export default function BadgeScreen({ navigation }) {

    const badges = [
        {
            id: 1,
            name: 'Bako National Park',
            grade: 1,
            unlocked: true
        },
        {
            id: 2,
            name: 'Similajau National Park',
            grade: 2,
            unlocked: true
        },
        {
            id: 3,
            name: 'Kubah National Park',
            grade: 2,
            unlocked: true
        },
        {
            id: 4,
            name: 'Gunung Mulu National Park',
            grade: 3,
            unlocked: false
        },
        {
            id: 5,
            name: 'Maludam National Park',
            grade: 3,
            unlocked: false
        },
    ];

    const isAdmin = true;

    const earnedBadges = badges.filter(b => b.unlocked).length;
    const totalBadges = badges.length;

    const displayedBadges = isAdmin
        ? badges
        : badges.filter(b => b.unlocked);

    return (
        <View style={styles.container}>

            {/* USER INFO (only for users) */}
            {!isAdmin && (
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
            )}

            {/* HEADER */}
            <View style={styles.headerRow}>
                <Text style={styles.title}>
                    {isAdmin ? 'All Badges' : 'My Badges'}
                </Text>

                {isAdmin && (
                    <TouchableOpacity
                        style={styles.addButtonInline}
                        onPress={() => navigation.navigate('AddBadge')}
                    >
                        <Text style={styles.addButtonText}>+ Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* GRID */}
            <View style={styles.gridWrapper}>
                <View style={styles.grid}>
                    {displayedBadges.map((badge) => (
                        <TouchableOpacity key={badge.id} style={styles.badgeCard}>

                            {/* ICON */}
                            <Image
                                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png' }}
                                style={[
                                    styles.badgeIcon,
                                    !isAdmin && { opacity: badge.unlocked ? 1 : 0.3 }
                                ]}
                            />

                            {/* NAME */}
                            <Text style={styles.badgeText}>
                                {badge.name}
                            </Text>

                            {/* GRADE */}
                            <Text style={styles.gradeText}>
                                Grade {badge.grade}
                            </Text>

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
        backgroundColor: '#FBFCF8',
    },

    title: {
        fontSize: 24,
        fontWeight: 'bold',
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
        alignItems: 'center', // 👈 THIS centers the whole grid
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '90%', // 👈 control total width
    },

    badgeCard: {
        width: '30%',
        margin: '1.5%', // 👈 equal spacing (IMPORTANT)
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        // iOS shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,

        // Android shadow
        elevation: 3,
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

    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        marginHorizontal: 20,
        marginTop: 20,
    },

    addButtonInline: {
        backgroundColor: '#656d4a',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },

    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },

    gradeText: {
        fontSize: 11,
        color: '#3A4D39',
        marginTop: 2,
        fontWeight: '600'
    },
});