class SearchManager {
  constructor() {
    this.initSearchHandlers();
    this.initAdvancedSearchModal();
  }

  initSearchHandlers() {
    const searchInput = document.getElementById("globalSearch");
    searchInput.addEventListener(
      "input",
      this.debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) return;

        const results = await this.performSearch(query);
        this.displaySearchResults(results);
      }, 300)
    );
  }

  initAdvancedSearchModal() {
    document
      .getElementById("advancedSearchBtn")
      .addEventListener("click", () => {
        const modal = new bootstrap.Modal("#advancedSearchModal");
        modal.show();
      });

    document
      .getElementById("advancedSearchForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const filters = Object.fromEntries(formData.entries());

        const results = await fetch("/api/search/advanced", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters),
        }).then((res) => res.json());

        this.displaySearchResults(results, true);
      });
  }

  async performSearch(query) {
    const currentView = document.querySelector(
      '.view[style*="display: block"]'
    ).id;

    if (currentView.includes("users")) {
      return await fetch(
        `/api/search/users?q=${encodeURIComponent(query)}`
      ).then((res) => res.json());
    } else {
      return await fetch(
        `/api/search/attendance?q=${encodeURIComponent(query)}`
      ).then((res) => res.json());
    }
  }

  displaySearchResults(results, isAdvanced = false) {
    const resultsContainer = document.getElementById("searchResults");
    resultsContainer.innerHTML = "";

    if (results.length === 0) {
      resultsContainer.innerHTML =
        '<div class="alert alert-info">No results found</div>';
      return;
    }

    if (
      isAdvanced ||
      document.getElementById("attendance-view").style.display === "block"
    ) {
      resultsContainer.innerHTML = this.renderAttendanceResults(results);
    } else {
      resultsContainer.innerHTML = this.renderUserResults(results);
    }
  }

  renderUserResults(users) {
    return `
      <div class="list-group">
        ${users
          .map(
            (user) => `
          <a href="#" class="list-group-item list-group-item-action" 
             onclick="showUserDetails(${user.id})">
            <div class="d-flex w-100 justify-content-between">
              <h5 class="mb-1">${user.name}</h5>
              <small>${user.role}</small>
            </div>
            <p class="mb-1">${user.email}</p>
            <small>${user.attendance_count} attendance records</small>
          </a>
        `
          )
          .join("")}
      </div>
    `;
  }

  debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

// Initialize when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  window.searchManager = new SearchManager();
});
