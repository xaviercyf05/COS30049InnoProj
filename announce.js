// announce.js
import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const colors = {
  olive: "#936639",
  brown: "#7f4f24",
  sage: "#a4ac86",
  forest: "#414833",
  deepForest: "#333d29",
};

const AnnouncementCard = ({
  title,
  teaser,
  fullDesc,
  avatarEmoji,
  postedDate,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <TouchableOpacity
      style={[styles.announcement, expanded && styles.announcementExpanded]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.9}
    >
      <View style={styles.bullet} />
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatarEmoji}</Text>
      </View>
      <View style={styles.announcementContent}>
        <View style={styles.announcementHeader}>
          <Text style={styles.announcementTitle}>{title}</Text>
          <Text style={[styles.chevron, expanded && styles.chevronRotated]}>
            ›
          </Text>
        </View>
        <Text style={styles.teaser}>{teaser}</Text>
        {expanded && (
          <View style={styles.fullDescContainer}>
            <Text style={styles.fullDesc}>{fullDesc}</Text>
          </View>
        )}
        <View style={styles.meta}>
          <View style={styles.sectionTag}>
            <Text style={styles.sectionTagText}>1 section</Text>
          </View>
          <Text style={styles.posted}>Posted on: {postedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function AnnounceScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.pageTitle}>Announcements</Text>
      <Text style={styles.subtitle}>
        Digital Park Guide Training Platform • Sarawak Forestry Corporation
      </Text>

      <AnnouncementCard
        title="Level 1 Training - Bako National Park"
        teaser="Complete Level 1 to become a certified Park Guide for Bako National Park."
        fullDesc="Dear Trainees,To become a certified Park Guide for Bako National Park, you must successfully complete the entire Level 1 course. This level covers essential modules on conservation, biodiversity, safety protocols, and basic guiding skills specific to Bako."
        avatarEmoji="&#127795;"
        postedDate="12 Apr 2026, 20:45"
      />

      <AnnouncementCard
        title="Level 2 Training Now Open - Similajau & Kubah National Parks"
        teaser="Congratulations! Level 2 is now available for Similajau and Kubah National Parks."
        fullDesc="You may now enrol in Level 2 to become a certified guide for Similajau National Park and Kubah National Park.\n\nThis level focuses on advanced eco-tourism practices and park-specific regulations."
        avatarEmoji="&#127966;"
        postedDate="11 Apr 2026, 20:40"
      />

      <AnnouncementCard
        title="Level 3 Training Available - Gunung Mulu & Maludam National Parks"
        teaser="Advanced certification for Gunung Mulu and Maludam National Parks is now open."
        fullDesc="Level 3 is now open for Gunung Mulu National Park and Maludam National Park.\n\nCompletion of Level 1 and Level 2 is required before starting this final certification track."
        avatarEmoji="&#127956;"
        postedDate="10 Apr 2026, 20:35"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  scrollContent: { padding: 20 },
  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.olive,
    marginBottom: 4,
  },
  subtitle: { fontSize: 16, color: colors.brown, marginBottom: 30 },

  announcement: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    elevation: 4,
  },

  announcementExpanded: {
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  bullet: {
    width: 10,
    height: 10,
    backgroundColor: "#e74c3c",
    borderRadius: 50,
    marginTop: 8,
    marginRight: 14,
  },

  avatar: {
    width: 48,
    height: 48,
    backgroundColor: "#a68a64",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    fontSize: 26
  },

  announcementContent: {
    flex: 1
  },

  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  announcementTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.olive,
    flex: 1,
  },

  chevron: {
    fontSize: 24,
    color: colors.sage
  },

  chevronRotated: {
    transform: [{ rotate: "90deg" }]
  },

  teaser: {
    fontSize: 15.5,
    color: colors.forest,
    lineHeight: 22
  },

  fullDescContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  fullDesc: {
    fontSize: 15.5,
    color: colors.forest,
    lineHeight: 24
  },

  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16, gap: 12
  },

  sectionTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },

  sectionTagText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555"
  },

  posted: {
    fontSize: 13.5,
    color: colors.brown,
    fontWeight: "500",
    marginLeft: "auto",
  },
});
