(function () {
  const defaultColors = ["#4F46E5", "#0F766E", "#D97706", "#C2410C", "#7C3AED", "#2563EB"];

  function normalizeHex(value, fallback) {
    if (/^#[0-9a-f]{6}$/i.test(value || "")) return value;
    return fallback || defaultColors[0];
  }

  function createProfiles(options) {
    const tabs = document.getElementById("profile-tabs");
    const addButton = document.getElementById("add-profile-btn");
    const renameButton = document.getElementById("rename-profile-btn");
    const deleteButton = document.getElementById("delete-profile-btn");

    function render() {
      const state = options.getState();
      tabs.innerHTML = "";
      state.profiles.forEach((profile) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `profile-tab${profile.id === state.activeProfileId ? " active" : ""}`;
        button.dataset.profileId = profile.id;
        button.innerHTML = `<span class="profile-dot" style="background:${profile.color}"></span><span>${escapeHtml(profile.name)}</span>`;
        button.addEventListener("click", () => options.onSwitch(profile.id));
        tabs.appendChild(button);
      });
    }

    addButton.addEventListener("click", () => {
      const name = window.prompt("Profile name", "New profile");
      if (!name || !name.trim()) return;
      const color = window.prompt("Accent color (hex)", defaultColors[options.getState().profiles.length % defaultColors.length]);
      options.onCreate({
        id: TaskStorage.uuid(),
        name: name.trim(),
        color: normalizeHex(color, defaultColors[0]),
        createdAt: TaskStorage.nowIso(),
      });
    });

    renameButton.addEventListener("click", () => {
      const profile = options.getActiveProfile();
      const name = window.prompt("Profile name", profile.name);
      if (!name || !name.trim()) return;
      const color = window.prompt("Accent color (hex)", profile.color);
      options.onUpdate(profile.id, {
        name: name.trim(),
        color: normalizeHex(color, profile.color),
      });
    });

    deleteButton.addEventListener("click", () => {
      const state = options.getState();
      const profile = options.getActiveProfile();
      if (state.profiles.length <= 1) {
        window.alert("Keep at least one profile.");
        return;
      }
      const count = state.tasks.filter((task) => task.profileId === profile.id).length;
      if (window.confirm(`Delete "${profile.name}" and ${count} task${count === 1 ? "" : "s"}?`)) {
        options.onDelete(profile.id);
      }
    });

    return { render };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.ProfilesView = {
    createProfiles,
    escapeHtml,
  };
})();
