document.addEventListener("DOMContentLoaded", function () {
  setupBulkRegistration();
  setupBulkExport();
  setupUserDetailModal();

  // Add bulk registration button
  const bulkRegBtn = document.createElement("button");
  bulkRegBtn.className = "btn btn-primary ms-2";
  bulkRegBtn.innerHTML = '<i class="bi bi-upload"></i> Bulk Register';
  bulkRegBtn.setAttribute("data-bs-toggle", "modal");
  bulkRegBtn.setAttribute("data-bs-target", "#bulkRegistrationModal");

  const userActions = document.querySelector("#users-view h2").parentElement;
  userActions.appendChild(bulkRegBtn);

  // View management
  const views = document.querySelectorAll("[data-view]");
  views.forEach((view) => {
    view.addEventListener("click", function (e) {
      e.preventDefault();
      document
        .querySelectorAll(".view")
        .forEach((v) => (v.style.display = "none"));
      document.getElementById(`${this.dataset.view}-view`).style.display =
        "block";

      // Update active nav link
      document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.remove("active");
      });
      this.classList.add("active");

      // Update topbar title
      const titleMap = {
        dashboard: "Dashboard Overview",
        users: "User Management",
        attendance: "Attendance Records",
        biotime: "BioTime Configuration",
      };

      if (titleMap[this.dataset.view]) {
        document.querySelector(".topbar-title").textContent =
          titleMap[this.dataset.view];
      }

      // Load data for the view
      switch (this.dataset.view) {
        case "users":
          loadUsers();
          break;
        case "attendance":
          loadAttendance();
          break;
        case "biotime":
          loadBioTimeConfig();
          break;
        case "dashboard":
          loadDashboard();
          break;
      }
    });
  });

  // Show dashboard by default
  document.querySelector('[data-view="dashboard"]').click();

  // Sidebar toggle for mobile
  document
    .getElementById("sidebarToggle")
    .addEventListener("click", function () {
      document.getElementById("sidebar").classList.toggle("show");
    });

  // Process attendance button - now in topbar
  document
    .querySelector(".btn-secondary")
    .addEventListener("click", processAttendance);

  // User form handling
  document.getElementById("role").addEventListener("change", function () {
    document.getElementById("parent-phone-group").style.display =
      this.value === "student" ? "block" : "none";
  });

  document.getElementById("save-user").addEventListener("click", saveUser);

  // BioTime form handling
  document
    .getElementById("biotime-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveBioTimeConfig();
    });

  document
    .getElementById("test-connection")
    .addEventListener("click", testBioTimeConnection);

  // Attendance filter
  document
    .getElementById("filter-attendance")
    .addEventListener("click", loadAttendance);
});

