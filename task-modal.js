(function () {
  const priorityOrder = {
    low: 1,
    medium: 2,
    high: 3,
    urgent: 4,
  };

  function parseTags(value) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index);
  }

  function durationToFields(minutes) {
    if (!minutes) return { value: "", unit: "minutes" };
    if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
    return { value: minutes, unit: "minutes" };
  }

  function fieldsToDuration(value, unit) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return unit === "hours" ? Math.round(amount * 60) : Math.round(amount);
  }

  function createTaskModal(options) {
    const modal = document.getElementById("task-modal");
    const form = document.getElementById("task-form");
    const title = document.getElementById("task-modal-title");
    const deleteButton = document.getElementById("task-delete");

    const fields = {
      id: document.getElementById("task-id"),
      title: document.getElementById("task-title"),
      description: document.getElementById("task-description"),
      status: document.getElementById("task-status"),
      priority: document.getElementById("task-priority"),
      dueDate: document.getElementById("task-due-date"),
      duration: document.getElementById("task-duration"),
      durationUnit: document.getElementById("task-duration-unit"),
      tags: document.getElementById("task-tags"),
      scheduledDate: document.getElementById("task-scheduled-date"),
      scheduledTime: document.getElementById("task-scheduled-time"),
    };

    let mode = "create";
    let editingTask = null;
    let defaults = {};

    function close() {
      modal.classList.add("hidden");
      form.reset();
      editingTask = null;
      defaults = {};
    }

    function open(task, nextDefaults) {
      editingTask = task || null;
      defaults = nextDefaults || {};
      mode = editingTask ? "edit" : "create";
      title.textContent = editingTask ? "Edit task" : "New task";
      deleteButton.classList.toggle("hidden", !editingTask);

      const durationFields = durationToFields(editingTask ? editingTask.estimatedDuration : defaults.estimatedDuration);
      fields.id.value = editingTask ? editingTask.id : "";
      fields.title.value = editingTask ? editingTask.title : "";
      fields.description.value = editingTask ? editingTask.description || "" : "";
      fields.status.value = editingTask ? editingTask.status : defaults.status || "backlog";
      fields.priority.value = editingTask ? editingTask.priority : defaults.priority || "medium";
      fields.dueDate.value = editingTask ? editingTask.dueDate || "" : defaults.dueDate || "";
      fields.duration.value = durationFields.value;
      fields.durationUnit.value = durationFields.unit;
      fields.tags.value = editingTask ? (editingTask.tags || []).join(", ") : defaults.tags || "";
      fields.scheduledDate.value = editingTask ? editingTask.scheduledDate || "" : defaults.scheduledDate || "";
      fields.scheduledTime.value = editingTask ? editingTask.scheduledTime || "" : defaults.scheduledTime || "";

      modal.classList.remove("hidden");
      fields.title.focus();
    }

    function readTaskFromForm() {
      const now = TaskStorage.nowIso();
      const base = editingTask || {
        id: TaskStorage.uuid(),
        profileId: options.getActiveProfile().id,
        createdAt: now,
      };

      return {
        ...base,
        title: fields.title.value.trim(),
        description: fields.description.value.trim(),
        status: fields.status.value,
        priority: fields.priority.value,
        dueDate: fields.dueDate.value || null,
        estimatedDuration: fieldsToDuration(fields.duration.value, fields.durationUnit.value),
        tags: parseTags(fields.tags.value),
        scheduledDate: fields.scheduledDate.value || null,
        scheduledTime: fields.scheduledTime.value || null,
        updatedAt: now,
      };
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const task = readTaskFromForm();
      if (!task.title) {
        fields.title.focus();
        return;
      }
      options.onSave(task, mode);
      close();
    });

    deleteButton.addEventListener("click", () => {
      if (!editingTask) return;
      if (window.confirm(`Delete "${editingTask.title}"?`)) {
        options.onDelete(editingTask.id);
        close();
      }
    });

    document.getElementById("task-cancel").addEventListener("click", close);
    document.getElementById("task-cancel-x").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
    });

    return { open, close };
  }

  window.TaskModal = {
    createTaskModal,
    priorityOrder,
    parseTags,
  };
})();
