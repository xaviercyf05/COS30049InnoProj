const state = {
  token: localStorage.getItem("innopapp_admin_token") || "",
  editingPostId: null,
  adminPosts: [],
  adminUsers: [],
};

const healthBadge = document.getElementById("health-badge");
const publicPostsContainer = document.getElementById("public-posts");
const refreshPublicButton = document.getElementById("refresh-public");
const loginForm = document.getElementById("login-form");
const adminMessage = document.getElementById("admin-message");
const adminWorkspace = document.getElementById("admin-workspace");
const logoutButton = document.getElementById("logout-btn");
const postForm = document.getElementById("post-form");
const postIdInput = document.getElementById("post-id");
const postTitleInput = document.getElementById("post-title");
const postContentInput = document.getElementById("post-content");
const postPublishedInput = document.getElementById("post-published");
const cancelEditButton = document.getElementById("cancel-edit");
const adminPostsList = document.getElementById("admin-posts");
const adminUserForm = document.getElementById("admin-user-form");
const adminUserUsernameInput = document.getElementById("admin-user-username");
const adminUserPasswordInput = document.getElementById("admin-user-password");
const adminUsersList = document.getElementById("admin-users");

const CANONICAL_WEB_HOST = "innopappserver.xyz";

function redirectFromWwwToCanonicalHost() {
  if (window.location.hostname !== `www.${CANONICAL_WEB_HOST}`) {
    return false;
  }

  const targetUrl = `${window.location.protocol}//${CANONICAL_WEB_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(targetUrl);
  return true;
}

const isRedirectingToCanonicalHost = redirectFromWwwToCanonicalHost();

const DEFAULT_REMOTE_API_BASE_URL = "https://api.innopappserver.xyz";

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const manualOverride = normalizeBaseUrl(window.__INNOPAPP_API_BASE_URL);
  if (manualOverride) {
    return manualOverride;
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalHost) {
    return "http://localhost:3000";
  }

  return DEFAULT_REMOTE_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoValue) {
  if (!isoValue) {
    return "-";
  }

  return new Date(isoValue).toLocaleString();
}

function getAuthHeaders() {
  if (!state.token) {
    return {};
  }

  return {
    Authorization: `Bearer ${state.token}`,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(buildApiUrl(url), options);

  if (response.status === 204) {
    return null;
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return payload;
}

function setHealthStatus(isOk, text) {
  healthBadge.textContent = text;
  healthBadge.classList.toggle("ok", Boolean(isOk));
}

function setAdminMessage(message, isOk = false) {
  adminMessage.textContent = message;
  adminMessage.classList.toggle("ok", Boolean(isOk));
}

function resetPostForm() {
  state.editingPostId = null;
  postForm.reset();
  postIdInput.value = "";
  postPublishedInput.value = "true";
}

function renderPublicPosts(posts) {
  if (!posts.length) {
    publicPostsContainer.innerHTML = "<p>No published posts yet.</p>";
    return;
  }

  publicPostsContainer.innerHTML = posts
    .map(
      (post) => `
        <article class="post-card">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.content)}</p>
          <div class="post-meta">Updated: ${escapeHtml(formatDate(post.updatedAt))}</div>
        </article>
      `
    )
    .join("");
}

function renderAdminPosts(posts) {
  if (!posts.length) {
    adminPostsList.innerHTML = "<li class=\"admin-item\">No posts available.</li>";
    return;
  }

  adminPostsList.innerHTML = posts
    .map(
      (post) => `
        <li class="admin-item">
          <div class="admin-item-head">
            <strong>${escapeHtml(post.title)}</strong>
            <span class="status-pill ${post.isPublished ? "published" : "draft"}">
              ${post.isPublished ? "Published" : "Draft"}
            </span>
          </div>
          <p>${escapeHtml(post.content)}</p>
          <div class="post-meta">Updated: ${escapeHtml(formatDate(post.updatedAt))}</div>
          <div class="admin-item-actions">
            <button class="btn btn-secondary" data-action="edit" data-id="${post.id}" type="button">Edit</button>
            <button class="btn btn-danger" data-action="delete" data-id="${post.id}" type="button">Delete</button>
          </div>
        </li>
      `
    )
    .join("");
}

function renderAdminUsers(users) {
  if (!users.length) {
    adminUsersList.innerHTML = "<li class=\"admin-item\">No admin accounts available.</li>";
    return;
  }

  adminUsersList.innerHTML = users
    .map(
      (user) => `
        <li class="admin-item">
          <div class="admin-item-head">
            <strong>${escapeHtml(user.username)}</strong>
            <span class="status-pill ${user.isActive ? "published" : "draft"}">
              ${user.isActive ? "Active" : "Disabled"}
            </span>
          </div>
          <div class="post-meta">Role: ${escapeHtml(user.role)}</div>
          <div class="post-meta">Created: ${escapeHtml(formatDate(user.createdAt))}</div>
        </li>
      `
    )
    .join("");
}

async function loadPublicPosts() {
  const posts = await fetchJson("/api/posts");
  renderPublicPosts(posts);
}

async function loadAdminPosts() {
  const posts = await fetchJson("/api/admin/posts", {
    headers: {
      ...getAuthHeaders(),
    },
  });

  state.adminPosts = posts;
  renderAdminPosts(posts);
}

async function loadAdminUsers() {
  const users = await fetchJson("/api/admin/users", {
    headers: {
      ...getAuthHeaders(),
    },
  });

  state.adminUsers = users;
  renderAdminUsers(users);
}

function updateAdminVisibility() {
  const signedIn = Boolean(state.token);
  adminWorkspace.classList.toggle("hidden", !signedIn);
  logoutButton.classList.toggle("hidden", !signedIn);
  loginForm.classList.toggle("hidden", signedIn);
}

async function handleLogin(event) {
  event.preventDefault();
  setAdminMessage("Signing in...");

  const formData = new FormData(loginForm);
  const payload = {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || ""),
  };

  try {
    const result = await fetchJson("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    state.token = result.token;
    localStorage.setItem("innopapp_admin_token", state.token);
    updateAdminVisibility();
    await Promise.all([loadAdminPosts(), loadAdminUsers()]);
    setAdminMessage("Signed in successfully.", true);
    loginForm.reset();
  } catch (error) {
    setAdminMessage(error.message || "Login failed.");
  }
}

async function handleSavePost(event) {
  event.preventDefault();

  const payload = {
    title: postTitleInput.value.trim(),
    content: postContentInput.value.trim(),
    isPublished: postPublishedInput.value === "true",
  };

  const isEditing = Boolean(state.editingPostId);
  const method = isEditing ? "PUT" : "POST";
  const url = isEditing ? `/api/admin/posts/${state.editingPostId}` : "/api/admin/posts";

  try {
    await fetchJson(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    setAdminMessage(isEditing ? "Post updated." : "Post created.", true);
    resetPostForm();
    await Promise.all([loadAdminPosts(), loadPublicPosts()]);
  } catch (error) {
    setAdminMessage(error.message || "Could not save post.");
  }
}

async function handleCreateAdminUser(event) {
  event.preventDefault();

  const payload = {
    username: adminUserUsernameInput.value.trim(),
    password: adminUserPasswordInput.value,
    role: "admin",
  };

  try {
    await fetchJson("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    setAdminMessage("Admin account created.", true);
    adminUserForm.reset();
    await loadAdminUsers();
  } catch (error) {
    setAdminMessage(error.message || "Could not create admin account.");
  }
}

function beginEdit(postId) {
  const post = state.adminPosts.find((item) => Number(item.id) === Number(postId));
  if (!post) {
    return;
  }

  state.editingPostId = post.id;
  postIdInput.value = String(post.id);
  postTitleInput.value = post.title;
  postContentInput.value = post.content;
  postPublishedInput.value = post.isPublished ? "true" : "false";
  setAdminMessage(`Editing post #${post.id}`);
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function handleDelete(postId) {
  const confirmed = window.confirm("Delete this post?");
  if (!confirmed) {
    return;
  }

  try {
    await fetchJson(`/api/admin/posts/${postId}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });

    setAdminMessage("Post deleted.", true);
    await Promise.all([loadAdminPosts(), loadPublicPosts()]);
  } catch (error) {
    setAdminMessage(error.message || "Could not delete post.");
  }
}

function handleAdminListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const postId = Number(button.dataset.id);

  if (action === "edit") {
    beginEdit(postId);
  }

  if (action === "delete") {
    handleDelete(postId);
  }
}

function logout() {
  state.token = "";
  localStorage.removeItem("innopapp_admin_token");
  state.adminPosts = [];
  state.adminUsers = [];
  adminPostsList.innerHTML = "";
  adminUsersList.innerHTML = "";
  resetPostForm();
  adminUserForm.reset();
  updateAdminVisibility();
  setAdminMessage("Signed out.", true);
}

async function initialize() {
  if (isRedirectingToCanonicalHost) {
    return;
  }

  refreshPublicButton.addEventListener("click", () => {
    loadPublicPosts().catch((error) => {
      setAdminMessage(error.message || "Failed loading posts.");
    });
  });

  loginForm.addEventListener("submit", handleLogin);
  postForm.addEventListener("submit", handleSavePost);
  adminUserForm.addEventListener("submit", handleCreateAdminUser);
  cancelEditButton.addEventListener("click", resetPostForm);
  adminPostsList.addEventListener("click", handleAdminListClick);
  logoutButton.addEventListener("click", logout);

  updateAdminVisibility();

  try {
    await fetchJson("/api/health");
    setHealthStatus(true, "API online and database reachable");
  } catch (error) {
    setHealthStatus(false, "API not reachable");
  }

  try {
    await loadPublicPosts();
  } catch (error) {
    publicPostsContainer.innerHTML = `<p>${escapeHtml(error.message || "Failed to load posts.")}</p>`;
  }

  if (!state.token) {
    return;
  }

  try {
    await Promise.all([loadAdminPosts(), loadAdminUsers()]);
    setAdminMessage("Admin session restored.", true);
    updateAdminVisibility();
  } catch (error) {
    logout();
    setAdminMessage("Stored session expired. Please sign in again.");
  }
}

initialize();
