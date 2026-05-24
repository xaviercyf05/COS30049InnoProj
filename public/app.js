const state = {
  token: localStorage.getItem("innopapp_auth_token") || "",
  user: null,
  qualifications: [],
  users: [],
};
 
const healthBadge = document.getElementById("health-badge");
const publicPostsContainer = document.getElementById("public-posts");
const refreshPublicButton = document.getElementById("refresh-public");
const loginForm = document.getElementById("login-form");
const adminMessage = document.getElementById("admin-message");
const adminWorkspace = document.getElementById("admin-workspace");
const logoutButton = document.getElementById("logout-btn");

const qualificationForm = document.getElementById("post-form");
const qualificationNameInput = document.getElementById("post-title");
const qualificationStatusInput = document.getElementById("post-published");
const clearQualificationButton = document.getElementById("cancel-edit");

const usersList = document.getElementById("admin-posts");

const announcementForm = document.getElementById("admin-user-form");
const announcementTitleInput = document.getElementById("admin-user-username");
const announcementContentInput = document.getElementById("admin-user-password");
const announcementTargetRoleInput = document.getElementById("announcement-target-role");

const enrollmentDetailsList = document.getElementById("admin-users");

const CANONICAL_WEB_HOST = "innopappserver.xyz";
const DEFAULT_REMOTE_API_BASE_URL = "https://api.innopappserver.xyz";

function redirectFromLocalFileToHostedClient() {
  if (window.location.protocol !== "file:") {
    return false;
  }

  const targetUrl = `https://${CANONICAL_WEB_HOST}/`;
  window.location.replace(targetUrl);
  return true;
}

function redirectFromWwwToCanonicalHost() {
  if (window.location.hostname !== `www.${CANONICAL_WEB_HOST}`) {
    return false;
  }

  const targetUrl = `${window.location.protocol}//${CANONICAL_WEB_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(targetUrl);
  return true;
}

const isRedirectingToCanonicalHost =
  redirectFromLocalFileToHostedClient() || redirectFromWwwToCanonicalHost();

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const manualOverride = normalizeBaseUrl(window.__INNOPAPP_API_BASE_URL);
  if (manualOverride) {
    return manualOverride;
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

function unwrapApiPayload(payload) {
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.message || "Request failed.");
    }

    return payload.data;
  }

  return payload;
}

async function fetchJson(url, options = {}) {
  let response;

  try {
    response = await fetch(buildApiUrl(url), options);
  } catch (error) {
    if (window.location.protocol === "file:" || window.location.origin === "null") {
      throw new Error(
        "Open this app from https://innopappserver.xyz instead of opening index.html as a file."
      );
    }

    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return unwrapApiPayload(payload);
}

function setHealthStatus(isOk, text) {
  healthBadge.textContent = text;
  healthBadge.classList.toggle("ok", Boolean(isOk));
}

function setAdminMessage(message, isOk = false) {
  adminMessage.textContent = message;
  adminMessage.classList.toggle("ok", Boolean(isOk));
}

function resetQualificationForm() {
  qualificationForm.reset();
  qualificationStatusInput.value = "Active";
}

function renderQualifications(qualifications) {
  if (!qualifications.length) {
    publicPostsContainer.innerHTML = "<p>No qualifications available.</p>";
    return;
  }

  publicPostsContainer.innerHTML = qualifications
    .map(
      (qualification) => `
        <article class="post-card">
          <h3>${escapeHtml(qualification.name)}</h3>
          <div class="post-meta">ID: ${escapeHtml(qualification.qualificationId)}</div>
          <div class="post-meta">Status: ${escapeHtml(qualification.status)}</div>
        </article>
      `
    )
    .join("");
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = '<li class="admin-item">No users found.</li>';
    return;
  }

  usersList.innerHTML = users
    .map(
      (user) => `
      <li class="admin-item">
        <div class="admin-item-head">
          <strong>${escapeHtml(user.username)}</strong>
          <span class="status-pill ${user.isActive ? "published" : "draft"}">${escapeHtml(
            user.status
          )}</span>
        </div>
        <div class="post-meta">Role: ${escapeHtml(user.role)}</div>
        <div class="post-meta">Email: ${escapeHtml(user.email || "-")}</div>
        <div class="post-meta">Created: ${escapeHtml(formatDate(user.createdAt))}</div>
        <div class="admin-item-actions">
          <button class="btn btn-secondary" data-action="set-status" data-id="${user.userId}" data-status="Active" type="button">Set Active</button>
          <button class="btn btn-secondary" data-action="set-status" data-id="${user.userId}" data-status="Inactive" type="button">Set Inactive</button>
          <button class="btn btn-danger" data-action="set-status" data-id="${user.userId}" data-status="Suspended" type="button">Suspend</button>
          <button class="btn btn-secondary" data-action="enrollments" data-id="${user.userId}" type="button">View Enrollments</button>
        </div>
      </li>
    `
    )
    .join("");
}

function renderEnrollmentDetails(data) {
  if (!data) {
    enrollmentDetailsList.innerHTML = '<li class="admin-item">No details loaded.</li>';
    return;
  }

  const enrollments = Array.isArray(data.enrollments) ? data.enrollments : [];

  enrollmentDetailsList.innerHTML = `
    <li class="admin-item">
      <div class="admin-item-head">
        <strong>${escapeHtml(data.username || "Unknown User")}</strong>
      </div>
      <div class="post-meta">Full Name: ${escapeHtml(data.fullName || "-")}</div>
      <div class="post-meta">Email: ${escapeHtml(data.email || "-")}</div>
      <div class="post-meta">Enrollments: ${escapeHtml(enrollments.length)}</div>
      ${
        enrollments.length
          ? `<div class="post-meta">${enrollments
              .map(
                (item) =>
                  `${escapeHtml(item.qualificationName)} (${escapeHtml(item.status)})`
              )
              .join("<br />")}</div>`
          : '<div class="post-meta">No enrollments.</div>'
      }
    </li>
  `;
}

async function loadQualifications() {
  const qualifications = await fetchJson("/api/v1/qualifications");
  state.qualifications = Array.isArray(qualifications) ? qualifications : [];
  renderQualifications(state.qualifications);
}

async function loadAdminUsers() {
  const users = await fetchJson("/api/v1/admin/users", {
    headers: {
      ...getAuthHeaders(),
    },
  });

  state.users = Array.isArray(users) ? users : [];
  renderUsers(state.users);
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
    const result = await fetchJson("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!result?.token || !result?.user) {
      throw new Error("Unexpected login response.");
    }

    if (result.user.role !== "Admin") {
      throw new Error("Only Admin users can access this dashboard.");
    }

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem("innopapp_auth_token", state.token);
    updateAdminVisibility();
    await loadAdminUsers();
    setAdminMessage("Signed in successfully.", true);
    loginForm.reset();
  } catch (error) {
    setAdminMessage(error.message || "Login failed.");
  }
}

async function handleCreateQualification(event) {
  event.preventDefault();

  const name = qualificationNameInput.value.trim();
  const status = qualificationStatusInput.value;

  if (!name) {
    setAdminMessage("Qualification name is required.");
    return;
  }

  try {
    await fetchJson("/api/v1/admin/qualifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name, status }),
    });

    setAdminMessage("Qualification created.", true);
    resetQualificationForm();
    await loadQualifications();
  } catch (error) {
    setAdminMessage(error.message || "Could not create qualification.");
  }
}

async function handleCreateAnnouncement(event) {
  event.preventDefault();

  const title = announcementTitleInput.value.trim();
  const content = announcementContentInput.value.trim();
  const targetRole = announcementTargetRoleInput.value;

  if (!title || !content) {
    setAdminMessage("Announcement title and content are required.");
    return;
  }

  try {
    await fetchJson("/api/v1/admin/announcements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ title, content, targetRole }),
    });

    setAdminMessage("Announcement created.", true);
    announcementForm.reset();
    announcementTargetRoleInput.value = "User";
  } catch (error) {
    setAdminMessage(error.message || "Could not create announcement.");
  }
}

async function handleSetUserStatus(userId, status) {
  try {
    await fetchJson(`/api/v1/admin/users/${userId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ targetUserId: userId, status }),
    });

    setAdminMessage(`User ${userId} status set to ${status}.`, true);
    await loadAdminUsers();
  } catch (error) {
    setAdminMessage(error.message || "Could not update user status.");
  }
}

