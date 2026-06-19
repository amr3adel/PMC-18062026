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

  function mergeTags(existingTags, nextTags) {
    return [...existingTags, ...nextTags].filter((tag, index, tags) => tags.indexOf(tag) === index);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function parseBulkTitles(value) {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function createTaskModal(options) {
    const modal = document.getElementById("task-modal");
    const form = document.getElementById("task-form");
    const title = document.getElementById("task-modal-title");
    const deleteButton = document.getElementById("task-delete");
    const saveButton = form.querySelector("button[type='submit']");

    const fields = {
      id: document.getElementById("task-id"),
      modeSwitch: document.getElementById("task-mode-switch"),
      modeButtons: document.querySelectorAll("[data-task-mode]"),
      singleTitleField: document.getElementById("single-title-field"),
      singleDescriptionField: document.getElementById("single-description-field"),
      bulkTitlesField: document.getElementById("bulk-titles-field"),
      title: document.getElementById("task-title"),
      bulkTitles: document.getElementById("task-bulk-titles"),
      description: document.getElementById("task-description"),
      descriptionPreview: document.getElementById("task-description-preview"),
      status: document.getElementById("task-status"),
      priority: document.getElementById("task-priority"),
      dueDate: document.getElementById("task-due-date"),
      duration: document.getElementById("task-duration"),
      durationUnit: document.getElementById("task-duration-unit"),
      tags: document.getElementById("task-tags"),
      tagChips: document.getElementById("task-tags-chips"),
      scheduledDate: document.getElementById("task-scheduled-date"),
      scheduledTime: document.getElementById("task-scheduled-time"),
      recurrence: document.getElementById("task-recurrence"),
    };

    let mode = "create";
    let editingTask = null;
    let defaults = {};
    let selectedTags = [];
    let taskEntryMode = "single";

    function close() {
      modal.classList.add("hidden");
      form.reset();
      selectedTags = [];
      renderTagChips();
      editingTask = null;
      defaults = {};
      setTaskEntryMode("single");
    }

    function open(task, nextDefaults) {
      editingTask = task || null;
      defaults = nextDefaults || {};
      mode = editingTask ? "edit" : "create";
      title.textContent = editingTask ? "Edit task" : "New task";
      deleteButton.classList.toggle("hidden", !editingTask);
      fields.modeSwitch.classList.toggle("hidden", Boolean(editingTask));
      setTaskEntryMode("single");

      const durationFields = durationToFields(editingTask ? editingTask.estimatedDuration : defaults.estimatedDuration);
      fields.id.value = editingTask ? editingTask.id : "";
      fields.title.value = editingTask ? editingTask.title : "";
      fields.bulkTitles.value = "";
      fields.description.value = editingTask ? editingTask.description || "" : "";
      renderDescriptionPreview();
      fields.status.value = editingTask ? editingTask.status : defaults.status || "backlog";
      fields.priority.value = editingTask ? editingTask.priority : defaults.priority || "medium";
      fields.dueDate.value = editingTask ? editingTask.dueDate || "" : defaults.dueDate || "";
      fields.duration.value = durationFields.value;
      fields.durationUnit.value = durationFields.unit;
      selectedTags = editingTask ? [...(editingTask.tags || [])] : parseTags(defaults.tags || "");
      fields.tags.value = "";
      renderTagChips();
      fields.scheduledDate.value = editingTask ? editingTask.scheduledDate || "" : defaults.scheduledDate || "";
      fields.scheduledTime.value = editingTask ? editingTask.scheduledTime || "" : defaults.scheduledTime || "";
      fields.recurrence.value = editingTask ? editingTask.recurrence || "none" : defaults.recurrence || "none";

      modal.classList.remove("hidden");
      fields.title.focus();
    }

    function setTaskEntryMode(nextMode) {
      taskEntryMode = nextMode;
      fields.modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.taskMode === taskEntryMode));
      const isBulk = taskEntryMode === "bulk" && !editingTask;
      fields.singleTitleField.classList.toggle("hidden", isBulk);
      fields.singleDescriptionField.classList.toggle("hidden", isBulk);
      fields.bulkTitlesField.classList.toggle("hidden", !isBulk);
      fields.title.required = !isBulk;
      fields.bulkTitles.required = isBulk;
      saveButton.textContent = isBulk ? "Create tasks" : "Save";
      if (isBulk) {
        fields.bulkTitles.focus();
      }
    }

    function syncTagsFromInput() {
      const nextTags = parseTags(fields.tags.value);
      if (nextTags.length > 0) {
        selectedTags = mergeTags(selectedTags, nextTags);
        fields.tags.value = "";
        renderTagChips();
      }
    }

    function renderDescriptionPreview() {
      if (!window.TaskMarkdown || !fields.description.value.trim()) {
        fields.descriptionPreview.classList.add("hidden");
        fields.descriptionPreview.innerHTML = "";
        return;
      }
      fields.descriptionPreview.classList.remove("hidden");
      fields.descriptionPreview.innerHTML = window.TaskMarkdown.render(fields.description.value);
    }

    function renderTagChips() {
      fields.tagChips.innerHTML = selectedTags
        .map(
          (tag) => `
            <span class="tag-chip">
              ${escapeHtml(tag)}
              <button type="button" aria-label="Remove ${escapeHtml(tag)}" data-remove-tag="${escapeHtml(tag)}">x</button>
            </span>
          `
        )
        .join("");

      fields.tagChips.querySelectorAll("[data-remove-tag]").forEach((button) => {
        button.addEventListener("click", () => {
          selectedTags = selectedTags.filter((tag) => tag !== button.dataset.removeTag);
          renderTagChips();
        });
      });
    }

    function readTaskFromForm() {
      syncTagsFromInput();
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
        tags: selectedTags,
        scheduledDate: fields.scheduledDate.value || null,
        scheduledTime: fields.scheduledTime.value || null,
        recurrence: fields.recurrence.value,
        actualLoggedMinutes: Number(base.actualLoggedMinutes) || 0,
        timeLogs: Array.isArray(base.timeLogs) ? base.timeLogs : [],
        archivedAt: base.archivedAt || null,
        updatedAt: now,
      };
    }

    function readSharedTaskFields() {
      syncTagsFromInput();
      return {
        status: fields.status.value,
        priority: fields.priority.value,
        dueDate: fields.dueDate.value || null,
        estimatedDuration: fieldsToDuration(fields.duration.value, fields.durationUnit.value),
        tags: [...selectedTags],
        scheduledDate: fields.scheduledDate.value || null,
        scheduledTime: fields.scheduledTime.value || null,
        recurrence: fields.recurrence.value,
      };
    }

    function readBulkTasksFromForm() {
      const titles = parseBulkTitles(fields.bulkTitles.value);
      const now = TaskStorage.nowIso();
      const sharedFields = readSharedTaskFields();
      return titles.map((taskTitle) => ({
        id: TaskStorage.uuid(),
        profileId: options.getActiveProfile().id,
        title: taskTitle,
        description: "",
        ...sharedFields,
        tags: [...sharedFields.tags],
        actualLoggedMinutes: 0,
        timeLogs: [],
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (taskEntryMode === "bulk" && !editingTask) {
        const tasks = readBulkTasksFromForm();
        if (!tasks.length) {
          fields.bulkTitles.focus();
          return;
        }
        options.onBulkSave(tasks);
        close();
        return;
      }

      const task = readTaskFromForm();
      if (!task.title) {
        fields.title.focus();
        return;
      }
      options.onSave(task, mode);
      close();
    });

    fields.tags.addEventListener("blur", syncTagsFromInput);
    fields.description.addEventListener("input", renderDescriptionPreview);
    fields.tags.addEventListener("keydown", (event) => {
      if (event.key === "," || event.key === "Enter") {
        event.preventDefault();
        syncTagsFromInput();
      }
    });

    fields.modeButtons.forEach((button) => {
      button.addEventListener("click", () => setTaskEntryMode(button.dataset.taskMode));
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
