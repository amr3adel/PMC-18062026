(function () {
  const priorityColors = {
    low: "#6B7280",
    medium: "#2563EB",
    high: "#D97706",
    urgent: "#DC2626",
  };

  const viewRoot = document.getElementById("view-root");
  const themeToggle = document.getElementById("theme-toggle");
  const viewButtons = document.querySelectorAll(".view-button");
  const toast = document.getElementById("toast");

  let state = TaskStorage.load();
  let activeView = "kanban";
  let undoTimer = null;
  let lastDeleted = null;

  const modal = TaskModal.createTaskModal({
    getActiveProfile,
    onSave: saveTask,
    onBulkSave: saveTasks,
    onDelete: deleteTask,
  });

  const profiles = ProfilesView.createProfiles({
    getState: () => state,
    getActiveProfile,
    onSwitch(profileId) {
      state.activeProfileId = profileId;
      commit();
    },
    onCreate(profile) {
      state.profiles.push(profile);
      state.activeProfileId = profile.id;
      commit();
    },
    onUpdate(profileId, patch) {
      state.profiles = state.profiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile));
      commit();
    },
    onDelete(profileId) {
      state.tasks = state.tasks.filter((task) => task.profileId !== profileId);
      state.profiles = state.profiles.filter((profile) => profile.id !== profileId);
      state.activeProfileId = state.profiles[0].id;
      commit();
    },
  });

  function init() {
    applyTheme(TaskStorage.loadTheme());
    bindChrome();
    commit(false);
  }

  function bindChrome() {
    viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.view;
        render();
      });
    });

    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "";
      const next = current === "dark" ? "light" : current === "light" ? "" : "dark";
      applyTheme(next);
      TaskStorage.saveTheme(next);
    });
  }

  function applyTheme(theme) {
    if (theme) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    themeToggle.textContent = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto";
  }

  function getActiveProfile() {
    return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
  }

  function getProfileTasks() {
    const profile = getActiveProfile();
    return state.tasks.filter((task) => task.profileId === profile.id);
  }

  function saveTask(task) {
    const exists = state.tasks.some((current) => current.id === task.id);
    state.tasks = exists ? state.tasks.map((current) => (current.id === task.id ? task : current)) : [...state.tasks, task];
    commit();
  }

  function saveTasks(tasks) {
    if (!tasks.length) return;
    state.tasks = [...state.tasks, ...tasks];
    commit();
  }

  function updateTask(taskId, patch) {
    state.tasks = state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            ...patch,
            updatedAt: TaskStorage.nowIso(),
          }
        : task
    );
    commit();
  }

  function deleteTask(taskId) {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    lastDeleted = task;
    state.tasks = state.tasks.filter((candidate) => candidate.id !== taskId);
    commit();
    showUndoToast(task);
  }

  function showUndoToast(task) {
    window.clearTimeout(undoTimer);
    toast.innerHTML = `
      <span>Deleted "${ProfilesView.escapeHtml(task.title)}"</span>
      <button type="button">Undo</button>
    `;
    toast.classList.remove("hidden");
    toast.querySelector("button").addEventListener("click", () => {
      if (lastDeleted) {
        state.tasks.push(lastDeleted);
        lastDeleted = null;
        window.clearTimeout(undoTimer);
        toast.classList.add("hidden");
        commit();
      }
    });
    undoTimer = window.setTimeout(() => {
      lastDeleted = null;
      toast.classList.add("hidden");
    }, 3000);
  }

  function openTask(taskId) {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (task) modal.open(task);
  }

  function createTask(defaults) {
    modal.open(null, defaults || {});
  }

  function priorityColor(priority) {
    return priorityColors[priority] || priorityColors.medium;
  }

  function commit(save = true) {
    if (save) TaskStorage.save(state);
    render();
  }

  function render() {
    const profile = getActiveProfile();
    document.documentElement.style.setProperty("--accent", profile.color);
    profiles.render();
    viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));

    const context = {
      profile,
      tasks: getProfileTasks(),
      openTask,
      createTask,
      updateTask,
      priorityColor,
    };

    if (activeView === "calendar") {
      CalendarView.render(viewRoot, context);
    } else if (activeView === "weekly") {
      WeeklyView.render(viewRoot, context);
    } else {
      KanbanView.render(viewRoot, context);
    }
  }

  init();
})();
