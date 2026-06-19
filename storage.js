(function () {
  const STORAGE_KEY = "taskmanager_data";
  const THEME_KEY = "taskmanager_theme";

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function startOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay() || 7;
    copy.setDate(copy.getDate() - day + 1);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function toDateInput(date) {
    const copy = new Date(date);
    const year = copy.getFullYear();
    const month = String(copy.getMonth() + 1).padStart(2, "0");
    const day = String(copy.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value, options) {
    const date = parseDateOnly(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(undefined, options || { month: "short", day: "numeric" }).format(date);
  }

  function formatMinutes(minutes) {
    if (!minutes && minutes !== 0) return "";
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  function makeDefaultData() {
    const profileId = uuid();
    return {
      profiles: [
        {
          id: profileId,
          name: "Personal",
          color: "#4F46E5",
          createdAt: nowIso(),
        },
      ],
      tasks: [],
      activeProfileId: profileId,
    };
  }

  function normalizeData(data) {
    if (!data || !Array.isArray(data.profiles)) return makeDefaultData();
    if (data.profiles.length === 0) return makeDefaultData();

    const profileIds = new Set(data.profiles.map((profile) => profile.id));
    const activeProfileId = profileIds.has(data.activeProfileId) ? data.activeProfileId : data.profiles[0].id;

    return {
      profiles: data.profiles.map((profile) => ({
        id: profile.id || uuid(),
        name: profile.name || "Untitled",
        color: profile.color || "#4F46E5",
        createdAt: profile.createdAt || nowIso(),
      })),
      tasks: Array.isArray(data.tasks)
        ? data.tasks
            .filter((task) => profileIds.has(task.profileId))
            .map((task) => ({
              id: task.id || uuid(),
              profileId: task.profileId,
              title: task.title || "Untitled task",
              description: task.description || "",
              status: ["backlog", "todo", "in_progress", "done"].includes(task.status) ? task.status : "backlog",
              priority: ["low", "medium", "high", "urgent"].includes(task.priority) ? task.priority : "medium",
              dueDate: task.dueDate || null,
              estimatedDuration: Number.isFinite(Number(task.estimatedDuration)) ? Number(task.estimatedDuration) : null,
              actualLoggedMinutes: Number.isFinite(Number(task.actualLoggedMinutes)) ? Number(task.actualLoggedMinutes) : 0,
              tags: Array.isArray(task.tags) ? task.tags : [],
              scheduledDate: task.scheduledDate || null,
              scheduledTime: task.scheduledTime || null,
              recurrence: ["none", "daily", "weekly", "monthly"].includes(task.recurrence) ? task.recurrence : "none",
              archivedAt: task.archivedAt || null,
              createdAt: task.createdAt || nowIso(),
              updatedAt: task.updatedAt || nowIso(),
            }))
        : [],
      activeProfileId,
    };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : makeDefaultData();
      const normalized = normalizeData(data);
      save(normalized);
      return normalized;
    } catch (error) {
      console.warn("Could not load task manager data. Resetting store.", error);
      const data = makeDefaultData();
      save(data);
      return data;
    }
  }

  function save(data) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadTheme() {
    return window.localStorage.getItem(THEME_KEY) || "";
  }

  function saveTheme(theme) {
    if (!theme) {
      window.localStorage.removeItem(THEME_KEY);
      return;
    }
    window.localStorage.setItem(THEME_KEY, theme);
  }

  window.TaskStorage = {
    STORAGE_KEY,
    addDays,
    formatDate,
    formatMinutes,
    load,
    loadTheme,
    nowIso,
    parseDateOnly,
    save,
    saveTheme,
    startOfWeek,
    todayIso,
    toDateInput,
    uuid,
  };
})();
