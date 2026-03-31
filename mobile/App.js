import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "innopapp_admin_token";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://innopappserver.xyz").replace(/\/+$/, "");

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
  const [healthText, setHealthText] = useState("Checking API health...");

  const [publicPosts, setPublicPosts] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);

  const [adminPosts, setAdminPosts] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [postId, setPostId] = useState(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postPublishedText, setPostPublishedText] = useState("true");

  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const [message, setMessage] = useState("");

  const isEditing = useMemo(() => Boolean(postId), [postId]);

  useEffect(() => {
    async function bootstrap() {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
      }

      await checkHealth();
      await loadPublicPosts();
    }

    bootstrap().catch((error) => {
      setMessage(error.message || "Startup failed.");
    });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadAdminData(token).catch((error) => {
      setMessage(error.message || "Failed loading admin data.");
    });
  }, [token]);

  async function checkHealth() {
    try {
      await apiRequest("/api/health");
      setHealthText("API is online");
    } catch {
      setHealthText("API is not reachable");
    }
  }

  async function loadPublicPosts() {
    setPublicLoading(true);
    try {
      const posts = await apiRequest("/api/posts");
      setPublicPosts(posts || []);
    } finally {
      setPublicLoading(false);
    }
  }

  async function loadAdminData(currentToken = token) {
    setAdminLoading(true);
    try {
      const [posts, users] = await Promise.all([
        apiRequest("/api/admin/posts", { token: currentToken }),
        apiRequest("/api/admin/users", { token: currentToken }),
      ]);

      setAdminPosts(posts || []);
      setAdminUsers(users || []);
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
      const result = await apiRequest("/api/admin/login", {
        method: "POST",
        body: {
          username: loginUsername.trim(),
          password: loginPassword,
        },
      });

      setToken(result.token);
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
      setLoginPassword("");
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error.message || "Login failed.");
    }
  }

  async function logout() {
    setToken("");
    setAdminPosts([]);
    setAdminUsers([]);
    await AsyncStorage.removeItem(TOKEN_KEY);
    resetPostForm();
    setMessage("Signed out.");
  }

  function resetPostForm() {
    setPostId(null);
    setPostTitle("");
    setPostContent("");
    setPostPublishedText("true");
  }

  function startEdit(post) {
    setPostId(post.id);
    setPostTitle(post.title || "");
    setPostContent(post.content || "");
    setPostPublishedText(post.isPublished ? "true" : "false");
    setMessage(`Editing post #${post.id}`);
  }

  async function savePost() {
    if (!token) {
      setMessage("Please sign in first.");
      return;
    }

    if (!postTitle.trim() || !postContent.trim()) {
      setMessage("Post title and content are required.");
      return;
    }

    try {
      const payload = {
        title: postTitle.trim(),
        content: postContent.trim(),
        isPublished: String(postPublishedText).toLowerCase() === "true",
      };

      if (isEditing) {
        await apiRequest(`/api/admin/posts/${postId}`, {
          method: "PUT",
          token,
          body: payload,
        });
        setMessage("Post updated.");
      } else {
        await apiRequest("/api/admin/posts", {
          method: "POST",
          token,
          body: payload,
        });
        setMessage("Post created.");
      }

      resetPostForm();
      await Promise.all([loadPublicPosts(), loadAdminData()]);
    } catch (error) {
      setMessage(error.message || "Failed saving post.");
    }
  }

  async function deletePost(postIdToDelete) {
    Alert.alert("Delete post", "Are you sure you want to delete this post?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/admin/posts/${postIdToDelete}`, {
              method: "DELETE",
              token,
            });
            setMessage("Post deleted.");
            await Promise.all([loadPublicPosts(), loadAdminData()]);
          } catch (error) {
            setMessage(error.message || "Failed deleting post.");
          }
        },
      },
    ]);
  }

  async function createAdminUser() {
    if (!newAdminUsername.trim() || !newAdminPassword) {
      setMessage("New admin username and password are required.");
      return;
    }

    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        token,
        body: {
          username: newAdminUsername.trim(),
          password: newAdminPassword,
          role: "admin",
        },
      });

      setNewAdminUsername("");
      setNewAdminPassword("");
      setMessage("Admin account created.");
      await loadAdminData();
    } catch (error) {
      setMessage(error.message || "Failed creating admin user.");
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
          <Text style={styles.sectionTitle}>Public Posts</Text>
          <Pressable style={styles.buttonSecondary} onPress={loadPublicPosts}>
            <Text style={styles.buttonSecondaryText}>Refresh Public Feed</Text>
          </Pressable>

          {publicLoading ? <ActivityIndicator style={styles.loader} /> : null}

          {publicPosts.length === 0 && !publicLoading ? (
            <Text style={styles.muted}>No public posts yet.</Text>
          ) : null}

          {publicPosts.map((post) => (
            <View style={styles.card} key={post.id}>
              <Text style={styles.cardTitle}>{post.title}</Text>
              <Text style={styles.cardText}>{post.content}</Text>
              <Text style={styles.cardMeta}>Updated: {formatDate(post.updatedAt)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>

          {!token ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Admin username"
                value={loginUsername}
                onChangeText={setLoginUsername}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Admin password"
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

              <Pressable style={styles.buttonSecondary} onPress={() => loadAdminData()}>
                <Text style={styles.buttonSecondaryText}>Refresh Admin Data</Text>
              </Pressable>

              {adminLoading ? <ActivityIndicator style={styles.loader} /> : null}

              <Text style={styles.formTitle}>{isEditing ? "Edit Post" : "Create Post"}</Text>
              <TextInput
                style={styles.input}
                placeholder="Post title"
                value={postTitle}
                onChangeText={setPostTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Post content"
                multiline
                value={postContent}
                onChangeText={setPostContent}
              />
              <TextInput
                style={styles.input}
                placeholder="Published? true or false"
                value={postPublishedText}
                onChangeText={setPostPublishedText}
                autoCapitalize="none"
              />

              <View style={styles.rowButtons}>
                <Pressable style={styles.buttonPrimary} onPress={savePost}>
                  <Text style={styles.buttonPrimaryText}>{isEditing ? "Update Post" : "Create Post"}</Text>
                </Pressable>

                <Pressable style={styles.buttonSecondary} onPress={resetPostForm}>
                  <Text style={styles.buttonSecondaryText}>Reset</Text>
                </Pressable>
              </View>

              <Text style={styles.formTitle}>All Admin Posts</Text>
              {adminPosts.map((post) => (
                <View style={styles.card} key={`admin-post-${post.id}`}>
                  <Text style={styles.cardTitle}>{post.title}</Text>
                  <Text style={styles.cardText}>{post.content}</Text>
                  <Text style={styles.cardMeta}>Status: {post.isPublished ? "Published" : "Draft"}</Text>
                  <View style={styles.rowButtons}>
                    <Pressable style={styles.buttonSecondary} onPress={() => startEdit(post)}>
                      <Text style={styles.buttonSecondaryText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.buttonDanger} onPress={() => deletePost(post.id)}>
                      <Text style={styles.buttonPrimaryText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <Text style={styles.formTitle}>Create Additional Admin</Text>
              <TextInput
                style={styles.input}
                placeholder="New admin username"
                value={newAdminUsername}
                onChangeText={setNewAdminUsername}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="New admin password"
                secureTextEntry
                value={newAdminPassword}
                onChangeText={setNewAdminPassword}
              />
              <Pressable style={styles.buttonPrimary} onPress={createAdminUser}>
                <Text style={styles.buttonPrimaryText}>Create Admin User</Text>
              </Pressable>

              <Text style={styles.formTitle}>Current Admin Users</Text>
              {adminUsers.map((user) => (
                <View style={styles.card} key={`admin-user-${user.id}`}>
                  <Text style={styles.cardTitle}>{user.username}</Text>
                  <Text style={styles.cardMeta}>Role: {user.role}</Text>
                  <Text style={styles.cardMeta}>Status: {user.isActive ? "Active" : "Disabled"}</Text>
                  <Text style={styles.cardMeta}>Created: {formatDate(user.createdAt)}</Text>
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
  cardText: {
    color: "#2f455a",
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
