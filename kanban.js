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
  };

  function render(root, context) {
    const tasks = context.tasks;
    if (tasks.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-art" aria-hidden="true"></div>
          <h1 class="view-title">Start with your first task</h1>
          <p>Create a task in ${ProfilesView.escapeHtml(context.profile.name)} and move it through your workflow.</p>
          <button class="button primary" type="button" data-action="empty-add">Add your first task</button>
        </div>
      `;
      root.querySelector("[data-action='empty-add']").addEventListener("click", () => context.createTask({ status: "backlog" }));
      return;
    }

    root.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Kanban Board</h1>
          <p class="view-subtitle">Drag cards between workflow stages for ${ProfilesView.escapeHtml(context.profile.name)}.</p>
        </div>
        <button class="button primary" type="button" data-action="add-task">Add task</button>
      </div>
      <div class="kanban-board">
        ${columns.map((column) => renderColumn(column, tasks, context)).join("")}
      </div>
    `;

    root.querySelector("[data-action='add-task']").addEventListener("click", () => context.createTask({ status: "backlog" }));

    root.querySelectorAll("[data-add-status]").forEach((button) => {
      button.addEventListener("click", () => context.createTask({ status: button.dataset.addStatus }));
    });

    root.querySelectorAll(".task-card").forEach((card) => {
      card.addEventListener("click", () => context.openTask(card.dataset.taskId));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") context.openTask(card.dataset.taskId);
      });
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/task-id", card.dataset.taskId);
        event.dataTransfer.effectAllowed = "move";
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
        const taskId = event.dataTransfer.getData("text/task-id");
        if (taskId) context.updateTask(taskId, { status: list.dataset.status });
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
      });
    }
  }

  function renderColumn(column, allTasks, context) {
    let tasks = allTasks.filter((task) => task.status === column.id);
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
          <button class="button ghost" type="button" data-add-status="${column.id}">Add task</button>
        </div>
        <div class="task-list" data-status="${column.id}">
          ${tasks.map((task) => renderTaskCard(task, context)).join("") || `<p class="muted">No tasks here.</p>`}
        </div>
      </section>
    `;
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
    const tags = task.tags.map((tag) => `<span class="tag">${ProfilesView.escapeHtml(tag)}</span>`).join("");
    return `
      <article class="task-card" tabindex="0" draggable="true" data-task-id="${task.id}" style="border-left-color:${context.priorityColor(task.priority)}">
        <h4>${ProfilesView.escapeHtml(task.title)}</h4>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${due ? `<span class="${overdue ? "overdue" : ""}">Due ${due}</span>` : ""}
          ${task.estimatedDuration ? `<span>${TaskStorage.formatMinutes(task.estimatedDuration)}</span>` : ""}
          ${tags}
        </div>
      </article>
    `;
  }

  window.KanbanView = {
    render,
    renderTaskCard,
  };
})();
