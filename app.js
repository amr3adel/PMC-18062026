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
  const archiveButton = document.getElementById("archive-history-btn");
  const archiveModal = document.getElementById("archive-modal");
  const archiveClose = document.getElementById("archive-close");
  const archiveSearch = document.getElementById("archive-search");
  const archiveList = document.getElementById("archive-list");
  const pomodoroToggle = document.getElementById("pomodoro-toggle");
  const timerStatus = document.getElementById("timer-status");
  const viewButtons = document.querySelectorAll(".view-button");
  const toast = document.getElementById("toast");

  let state = TaskStorage.load();
  let activeView = "kanban";
  let searchQuery = "";
  let archiveQuery = "";
  let activeTimer = null;
  let timerInterval = null;
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

    archiveButton.addEventListener("click", openArchive);
    archiveClose.addEventListener("click", closeArchive);
    archiveModal.addEventListener("click", (event) => {
      if (event.target === archiveModal) closeArchive();
    });
    archiveSearch.addEventListener("input", () => {
      archiveQuery = archiveSearch.value.trim();
      renderArchive();
    });

    pomodoroToggle.addEventListener("click", () => {
      if (activeTimer && activeTimer.taskId === null) {
        stopTimer();
      } else {
        startTimer(null, "Pomodoro focus", "pomodoro");
      }
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

  function getActiveProfileTasks() {
    return getProfileTasks().filter((task) => !task.archivedAt);
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
    const previous = state.tasks.find((current) => current.id === task.id);
    const exists = Boolean(previous);
    state.tasks = exists ? state.tasks.map((current) => (current.id === task.id ? task : current)) : [...state.tasks, task];
    maybeSpawnRecurringTask(previous, task);
    commit();
  }

  function saveTasks(tasks) {
    if (!tasks.length) return;
    state.tasks = [...state.tasks, ...tasks];
    commit();
  }

  function updateTask(taskId, patch) {
    const previous = state.tasks.find((task) => task.id === taskId);
    let updatedTask = null;
    state.tasks = state.tasks.map((task) =>
      task.id === taskId
        ? (updatedTask = {
            ...task,
            ...patch,
            updatedAt: TaskStorage.nowIso(),
          })
        : task
    );
    maybeSpawnRecurringTask(previous, updatedTask);
    commit();
  }

  function archiveTask(taskId) {
    updateTask(taskId, { archivedAt: TaskStorage.nowIso() });
  }

  function archiveDoneTasks() {
    const profile = getActiveProfile();
    const now = TaskStorage.nowIso();
    state.tasks = state.tasks.map((task) =>
      task.profileId === profile.id && task.status === "done" && !task.archivedAt ? { ...task, archivedAt: now, updatedAt: now } : task
    );
    commit();
  }

  function restoreTask(taskId) {
    state.tasks = state.tasks.map((task) => (task.id === taskId ? { ...task, archivedAt: null, updatedAt: TaskStorage.nowIso() } : task));
    commit();
    renderArchive();
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

  function toggleTaskTimer(taskId) {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    if (activeTimer && activeTimer.taskId === taskId) {
      stopTimer();
    } else {
      startTimer(taskId, task.title, "task");
    }
  }

  function startTimer(taskId, label, mode) {
    stopTimer();
    activeTimer = {
      taskId,
      label,
      mode,
      startedAt: Date.now(),
      phase: mode === "pomodoro" ? "work" : "task",
      targetMinutes: mode === "pomodoro" ? 25 : null,
    };
    timerInterval = window.setInterval(updateTimerStatus, 1000);
    updateTimerStatus();
    render();
  }

  function stopTimer() {
    if (!activeTimer) return;
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - activeTimer.startedAt) / 60000));
    if (activeTimer.taskId) {
      const log = {
        startedAt: new Date(activeTimer.startedAt).toISOString(),
        durationMinutes: elapsedMinutes,
        type: elapsedMinutes >= 25 ? "pomodoro" : "focus",
      };
      state.tasks = state.tasks.map((task) =>
        task.id === activeTimer.taskId
          ? {
              ...task,
              timeLogs: [...(task.timeLogs || []), log],
              actualLoggedMinutes: (task.timeLogs || []).reduce((sum, entry) => sum + entry.durationMinutes, 0) + elapsedMinutes,
              updatedAt: TaskStorage.nowIso(),
            }
          : task
      );
      TaskStorage.save(state);
    }
    window.clearInterval(timerInterval);
    activeTimer = null;
    timerInterval = null;
    updateTimerStatus();
    render();
  }

  function updateTimerStatus() {
    if (!activeTimer) {
      timerStatus.textContent = "No timer";
      pomodoroToggle.textContent = "25";
      return;
    }
    const elapsedSeconds = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
    if (activeTimer.mode === "pomodoro" && activeTimer.targetMinutes && elapsedSeconds >= activeTimer.targetMinutes * 60) {
      if (activeTimer.phase === "work") {
        activeTimer.phase = "break";
        activeTimer.label = "Pomodoro break";
        activeTimer.startedAt = Date.now();
        activeTimer.targetMinutes = 5;
        timerStatus.textContent = "Pomodoro break: 5:00";
        return;
      }
      stopTimer();
      return;
    }
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    if (activeTimer.mode === "pomodoro") {
      const remainingSeconds = Math.max(0, activeTimer.targetMinutes * 60 - elapsedSeconds);
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingRemainder = String(remainingSeconds % 60).padStart(2, "0");
      timerStatus.textContent = `${activeTimer.label}: ${remainingMinutes}:${remainingRemainder}`;
    } else {
      timerStatus.textContent = `${activeTimer.label}: ${elapsedMinutes}:${seconds}`;
    }
    pomodoroToggle.textContent = "Stop";
  }

  function maybeSpawnRecurringTask(previous, updated) {
    if (!previous || !updated) return;
    if (previous.status === "done" || updated.status !== "done" || updated.recurrence === "none") return;
    const now = TaskStorage.nowIso();
    state.tasks.push({
      ...updated,
      id: TaskStorage.uuid(),
      status: "todo",
      dueDate: shiftDate(updated.dueDate, updated.recurrence),
      scheduledDate: shiftDate(updated.scheduledDate, updated.recurrence),
      archivedAt: null,
      actualLoggedMinutes: 0,
      timeLogs: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  function shiftDate(value, recurrence) {
    if (!value) return null;
    const date = TaskStorage.parseDateOnly(value);
    if (recurrence === "daily") date.setDate(date.getDate() + 1);
    if (recurrence === "weekly") date.setDate(date.getDate() + 7);
    if (recurrence === "monthly") date.setMonth(date.getMonth() + 1);
    return TaskStorage.toDateInput(date);
  }

  function openArchive() {
    archiveModal.classList.remove("hidden");
    renderArchive();
    archiveSearch.focus();
  }

  function closeArchive() {
    archiveModal.classList.add("hidden");
  }

  function renderArchive() {
    const query = archiveQuery.toLowerCase();
    const archived = getProfileTasks()
      .filter((task) => task.archivedAt)
      .filter((task) => !query || [task.title, task.description, ...(task.tags || [])].join(" ").toLowerCase().includes(query))
      .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));

    archiveList.innerHTML = archived.length
      ? archived
          .map(
            (task) => `
              <article class="archive-item">
                <div>
                  <h4>${ProfilesView.escapeHtml(task.title)}</h4>
                  <p>${task.archivedAt ? `Archived ${new Date(task.archivedAt).toLocaleDateString()}` : ""}</p>
                </div>
                <button class="button ghost" type="button" data-restore-task="${task.id}">Restore</button>
              </article>
            `
          )
          .join("")
      : `<p class="muted">No archived tasks found.</p>`;

    archiveList.querySelectorAll("[data-restore-task]").forEach((button) => {
      button.addEventListener("click", () => restoreTask(button.dataset.restoreTask));
    });
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
    const profileTasks = getActiveProfileTasks();
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
      activeTimer,
      archiveTask,
      archiveDoneTasks,
      toggleTaskTimer,
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
    const dailyLogs = getWeeklyLogTotals(tasks, weekStart);

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
      <article class="metric-card productivity-card">
        <span>Worked this week</span>
        <div class="productivity-bars">
          ${dailyLogs
            .map(
              (day) => `
                <div class="productivity-day">
                  <div class="productivity-bar-wrap"><div class="productivity-bar" style="height:${day.height}%"></div></div>
                  <small>${day.label}</small>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function getWeeklyLogTotals(tasks, weekStartIso) {
    const weekStart = TaskStorage.parseDateOnly(weekStartIso);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = TaskStorage.addDays(weekStart, index);
      return {
        iso: TaskStorage.toDateInput(date),
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).slice(0, 2),
        minutes: 0,
      };
    });
    tasks.forEach((task) => {
      (task.timeLogs || []).forEach((log) => {
        const iso = log.startedAt ? log.startedAt.slice(0, 10) : "";
        const day = days.find((candidate) => candidate.iso === iso);
        if (day) day.minutes += Number(log.durationMinutes) || 0;
      });
    });
    const maxMinutes = Math.max(60, ...days.map((day) => day.minutes));
    return days.map((day) => ({
      ...day,
      height: Math.max(4, Math.round((day.minutes / maxMinutes) * 100)),
    }));
  }

  function formatHours(minutes) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }

  init();
})();