// Load dashboard data
async function loadDashboard() {
  try {
    const today = dayjs().format("YYYY-MM-DD");

    // Get today's attendance summary
    const response = await fetch(
      `/api/attendance?start_date=${today}&end_date=${today}`
    );
    const attendance = await response.json();

    // Count present, absent and late
    const present = attendance.filter((a) => a.status === "present").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const late = attendance.filter((a) => a.status === "late").length;

    document.getElementById("present-count").textContent = present;
    document.getElementById("absent-count").textContent = absent;
    document.getElementById("late-count").textContent = late;

    // Get recent activity
    const recentResponse = await fetch("/api/attendance?_limit=4");
    const recentActivity = await recentResponse.json();

    const activityList = document.querySelector(".activity-list");
    activityList.innerHTML = "";

    recentActivity.forEach((activity) => {
      const item = document.createElement("li");
      item.className = "activity-item";

      let iconClass = "";
      let badgeClass = "";
      let badgeText = "";

      if (activity.status === "present") {
        iconClass = "present";
        badgeClass = "badge-present";
        badgeText = "On Time";
      } else if (activity.status === "late") {
        iconClass = "late";
        badgeClass = "badge-late";
        badgeText = "Late";
      } else {
        iconClass = "absent";
        badgeClass = "badge-absent";
        badgeText = "Absent";
      }

      const checkOutTime = activity.check_out
        ? dayjs(activity.check_out).format("HH:mm")
        : "Not checked out";

      item.innerHTML = `
        <div class="activity-content">
          <div class="activity-icon ${iconClass}">
            <i class="bi bi-person"></i>
          </div>
          <div class="activity-details">
            <div class="activity-title">${activity.user_name}</div>
            <div class="activity-time">${dayjs(activity.check_in).format(
              "HH:mm"
            )} - ${checkOutTime}</div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
      activityList.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    showAlert("Error loading dashboard data", "danger");
  }
}

// Load users data
async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    const users = await response.json();

    const tbody = document.querySelector("#users-table tbody");
    tbody.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar bg-primary me-3">
              ${user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h6 class="mb-0">${user.name}</h6>
              <small class="text-muted">#EMP-${user.id
                .toString()
                .padStart(3, "0")}</small>
            </div>
          </div>
        </td>
        <td>${user.email}</td>
        <td><span class="badge ${
          user.role === "admin"
            ? "badge-primary"
            : user.role === "teacher"
            ? "bg-info bg-opacity-10 text-info"
            : "bg-warning bg-opacity-10 text-warning"
        }">${user.role}</span></td>
        <td><span class="badge ${
          user.status === "active"
            ? "bg-success bg-opacity-10 text-success"
            : "bg-secondary bg-opacity-10 text-secondary"
        }">${user.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1 edit-user" data-id="${
            user.id
          }">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-user" data-id="${
            user.id
          }">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Add event listeners to edit and delete buttons
    document.querySelectorAll(".edit-user").forEach((btn) => {
      btn.addEventListener("click", function () {
        editUser(this.dataset.id);
      });
    });

    document.querySelectorAll(".delete-user").forEach((btn) => {
      btn.addEventListener("click", function () {
        deleteUser(this.dataset.id);
      });
    });
  } catch (error) {
    console.error("Error loading users:", error);
    showAlert("Error loading users", "danger");
  }
}

// Load attendance data
async function loadAttendance() {
  try {
    const startDate =
      document.getElementById("start-date").value ||
      dayjs().subtract(7, "day").format("YYYY-MM-DD");
    const endDate =
      document.getElementById("end-date").value || dayjs().format("YYYY-MM-DD");

    document.getElementById("start-date").value = startDate;
    document.getElementById("end-date").value = endDate;

    const response = await fetch(
      `/api/attendance?start_date=${startDate}&end_date=${endDate}`
    );
    const attendance = await response.json();

    const tbody = document.querySelector("#attendance-table tbody");
    tbody.innerHTML = "";

    attendance.forEach((record) => {
      const row = document.createElement("tr");

      let badgeClass = "";
      if (record.status === "present") {
        badgeClass = "badge-present";
      } else if (record.status === "late") {
        badgeClass = "badge-late";
      } else {
        badgeClass = "badge-absent";
      }

      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar bg-primary me-3">
              ${record.user_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h6 class="mb-0">${record.user_name}</h6>
              <small class="text-muted">${record.user_role}</small>
            </div>
          </div>
        </td>
        <td>${dayjs(record.check_in).format("MMM D, YYYY")}</td>
        <td>${dayjs(record.check_in).format("HH:mm A")}</td>
        <td>${
          record.check_out ? dayjs(record.check_out).format("HH:mm A") : "-"
        }</td>
        <td>${record.duration || "-"}</td>
        <td><span class="badge ${badgeClass}">${record.status}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading attendance:", error);
    showAlert("Error loading attendance records", "danger");
  }
}

// Load BioTime configuration
async function loadBioTimeConfig() {
  try {
    const response = await fetch("/api/biotime/config");
    const config = await response.json();

    if (config.ip_address) {
      document.getElementById("ip-address").value = config.ip_address;
      document.getElementById("port").value = config.port || "";
      document.getElementById("username").value = config.username;
      document.getElementById("password").value = config.password;
    }
  } catch (error) {
    console.error("Error loading BioTime config:", error);
    showAlert("Error loading BioTime configuration", "danger");
  }
}

// Process attendance from BioTime
async function processAttendance() {
  try {
    showAlert("Processing attendance data...", "info");

    const response = await fetch("/api/biotime/process", {
      method: "POST",
    });

    const result = await response.json();

    if (result.error) {
      showAlert(result.error, "danger");
    } else if (result.message) {
      showAlert(result.message, "success");
      loadDashboard();
    } else {
      showAlert(
        `Successfully processed ${result.processed} attendance records`,
        "success"
      );
      loadDashboard();
    }
  } catch (error) {
    console.error("Error processing attendance:", error);
    showAlert("Error processing attendance", "danger");
  }
}

// Save user
async function saveUser() {
  try {
    const userId = document.getElementById("user-id").value;
    const url = userId ? `/api/users/${userId}` : "/api/users";
    const method = userId ? "PUT" : "POST";

    const user = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      role: document.getElementById("role").value,
      parent_phone: document.getElementById("parent-phone").value || null,
      card_number: document.getElementById("card-number").value,
      status: "active",
    };

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    const result = await response.json();

    if (result.error) {
      showAlert(result.error, "danger");
    } else {
      showAlert(`User ${userId ? "updated" : "added"} successfully`, "success");
      bootstrap.Modal.getInstance(document.getElementById("userModal")).hide();
      loadUsers();
      clearUserForm();
    }
  } catch (error) {
    console.error("Error saving user:", error);
    showAlert("Error saving user", "danger");
  }
}

// Edit user
async function editUser(userId) {
  document.querySelector("#users-table").removeEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    const userId = row.querySelector(".edit-user").dataset.id;
    showUserDetails(userId);
  });
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Server responded with ${response.status}: ${error}`);
    }

    const user = await response.json();

    document.getElementById("user-id").value = user.id;
    document.getElementById("name").value = user.name;
    document.getElementById("email").value = user.email;
    document.getElementById("phone").value = user.phone || "";
    document.getElementById("role").value = user.role;
    document.getElementById("parent-phone").value = user.parent_phone || "";
    document.getElementById("card-number").value = user.card_number;

    document.getElementById("parent-phone-group").style.display =
      user.role === "student" ? "block" : "none";

    document.getElementById("modalTitle").textContent = "Edit User";

    const modal = new bootstrap.Modal(document.getElementById("userModal"));
    modal.show();
  } catch (error) {
    console.error("Error editing user:", error);
    showAlert(`Error loading user: ${error.message}`, "danger");
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.error) {
      showAlert(result.error, "danger");
    } else {
      showAlert("User deleted successfully", "success");
      loadUsers();
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    showAlert("Error deleting user", "danger");
  }
}

