import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
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
  posted,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const isWeb = Platform.OS === "web";

  return (
    <TouchableOpacity
      style={[
        styles.announcement,
        expanded && styles.announcementExpanded,
        !isWeb && styles.announcementMobile,
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.9}
    >

      <View style={[styles.leftSection, !isWeb && styles.leftSectionMobile]}>
        <View style={styles.bullet} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarEmoji}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={[styles.announcementContent, !isWeb && styles.announcementContentMobile]}>
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
          <Text style={styles.posted}>Posted on: {posted}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function AnnounceScreen() {
  const announcements = [
    {
      id: 1,
      title: "Level 1 Training - Bako National Park",
      teaser: "Complete Level 1 to become a certified Park Guide for Bako National Park.",
      fullDesc: "Dear Trainees, To become a certified Park Guide for Bako National Park, you must successfully complete the entire Level 1 course. This level covers essential modules on conservation, biodiversity, safety protocols, and basic guiding skills specific to Bako.",
      posted: "12 Apr 2026, 20:45",
      avatarEmoji: "🌲",
    },
    {
      id: 2,
      title: "Level 2 Training Now Open - Similajau & Kubah National Parks",
      teaser: "Congratulations! Level 2 is now available for Similajau and Kubah National Parks.",
      fullDesc: "You may now enrol in Level 2 to become a certified guide for Similajau National Park and Kubah National Park.\n\nThis level focuses on advanced eco-tourism practices and park-specific regulations.",
      posted: "11 Apr 2026, 20:40",
      avatarEmoji: "🏞️",
    },
    {
      id: 3,
      title: "Level 3 Training Available - Gunung Mulu & Maludam National Parks",
      teaser: "Advanced certification for Gunung Mulu and Maludam National Parks is now open.",
      fullDesc: "Level 3 is now open for Gunung Mulu National Park and Maludam National Park.\n\nCompletion of Level 1 and Level 2 is required before starting this final certification track.",
      posted: "10 Apr 2026, 20:35",
      avatarEmoji: "🏔️",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.pageTitle}>Announcements</Text>
      <Text style={styles.subtitle}>
        Digital Park Guide Training Platform • Sarawak Forestry Corporation
      </Text>

      {announcements.map((item) => (
        <AnnouncementCard
          key={item.id}
          title={item.title}
          teaser={item.teaser}
          fullDesc={item.fullDesc}
          avatarEmoji={item.avatarEmoji}
          posted={item.posted}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f7f2"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.olive,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.brown,
    marginBottom: 24
  },

  announcement: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    elevation: 4,
  },

  announcementMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },

  announcementExpanded: {
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },

  leftSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginRight: 12,
  },
  leftSectionMobile: {
    marginRight: 0,
  },

  bullet: {
    width: 9,
    height: 9,
    backgroundColor: "#e74c3c",
    borderRadius: 50,
    marginTop: 10,
    marginRight: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    backgroundColor: "#a68a64",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 24,
  },

  announcementContent: {
    flex: 1,
  },
  announcementContentMobile: {
    width: "100%",
  },

  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  announcementTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.olive,
    flex: 1,
    paddingRight: 8,
  },

  chevron: {
    fontSize: 22,
    color: colors.sage,
  },

  chevronRotated: {
    transform: [{ rotate: "90deg" }],
  },

  teaser: {
    fontSize: 15,
    color: colors.forest,
    lineHeight: 21,
  },

  fullDescContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  fullDesc: {
    fontSize: 15,
    color: colors.forest,
    lineHeight: 23,
  },

  meta: {
    marginTop: 14,
    alignItems: "flex-end",
  },

  posted: {
    fontSize: 13,
    color: colors.brown,
    fontWeight: "500",
  },
});