async function handleLoadEnrollments(userId) {
  try {
    const data = await fetchJson(`/api/v1/admin/users/${userId}/enrollments`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    renderEnrollmentDetails(data);
    setAdminMessage(`Loaded enrollments for user ${userId}.`, true);
  } catch (error) {
    setAdminMessage(error.message || "Could not load enrollment details.");
  }
}

function handleUsersListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const userId = Number(button.dataset.id);

  if (!userId) {
    return;
  }

  if (action === "set-status") {
    handleSetUserStatus(userId, button.dataset.status);
    return;
  }

  if (action === "enrollments") {
    handleLoadEnrollments(userId);
  }
}

function logout() {
  state.token = "";
  state.user = null;
  state.users = [];
  localStorage.removeItem("innopapp_auth_token");
  usersList.innerHTML = "";
  enrollmentDetailsList.innerHTML = "";
  resetQualificationForm();
  announcementForm.reset();
  announcementTargetRoleInput.value = "User";
  updateAdminVisibility();
  setAdminMessage("Signed out.", true);
}

async function initialize() {
  if (isRedirectingToCanonicalHost) {
    return;
  }

  refreshPublicButton.addEventListener("click", () => {
    loadQualifications().catch((error) => {
      setAdminMessage(error.message || "Failed loading qualifications.");
    });
  });

  loginForm.addEventListener("submit", handleLogin);
  qualificationForm.addEventListener("submit", handleCreateQualification);
  announcementForm.addEventListener("submit", handleCreateAnnouncement);
  clearQualificationButton.addEventListener("click", resetQualificationForm);
  usersList.addEventListener("click", handleUsersListClick);
  logoutButton.addEventListener("click", logout);

  updateAdminVisibility();

  try {
    await fetchJson("/health");
    setHealthStatus(true, "API online and database reachable");
  } catch (error) {
    setHealthStatus(false, "API not reachable");
  }

  try {
    await loadQualifications();
  } catch (error) {
    publicPostsContainer.innerHTML = `<p>${escapeHtml(
      error.message || "Failed to load qualifications."
    )}</p>`;
  }

  if (!state.token) {
    return;
  }

  try {
    await loadAdminUsers();
    setAdminMessage("Admin session restored.", true);
    updateAdminVisibility();
  } catch (error) {
    logout();
    setAdminMessage("Stored session expired. Please sign in again.");
  }
}

initialize();