// Save BioTime configuration
async function saveBioTimeConfig() {
  try {
    const config = {
      ip_address: document.getElementById("ip-address").value,
      port: document.getElementById("port").value,
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
    };

    const response = await fetch("/api/biotime/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (result.error) {
      showAlert(result.error, "danger");
    } else {
      showAlert("BioTime configuration saved successfully", "success");
    }
  } catch (error) {
    console.error("Error saving BioTime config:", error);
    showAlert("Error saving BioTime configuration", "danger");
  }
}

// Test BioTime connection
async function testBioTimeConnection() {
  try {
    const config = {
      ip_address: document.getElementById("ip-address").value,
      port: document.getElementById("port").value,
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
    };

    if (!config.ip_address || !config.username || !config.password) {
      showAlert("Please fill in all configuration fields", "warning");
      return;
    }

    showAlert("Testing connection to BioTime device...", "info");

    const response = await fetch("/api/biotime/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (result.error) {
      showAlert(`Connection failed: ${result.error}`, "danger");
    } else {
      showAlert("Successfully connected to BioTime device", "success");
    }
  } catch (error) {
    console.error("Error testing BioTime connection:", error);
    showAlert("Error testing BioTime connection", "danger");
  }
}

// Bulk Registration Modal and Handler
function setupBulkRegistration() {
  const modal = `
    <div class="modal fade" id="bulkRegistrationModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bulk User Registration</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Upload CSV file with columns: name,email,phone,role,parent_phone,card_number</p>
            <input type="file" id="bulkUsersFile" class="form-control" accept=".csv">
            <div class="mt-3">
              <a href="/sample_users.csv" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-download"></i> Download Sample CSV
              </a>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="processBulkUpload">Process</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modal);

  document
    .getElementById("processBulkUpload")
    .addEventListener("click", async () => {
      const fileInput = document.getElementById("bulkUsersFile");
      if (!fileInput.files.length) {
        showAlert("Please select a file", "warning");
        return;
      }

      try {
        const file = fileInput.files[0];
        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim());
        const headers = lines[0].split(",").map((h) => h.trim());

        const users = lines.slice(1).map((line) => {
          const values = line.split(",");
          return headers.reduce((obj, header, i) => {
            obj[header] = values[i] ? values[i].trim() : "";
            return obj;
          }, {});
        });

        const response = await fetch("/api/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(users),
        });

        const result = await response.json();
        if (response.ok) {
          showAlert(result.message, "success");
          loadUsers();
          bootstrap.Modal.getInstance(
            document.getElementById("bulkRegistrationModal")
          ).hide();
        } else {
          throw new Error(result.error || "Failed to process bulk upload");
        }
      } catch (error) {
        console.error("Bulk upload error:", error);
        showAlert(error.message, "danger");
      }
    });
}

// Bulk Export Button
function setupBulkExport() {
  const exportBtn = document.createElement("button");
  exportBtn.className = "btn btn-success ms-2";
  exportBtn.innerHTML = '<i class="bi bi-download"></i> Export All';
  exportBtn.addEventListener("click", exportAllUsers);

  const userActions = document.querySelector("#users-view h2").parentElement;
  userActions.appendChild(exportBtn);
}

async function exportAllUsers() {
  try {
    const response = await fetch("/api/users/export/csv");
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export error:", error);
    showAlert(error.message, "danger");
  }
}

// User Detail Modal
function setupUserDetailModal() {
  // Add click handler to user rows
  document.querySelector("#users-table").addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    const userId = row.querySelector(".edit-user").dataset.id;
    showUserDetails(userId);
  });
}

async function showUserDetails(userId) {
  try {
    // Get user info
    const [userResponse, attendanceResponse] = await Promise.all([
      fetch(`/api/users/${userId}`),
      fetch(`/api/attendance?user_id=${userId}&_limit=10`),
    ]);

    if (!userResponse.ok || !attendanceResponse.ok) {
      throw new Error("Failed to load user data");
    }

    const user = await userResponse.json();
    const attendance = await attendanceResponse.json();

    // Populate user info
    document.getElementById("detail-user-name").textContent = user.name;
    document.getElementById(
      "detail-user-role"
    ).textContent = `Role: ${user.role}`;
    document.getElementById(
      "detail-user-email"
    ).textContent = `Email: ${user.email}`;
    document.getElementById("detail-user-phone").textContent = `Phone: ${
      user.phone || "N/A"
    }`;

    // Calculate stats
    const presentCount = attendance.filter(
      (a) => a.status === "present"
    ).length;
    const lateCount = attendance.filter((a) => a.status === "late").length;
    const absentCount = attendance.length - presentCount - lateCount;

    document.getElementById("total-present").textContent = presentCount;
    document.getElementById("total-late").textContent = lateCount;
    document.getElementById("total-absent").textContent = absentCount;

    // Populate recent attendance
    const attendanceTbody = document.getElementById("user-attendance-details");
    attendanceTbody.innerHTML = "";

    attendance.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${dayjs(record.check_in).format("YYYY-MM-DD")}</td>
        <td>${dayjs(record.check_in).format("HH:mm")}</td>
        <td>${
          record.check_out ? dayjs(record.check_out).format("HH:mm") : "-"
        }</td>
        <td><span class="badge bg-${
          record.status === "present"
            ? "success"
            : record.status === "late"
            ? "warning"
            : "danger"
        }">${record.status}</span></td>
      `;
      attendanceTbody.appendChild(row);
    });

    // Show current week attendance
    showCurrentWeekAttendance(userId);

    // Set up export button
    document.getElementById("export-user-data").onclick = () =>
      exportUserData(userId);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("userDetailModal")
    );
    modal.show();
  } catch (error) {
    console.error("Error showing user details:", error);
    showAlert("Error loading user details", "danger");
  }
}

