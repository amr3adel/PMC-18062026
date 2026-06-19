(function () {
  const priorityColors = {
    low: "#6B7280",
    medium: "#2563EB",
    high: "#D97706",
    urgent: "#DC2626",
  };
  const statusLabels = {
    backlog: "Backlog",
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  const analyticsRoot = document.getElementById("analytics-root");
  const viewRoot = document.getElementById("view-root");
  const globalSearch = document.getElementById("global-search");
  const themeToggle = document.getElementById("theme-toggle");
  const viewButtons = document.querySelectorAll(".view-button");
  const toast = document.getElementById("toast");

  let state = TaskStorage.load();
  let activeView = "kanban";
  let searchQuery = "";
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
        setActiveView(button.dataset.view);
      });
    });

    globalSearch.addEventListener("input", () => {
      searchQuery = globalSearch.value.trim();
      render();
      globalSearch.focus();
    });

    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "";
      const next = current === "dark" ? "light" : current === "light" ? "" : "dark";
      applyTheme(next);
      TaskStorage.saveTheme(next);
    });

    document.addEventListener("keydown", (event) => {
      if (isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        createTask({ status: "backlog" });
      } else if (event.key === "/") {
        event.preventDefault();
        globalSearch.focus();
      } else if (event.key === "1") {
        event.preventDefault();
        setActiveView("kanban");
      } else if (event.key === "2") {
        event.preventDefault();
        setActiveView("calendar");
      } else if (event.key === "3") {
        event.preventDefault();
        setActiveView("weekly");
      }
    });
  }

  function isEditableTarget(target) {
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
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

  function getVisibleTasks(tasks) {
    const query = searchQuery.toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => {
      const haystack = [task.title, task.description, task.priority, statusLabels[task.status], ...(task.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
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

  function setActiveView(view) {
    activeView = view;
    render();
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
    const profileTasks = getProfileTasks();
    const visibleTasks = getVisibleTasks(profileTasks);
    document.documentElement.style.setProperty("--accent", profile.color);
    profiles.render();
    viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
    renderAnalytics(profileTasks);

    const context = {
      profile,
      tasks: visibleTasks,
      allTasks: profileTasks,
      searchQuery,
      openTask,
      createTask,
      updateTask,
      priorityColor,
      statusLabels,
    };

    if (activeView === "calendar") {
      CalendarView.render(viewRoot, context);
    } else if (activeView === "weekly") {
      WeeklyView.render(viewRoot, context);
    } else {
      KanbanView.render(viewRoot, context);
    }
  }

  function renderAnalytics(tasks) {
    const today = TaskStorage.todayIso();
    const weekStart = TaskStorage.toDateInput(TaskStorage.startOfWeek(new Date()));
    const weekEnd = TaskStorage.toDateInput(TaskStorage.addDays(TaskStorage.startOfWeek(new Date()), 6));
    const overdue = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "done").length;
    const doneThisWeek = tasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) >= weekStart && task.updatedAt.slice(0, 10) <= weekEnd).length;
    const scheduledMinutes = tasks
      .filter((task) => task.scheduledDate && task.scheduledDate >= weekStart && task.scheduledDate <= weekEnd)
      .reduce((sum, task) => sum + (task.estimatedDuration || 30), 0);
    const urgentOpen = tasks.filter((task) => task.priority === "urgent" && task.status !== "done").length;

    analyticsRoot.innerHTML = `
      <article class="metric-card">
        <span>Overdue</span>
        <strong>${overdue}</strong>
      </article>
      <article class="metric-card">
        <span>Done this week</span>
        <strong>${doneThisWeek}</strong>
      </article>
      <article class="metric-card">
        <span>Scheduled hours</span>
        <strong>${formatHours(scheduledMinutes)}</strong>
      </article>
      <article class="metric-card">
        <span>Open urgent</span>
        <strong>${urgentOpen}</strong>
      </article>
    `;
  }

  function formatHours(minutes) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }

  init();
})();
