import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "innopapp_auth_token";
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.innopappserver.xyz"
).replace(/\/+$/, "");

async function apiRequest(path, options = {}) {
  const { method = "GET", token, body } = options;

  const headers = {
    Accept: "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.message || "Request failed.");
    }

    return payload.data;
  }

  return payload;
}

function formatDate(isoValue) {
  if (!isoValue) {
    return "-";
  }

  try {
    return new Date(isoValue).toLocaleString();
  } catch {
    return isoValue;
  }
}

export default function App() {
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [healthText, setHealthText] = useState("Checking API health...");

  const [qualifications, setQualifications] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [qualificationName, setQualificationName] = useState("");
  const [qualificationStatus, setQualificationStatus] = useState("Active");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementTargetRole, setAnnouncementTargetRole] = useState("User");

  const [message, setMessage] = useState("");

  const isAdmin = useMemo(
    () => Boolean(token && currentUser && currentUser.role === "Admin"),
    [token, currentUser]
  );

  useEffect(() => {
    async function bootstrap() {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
      }

      await checkHealth();
      await loadQualifications();
    }

    bootstrap().catch((error) => {
      setMessage(error.message || "Startup failed.");
    });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadAdminUsers(token).catch((error) => {
      setMessage(error.message || "Failed loading admin users.");
      logout();
    });
  }, [token]);

  async function checkHealth() {
    try {
      await apiRequest("/health");
      setHealthText("API is online");
    } catch {
      setHealthText("API is not reachable");
    }
  }

  async function loadQualifications() {
    setPublicLoading(true);
    try {
      const data = await apiRequest("/api/v1/qualifications");
      setQualifications(Array.isArray(data) ? data : []);
    } finally {
      setPublicLoading(false);
    }
  }

  async function loadAdminUsers(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setAdminLoading(true);
    try {
      const users = await apiRequest("/api/v1/admin/users", { token: currentToken });
      setAdminUsers(Array.isArray(users) ? users : []);
    } finally {
      setAdminLoading(false);
    }
  }

  async function login() {
    if (!loginUsername.trim() || !loginPassword) {
      setMessage("Username and password are required.");
      return;
    }

    try {
      const result = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          username: loginUsername.trim(),
          password: loginPassword,
        },
      });

      if (!result?.token || !result?.user) {
        throw new Error("Unexpected login response.");
      }

      if (result.user.role !== "Admin") {
        throw new Error("Only Admin users can access admin actions in this app.");
      }

      setToken(result.token);
      setCurrentUser(result.user);
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
      setLoginPassword("");
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error.message || "Login failed.");
    }
  }

  async function logout() {
    setToken("");
    setCurrentUser(null);
    setAdminUsers([]);
    await AsyncStorage.removeItem(TOKEN_KEY);
    setMessage("Signed out.");
  }

  async function createQualification() {
    if (!isAdmin) {
      setMessage("Please sign in as Admin first.");
      return;
    }

    if (!qualificationName.trim()) {
      setMessage("Qualification name is required.");
      return;
    }

    try {
      await apiRequest("/api/v1/admin/qualifications", {
        method: "POST",
        token,
        body: {
          name: qualificationName.trim(),
          status: qualificationStatus,
        },
      });

      setQualificationName("");
      setQualificationStatus("Active");
      setMessage("Qualification created.");
      await loadQualifications();
    } catch (error) {
      setMessage(error.message || "Failed creating qualification.");
    }
  }

  async function createAnnouncement() {
    if (!isAdmin) {
      setMessage("Please sign in as Admin first.");
      return;
    }

    if (!announcementTitle.trim() || !announcementContent.trim()) {
      setMessage("Announcement title and content are required.");
      return;
    }

    try {
      await apiRequest("/api/v1/admin/announcements", {
        method: "POST",
        token,
        body: {
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          targetRole: announcementTargetRole,
        },
      });

      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementTargetRole("User");
      setMessage("Announcement created.");
    } catch (error) {
      setMessage(error.message || "Failed creating announcement.");
    }
  }

  async function setUserStatus(userId, status) {
    if (!isAdmin) {
      setMessage("Please sign in as Admin first.");
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/users/${userId}/status`, {
        method: "PUT",
        token,
        body: {
          targetUserId: userId,
          status,
        },
      });

      setMessage(`User ${userId} set to ${status}.`);
      await loadAdminUsers();
    } catch (error) {
      setMessage(error.message || "Failed updating user status.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Innopapp Mobile</Text>
        <Text style={styles.subtitle}>API Base URL: {API_BASE_URL}</Text>
        <Text style={styles.health}>{healthText}</Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Public Qualifications</Text>
          <Pressable style={styles.buttonSecondary} onPress={loadQualifications}>
            <Text style={styles.buttonSecondaryText}>Refresh Qualifications</Text>
          </Pressable>

          {publicLoading ? <ActivityIndicator style={styles.loader} /> : null}

          {qualifications.length === 0 && !publicLoading ? (
            <Text style={styles.muted}>No qualifications found.</Text>
          ) : null}

          {qualifications.map((item) => (
            <View style={styles.card} key={item.qualificationId}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>ID: {item.qualificationId}</Text>
              <Text style={styles.cardMeta}>Status: {item.status}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>

          {!token ? (
            <>
              <TextInput
                style={styles.input}
                value={loginUsername}
                onChangeText={setLoginUsername}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
              />
              <Pressable style={styles.buttonPrimary} onPress={login}>
                <Text style={styles.buttonPrimaryText}>Sign In</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.buttonDanger} onPress={logout}>
                <Text style={styles.buttonPrimaryText}>Sign Out</Text>
              </Pressable>

              <Pressable style={styles.buttonSecondary} onPress={() => loadAdminUsers()}>
                <Text style={styles.buttonSecondaryText}>Refresh Users</Text>
              </Pressable>

              {adminLoading ? <ActivityIndicator style={styles.loader} /> : null}

              <Text style={styles.formTitle}>Create Qualification</Text>
              <TextInput
                style={styles.input}
                value={qualificationName}
                onChangeText={setQualificationName}
              />
              <TextInput
                style={styles.input}
                value={qualificationStatus}
                onChangeText={setQualificationStatus}
                autoCapitalize="none"
              />
              <Pressable style={styles.buttonPrimary} onPress={createQualification}>
                <Text style={styles.buttonPrimaryText}>Create Qualification</Text>
              </Pressable>

              <Text style={styles.formTitle}>Create Announcement</Text>
              <TextInput
                style={styles.input}
                value={announcementTitle}
                onChangeText={setAnnouncementTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={announcementContent}
                onChangeText={setAnnouncementContent}
              />
              <TextInput
                style={styles.input}
                value={announcementTargetRole}
                onChangeText={setAnnouncementTargetRole}
                autoCapitalize="none"
              />
              <Pressable style={styles.buttonPrimary} onPress={createAnnouncement}>
                <Text style={styles.buttonPrimaryText}>Create Announcement</Text>
              </Pressable>

              <Text style={styles.formTitle}>Users</Text>
              {adminUsers.map((user) => (
                <View style={styles.card} key={`user-${user.userId}`}>
                  <Text style={styles.cardTitle}>{user.username}</Text>
                  <Text style={styles.cardMeta}>Role: {user.role}</Text>
                  <Text style={styles.cardMeta}>Status: {user.status}</Text>
                  <Text style={styles.cardMeta}>Email: {user.email || "-"}</Text>
                  <Text style={styles.cardMeta}>Created: {formatDate(user.createdAt)}</Text>
                  <View style={styles.rowButtons}>
                    <Pressable
                      style={styles.buttonSecondary}
                      onPress={() => setUserStatus(user.userId, "Active")}
                    >
                      <Text style={styles.buttonSecondaryText}>Set Active</Text>
                    </Pressable>
                    <Pressable
                      style={styles.buttonSecondary}
                      onPress={() => setUserStatus(user.userId, "Inactive")}
                    >
                      <Text style={styles.buttonSecondaryText}>Set Inactive</Text>
                    </Pressable>
                    <Pressable
                      style={styles.buttonDanger}
                      onPress={() => setUserStatus(user.userId, "Suspended")}
                    >
                      <Text style={styles.buttonPrimaryText}>Suspend</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4efe5",
  },
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1b2f44",
  },
  subtitle: {
    fontSize: 12,
    color: "#4a5f74",
  },
  health: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f7b73",
  },
  message: {
    fontSize: 14,
    color: "#8f3f1f",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fffaf2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5c7b2",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1b2f44",
  },
  formTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#1b2f44",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cdbda7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  buttonPrimary: {
    backgroundColor: "#0f7b73",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  buttonSecondary: {
    backgroundColor: "#f2e6d5",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  buttonSecondaryText: {
    color: "#40566a",
    fontWeight: "700",
  },
  buttonDanger: {
    backgroundColor: "#ba3131",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  rowButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d5c7b2",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  cardTitle: {
    fontWeight: "700",
    color: "#1b2f44",
  },
  cardMeta: {
    fontSize: 12,
    color: "#5b7289",
  },
  muted: {
    color: "#5b7289",
  },
  loader: {
    marginVertical: 10,
  },
});