async function showCurrentWeekAttendance(userId) {
  try {
    // Get current week dates (Monday to Friday)
    const today = dayjs();
    const monday = today.startOf("week").add(1, "day"); // Monday
    const friday = today.startOf("week").add(5, "day"); // Friday

    const response = await fetch(
      `/api/attendance?user_id=${userId}&start_date=${monday.format(
        "YYYY-MM-DD"
      )}&end_date=${friday.format("YYYY-MM-DD")}`
    );

    if (!response.ok) throw new Error("Failed to load week attendance");

    const weekAttendance = await response.json();

    // Create week days array
    const weekDays = [];
    for (let i = 1; i <= 5; i++) {
      weekDays.push(monday.add(i - 1, "day"));
    }

    // Populate week attendance
    const weekRow = document.getElementById("week-attendance");
    weekRow.innerHTML = "";

    weekDays.forEach((day) => {
      const cell = document.createElement("td");
      const dateStr = day.format("YYYY-MM-DD");
      const attendance = weekAttendance.find((a) =>
        a.check_in.startsWith(dateStr)
      );

      if (attendance) {
        cell.innerHTML = `
          <div>${day.format("ddd")}</div>
          <div class="text-${
            attendance.status === "present" ? "success" : "warning"
          }">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <small>${dayjs(attendance.check_in).format("HH:mm")}</small>
        `;
      } else {
        cell.innerHTML = `
          <div>${day.format("ddd")}</div>
          <div class="text-danger">
            <i class="bi bi-x-circle-fill"></i>
          </div>
          <small>Absent</small>
        `;
      }

      weekRow.appendChild(cell);
    });
  } catch (error) {
    console.error("Error loading week attendance:", error);
  }
}

async function exportUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}/export`);
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_${userId}_attendance.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export error:", error);
    showAlert(error.message, "danger");
  }
}

// Show alert message
function showAlert(message, type) {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
  alertDiv.style.zIndex = "1000";
  alertDiv.role = "alert";
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi ${
        type === "danger"
          ? "bi-exclamation-triangle"
          : type === "success"
          ? "bi-check-circle"
          : "bi-info-circle"
      } me-2"></i>
      <div>${message}</div>
      <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  document.body.appendChild(alertDiv);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alertDiv);
    bsAlert.close();
  }, 5000);
}

//function to clear fields
function clearUserForm() {
  document.getElementById("user-form").reset(); // Resets all form elements

  // Explicitly clear/show/hide things as needed
  document.getElementById("parent-phone-group").style.display = "none";

  // Optional: Clear hidden fields if used for edit context
  const userIdField = document.getElementById("user-id");
  if (userIdField) userIdField.value = "";
}
