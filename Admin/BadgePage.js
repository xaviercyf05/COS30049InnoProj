import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal } from 'react-native';

export default function BadgeScreen({ navigation }) {

    const [badges, setBadges] = useState([
        { id: 1, name: 'Bako National Park', grade: 1 },
        { id: 2, name: 'Similajau National Park', grade: 2 },
        { id: 3, name: 'Kubah National Park', grade: 2 },
        { id: 4, name: 'Gunung Mulu National Park', grade: 3 },
        { id: 5, name: 'Maludam National Park', grade: 3 },
    ]);

    const [activeMenu, setActiveMenu] = useState(null);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const isAdmin = true;

    const openDeleteModal = (id) => {
        setActiveMenu(null);
        setSelectedId(id);
        setDeleteModalVisible(true);
    };

    const confirmDelete = () => {
        setBadges(prev => prev.filter(b => b.id !== selectedId));
        setDeleteModalVisible(false);
        setSelectedId(null);
    };

    return (
        <View style={styles.container}>

            {/* HEADER */}
            <View style={styles.headerRow}>
                <Text style={styles.title}>All Badges</Text>

                <TouchableOpacity
                    style={styles.addButtonInline}
                    onPress={() => navigation.navigate('AddBadge')}
                >
                    <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {/* GRID */}
            <View style={styles.gridWrapper}>
                <View style={styles.grid}>

                    {badges.map((badge) => (

                        <View key={badge.id} style={styles.badgeCard}>

                            {/* ⋮ BUTTON */}
                            <TouchableOpacity
                                style={styles.menuIcon}
                                onPress={() =>
                                    setActiveMenu(activeMenu === badge.id ? null : badge.id)
                                }
                            >
                                <Text style={styles.menuDots}>⋮</Text>
                            </TouchableOpacity>

                            {/* DROPDOWN */}
                            {activeMenu === badge.id && (
                                <View style={styles.dropdownMenu}>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setActiveMenu(null);
                                            navigation.navigate('EditBadge', {
                                                badge,
                                                setBadges
                                            });
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
                                        <Text style={[styles.menuText, { color: 'red' }]}>
                                            Delete
                                        </Text>
                                    </TouchableOpacity>

                                </View>
                            )}

                            {/* ICON */}
                            <Image
                                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png' }}
                                style={styles.badgeIcon}
                            />

                            <Text style={styles.badgeText}>{badge.name}</Text>
                            <Text style={styles.gradeText}>Grade {badge.grade}</Text>

                        </View>
                    ))}

                </View>
            </View>

            {/* DELETE MODAL */}
            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>

                        <Text style={styles.modalTitle}>Delete Badge?</Text>
                        <Text style={styles.modalText}>This cannot be undone.</Text>

                        <View style={styles.modalButtons}>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#ccc' }]}
                                onPress={() => setDeleteModalVisible(false)}
                            >
                                <Text>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: 'red' }]}
                                onPress={confirmDelete}
                            >
                                <Text style={{ color: '#fff' }}>Delete</Text>
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
    },

    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        margin: 20,
    },

    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },

    addButtonInline: {
        backgroundColor: '#656d4a',
        padding: 8,
        borderRadius: 8,
    },

    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '90%',
    },

    gridWrapper: {
        alignItems: 'center',
    },

    badgeCard: {
        width: '30%',
        margin: '1.5%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        elevation: 3,
    },

    badgeIcon: {
        width: 50,
        height: 50,
    },

    badgeText: {
        fontSize: 12,
        marginTop: 5,
    },

    gradeText: {
        fontSize: 11,
        color: '#3A4D39',
    },

    menuIcon: {
        position: 'absolute',
        top: 5,
        right: 5,
        padding: 8,
        zIndex: 10,
    },

    badgeMenuText: {
        fontSize: 18,
    },

    dropdownMenu: {
        position: 'absolute',
        top: 30,
        right: 5,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        width: 100,
        borderRadius: 8,
        padding: 5,
        elevation: 5,
        zIndex: 20,
    },

    menuText: {
        padding: 10,
        fontSize: 14,
    },

    /* MODAL */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    modalBox: {
        width: 250,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },

    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },

    modalText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },

    modalButtons: {
        flexDirection: 'row',
        gap: 10,
    },

    modalBtn: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
    },
});