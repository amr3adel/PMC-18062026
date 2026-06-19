(function () {
  const columns = [
    { id: "backlog", label: "Backlog" },
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "done", label: "Done" },
  ];

  const state = {
    backlogSort: "createdAt",
    priorityFilter: "all",
    tagFilter: "",
    density: window.localStorage.getItem("taskmanager_kanban_density") || "comfortable",
  };

  function render(root, context) {
    const tasks = context.tasks;
    root.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Kanban Board</h1>
          <p class="view-subtitle">${context.searchQuery ? `Filtered by "${ProfilesView.escapeHtml(context.searchQuery)}"` : `Drag cards between workflow stages for ${ProfilesView.escapeHtml(context.profile.name)}.`}</p>
        </div>
        <div class="view-actions">
          <div class="segmented-control" aria-label="Card density">
            <button class="${state.density === "comfortable" ? "active" : ""}" type="button" data-density="comfortable">Comfortable</button>
            <button class="${state.density === "compact" ? "active" : ""}" type="button" data-density="compact">Compact</button>
          </div>
          <button class="button add-task" type="button" data-action="add-task">Add task</button>
        </div>
      </div>
      <div class="kanban-board density-${state.density}">
        ${columns.map((column) => renderColumn(column, tasks, context)).join("")}
      </div>
    `;

    root.querySelector("[data-action='add-task']").addEventListener("click", () => context.createTask({ status: "backlog" }));

    root.querySelectorAll("[data-add-status]").forEach((button) => {
      button.addEventListener("click", () => context.createTask({ status: button.dataset.addStatus }));
    });

    root.querySelectorAll(".task-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-inline-edit], [data-tag-filter-value]")) return;
        context.openTask(card.dataset.taskId);
      });
      card.addEventListener("keydown", (event) => {
        if (event.target.closest("[data-inline-edit], [data-tag-filter-value]")) return;
        if (event.key === "Enter" || event.key === " ") context.openTask(card.dataset.taskId);
      });
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/task-id", card.dataset.taskId);
        event.dataTransfer.setData("text/plain", card.dataset.taskId);
        event.dataTransfer.effectAllowed = "move";
        document.body.classList.add("is-dragging-task");
        card.classList.add("drag-source");
        setDragPreview(event, card);
      });
      card.addEventListener("dragend", () => {
        document.body.classList.remove("is-dragging-task");
        card.classList.remove("drag-source");
      });
    });

    root.querySelectorAll("[data-inline-edit]").forEach((control) => {
      control.addEventListener("click", (event) => event.stopPropagation());
      control.addEventListener("change", () => {
        context.updateTask(control.dataset.taskId, { [control.dataset.inlineEdit]: control.value });
      });
    });

    root.querySelectorAll("[data-tag-filter-value]").forEach((tagButton) => {
      tagButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.tagFilter = tagButton.dataset.tagFilterValue;
        render(root, context);
      });
    });

    root.querySelectorAll(".task-list").forEach((list) => {
      list.addEventListener("dragover", (event) => {
        event.preventDefault();
        list.classList.add("drag-over");
      });
      list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
      list.addEventListener("drop", (event) => {
        event.preventDefault();
        list.classList.remove("drag-over");
        const taskId = event.dataTransfer.getData("text/task-id") || event.dataTransfer.getData("text/plain");
        if (taskId) context.updateTask(taskId, { status: list.dataset.status });
      });
    });

    root.querySelectorAll("[data-density]").forEach((button) => {
      button.addEventListener("click", () => {
        state.density = button.dataset.density;
        window.localStorage.setItem("taskmanager_kanban_density", state.density);
        render(root, context);
      });
    });

    const sort = root.querySelector("[data-backlog-sort]");
    const priority = root.querySelector("[data-priority-filter]");
    const tag = root.querySelector("[data-tag-filter]");
    if (sort) {
      sort.value = state.backlogSort;
      sort.addEventListener("change", () => {
        state.backlogSort = sort.value;
        render(root, context);
      });
    }
    if (priority) {
      priority.value = state.priorityFilter;
      priority.addEventListener("change", () => {
        state.priorityFilter = priority.value;
        render(root, context);
      });
    }
    if (tag) {
      tag.value = state.tagFilter;
      tag.addEventListener("input", () => {
        state.tagFilter = tag.value.trim();
        render(root, context);
        const nextTagInput = root.querySelector("[data-tag-filter]");
        if (nextTagInput) {
          nextTagInput.focus();
          nextTagInput.setSelectionRange(nextTagInput.value.length, nextTagInput.value.length);
        }
      });
    }
  }

  function renderColumn(column, allTasks, context) {
    const rawTasks = allTasks.filter((task) => task.status === column.id);
    let tasks = rawTasks;
    if (column.id === "backlog") {
      tasks = filterBacklog(tasks);
      tasks = sortBacklog(tasks);
    }

    return `
      <section class="kanban-column">
        <div class="column-header">
          <div class="column-title-row">
            <h3>${column.label}</h3>
            <span class="task-count">${tasks.length}</span>
          </div>
          ${
            column.id === "backlog"
              ? `<div class="column-tools">
                  <select data-backlog-sort aria-label="Sort backlog">
                    <option value="createdAt">Sort by creation date</option>
                    <option value="priority">Sort by priority</option>
                    <option value="dueDate">Sort by due date</option>
                  </select>
                  <select data-priority-filter aria-label="Filter by priority">
                    <option value="all">All priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input data-tag-filter type="search" placeholder="Filter by tag" />
                </div>`
              : ""
          }
          <button class="button add-task" type="button" data-add-status="${column.id}">Add task</button>
        </div>
        <div class="task-list" data-status="${column.id}">
          <div class="drop-zone-label">Drop to move to ${column.label}</div>
          ${tasks.map((task) => renderTaskCard(task, context)).join("") || renderColumnEmpty(column, allTasks.length, rawTasks.length)}
        </div>
      </section>
    `;
  }

  function renderColumnEmpty(column, totalTasks, rawColumnCount) {
    if (column.id === "backlog" && totalTasks === 0) {
      return `
        <div class="empty-state column-empty-state">
          <div class="empty-art small" aria-hidden="true"></div>
          <h4>Start with your first task</h4>
          <p>Create a backlog item, then drag it into the flow.</p>
          <button class="button add-task" type="button" data-add-status="backlog">Add your first task</button>
        </div>
      `;
    }

    if (column.id === "backlog" && rawColumnCount > 0) {
      return `<p class="muted">No backlog matches your filters.</p>`;
    }

    if (column.id === "backlog") {
      return `<p class="muted">Backlog is clear.</p>`;
    }

    return `<p class="muted">No tasks here.</p>`;
  }

  function filterBacklog(tasks) {
    return tasks.filter((task) => {
      const priorityMatches = state.priorityFilter === "all" || task.priority === state.priorityFilter;
      const tagNeedle = state.tagFilter.toLowerCase();
      const tagMatches = !tagNeedle || task.tags.some((tag) => tag.toLowerCase().includes(tagNeedle));
      return priorityMatches && tagMatches;
    });
  }

  function sortBacklog(tasks) {
    const copy = [...tasks];
    if (state.backlogSort === "priority") {
      copy.sort((a, b) => TaskModal.priorityOrder[b.priority] - TaskModal.priorityOrder[a.priority]);
    } else if (state.backlogSort === "dueDate") {
      copy.sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
    } else {
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return copy;
  }

  function renderTaskCard(task, context) {
    const due = task.dueDate ? TaskStorage.formatDate(task.dueDate) : "";
    const overdue = task.dueDate && task.dueDate < TaskStorage.todayIso() && task.status !== "done";
    const tags = task.tags
      .map(
        (tag) =>
          `<button class="tag tag-button${state.tagFilter === tag ? " active" : ""}" type="button" data-tag-filter-value="${ProfilesView.escapeHtml(tag)}">${ProfilesView.escapeHtml(tag)}</button>`
      )
      .join("");
    return `
      <article class="task-card" tabindex="0" draggable="true" data-task-id="${task.id}" style="border-left-color:${context.priorityColor(task.priority)}">
        <h4>${ProfilesView.escapeHtml(task.title)}</h4>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${due ? `<span class="${overdue ? "overdue" : ""}">Due ${due}</span>` : ""}
          ${task.estimatedDuration ? `<span>${TaskStorage.formatMinutes(task.estimatedDuration)}</span>` : ""}
          ${tags}
        </div>
        <div class="quick-edit-row">
          <select data-inline-edit="status" data-task-id="${task.id}" aria-label="Change status for ${ProfilesView.escapeHtml(task.title)}">
            ${columns.map((column) => `<option value="${column.id}" ${task.status === column.id ? "selected" : ""}>${column.label}</option>`).join("")}
          </select>
          <select data-inline-edit="priority" data-task-id="${task.id}" aria-label="Change priority for ${ProfilesView.escapeHtml(task.title)}">
            ${["low", "medium", "high", "urgent"].map((priority) => `<option value="${priority}" ${task.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </div>
      </article>
    `;
  }

  function setDragPreview(event, card) {
    const clone = card.cloneNode(true);
    clone.classList.add("drag-preview");
    clone.style.width = `${card.offsetWidth}px`;
    document.body.appendChild(clone);
    event.dataTransfer.setDragImage(clone, 18, 18);
    window.setTimeout(() => clone.remove(), 0);
  }

  window.KanbanView = {
    render,
    renderTaskCard,
  };
})();
