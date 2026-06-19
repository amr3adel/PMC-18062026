(function () {
  const viewState = {
    monthDate: new Date(),
    selectedDate: TaskStorage.todayIso(),
    typeFilter: "all",
  };
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function render(root, context) {
    const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(viewState.monthDate);
    root.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${monthTitle}</h1>
          <p class="view-subtitle">${context.searchQuery ? `Filtered by "${ProfilesView.escapeHtml(context.searchQuery)}"` : "Due work is solid. Scheduled work is dashed."}</p>
        </div>
        <div class="calendar-actions">
          <div class="segmented-control" aria-label="Calendar task type">
            <button class="${viewState.typeFilter === "all" ? "active" : ""}" type="button" data-calendar-filter="all">All</button>
            <button class="${viewState.typeFilter === "due" ? "active" : ""}" type="button" data-calendar-filter="due">Due</button>
            <button class="${viewState.typeFilter === "scheduled" ? "active" : ""}" type="button" data-calendar-filter="scheduled">Scheduled</button>
          </div>
          <button class="button ghost" type="button" data-calendar-action="prev">Prev</button>
          <button class="button ghost" type="button" data-calendar-action="today">Today</button>
          <button class="button ghost" type="button" data-calendar-action="next">Next</button>
        </div>
      </div>
      <div class="calendar-shell">
        <div class="calendar-grid">
          ${weekdays.map((day) => `<div class="weekday">${day}</div>`).join("")}
          ${buildCalendarDays(viewState.monthDate).map((day) => renderDateCell(day, context)).join("")}
        </div>
        ${renderDayPanel(context)}
      </div>
    `;

    root.querySelectorAll("[data-calendar-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.calendarAction;
        if (action === "prev") viewState.monthDate.setMonth(viewState.monthDate.getMonth() - 1);
        if (action === "next") viewState.monthDate.setMonth(viewState.monthDate.getMonth() + 1);
        if (action === "today") {
          viewState.monthDate = new Date();
          viewState.selectedDate = TaskStorage.todayIso();
        }
        render(root, context);
      });
    });

    root.querySelectorAll("[data-calendar-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        viewState.typeFilter = button.dataset.calendarFilter;
        render(root, context);
      });
    });

    root.querySelectorAll(".date-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        viewState.selectedDate = cell.dataset.date;
        render(root, context);
      });
      cell.addEventListener("dragover", (event) => {
        event.preventDefault();
        cell.classList.add("drag-over");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
      cell.addEventListener("drop", (event) => {
        event.preventDefault();
        cell.classList.remove("drag-over");
        const taskId = event.dataTransfer.getData("text/task-id") || event.dataTransfer.getData("text/plain");
        const calendarKind = event.dataTransfer.getData("text/calendar-kind");
        if (!taskId) return;
        if (calendarKind === "due") {
          context.updateTask(taskId, { dueDate: cell.dataset.date });
        } else {
          context.updateTask(taskId, { scheduledDate: cell.dataset.date, scheduledTime: null });
        }
        viewState.selectedDate = cell.dataset.date;
      });
    });

    root.querySelectorAll("[data-more-date]").forEach((more) => {
      more.addEventListener("click", (event) => {
        event.stopPropagation();
        viewState.selectedDate = more.dataset.moreDate;
        render(root, context);
      });
    });

    root.querySelectorAll("[data-task-chip]").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        context.openTask(chip.dataset.taskChip);
      });
      chip.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        event.dataTransfer.setData("text/task-id", chip.dataset.taskChip);
        event.dataTransfer.setData("text/plain", chip.dataset.taskChip);
        event.dataTransfer.setData("text/calendar-kind", chip.dataset.calendarKind);
        event.dataTransfer.effectAllowed = "move";
        document.body.classList.add("is-dragging-task");
        chip.classList.add("drag-source");
        setDragPreview(event, chip);
      });
      chip.addEventListener("dragend", () => {
        document.body.classList.remove("is-dragging-task");
        chip.classList.remove("drag-source");
      });
    });

    root.querySelectorAll("[data-day-task]").forEach((item) => {
      item.addEventListener("click", () => context.openTask(item.dataset.dayTask));
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/task-id", item.dataset.dayTask);
        event.dataTransfer.setData("text/plain", item.dataset.dayTask);
        event.dataTransfer.setData("text/calendar-kind", item.dataset.calendarKind);
        event.dataTransfer.effectAllowed = "move";
        document.body.classList.add("is-dragging-task");
        item.classList.add("drag-source");
        setDragPreview(event, item);
      });
      item.addEventListener("dragend", () => {
        document.body.classList.remove("is-dragging-task");
        item.classList.remove("drag-source");
      });
    });
  }

  function buildCalendarDays(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const gridStart = TaskStorage.startOfWeek(first);
    const days = [];
    for (let index = 0; index < 42; index += 1) {
      const date = TaskStorage.addDays(gridStart, index);
      days.push({
        date,
        iso: TaskStorage.toDateInput(date),
        outside: date.getMonth() !== monthDate.getMonth(),
      });
    }
    return days;
  }

  function renderDateCell(day, context) {
    const tasks = tasksForDay(context.tasks, day.iso);
    const isToday = day.iso === TaskStorage.todayIso();
    const isSelected = day.iso === viewState.selectedDate;
    return `
      <button class="date-cell${day.outside ? " outside" : ""}${isToday ? " today" : ""}${isSelected ? " selected" : ""}" type="button" data-date="${day.iso}">
        <div class="date-number">
          <span>${day.date.getDate()}</span>
          ${tasks.length ? `<span class="muted">${tasks.length}</span>` : ""}
        </div>
        <div class="calendar-chip-list">
          ${tasks.slice(0, 3).map((entry) => renderChip(entry, context)).join("")}
          ${tasks.length > 3 ? `<span class="task-chip more-chip" data-more-date="${day.iso}">+${tasks.length - 3} more</span>` : ""}
        </div>
      </button>
    `;
  }

  function renderChip(entry, context) {
    const classes = ["task-chip"];
    classes.push(`chip-${entry.kind}`);
    if (entry.kind === "scheduled") classes.push("scheduled");
    if (entry.kind === "combined") classes.push("combined");
    return `
      <span class="${classes.join(" ")}" draggable="true" data-task-chip="${entry.task.id}" data-calendar-kind="${entry.kind === "due" ? "due" : "scheduled"}" style="border-left-color:${context.priorityColor(entry.task.priority)}">
        <span class="chip-kind">${entry.kind === "combined" ? "Both" : entry.kind}</span>
        ${ProfilesView.escapeHtml(entry.task.title)}
      </span>
    `;
  }

  function renderDayPanel(context) {
    const entries = tasksForDay(context.tasks, viewState.selectedDate);
    const readableDate = TaskStorage.formatDate(viewState.selectedDate, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return `
      <aside class="day-panel">
        <h3>${readableDate}</h3>
        ${
          entries.length
            ? `<div class="day-panel-list">
                ${entries
                  .map(
                    (entry) => {
                      const tags = entry.task.tags.map((tag) => `<span class="tag">${ProfilesView.escapeHtml(tag)}</span>`).join("");
                      return `
                        <button class="day-panel-item" type="button" draggable="true" data-day-task="${entry.task.id}" data-calendar-kind="${entry.kind === "due" ? "due" : "scheduled"}" style="border-left:4px solid ${context.priorityColor(entry.task.priority)}">
                          <h4>${ProfilesView.escapeHtml(entry.task.title)}</h4>
                          <div class="task-meta">
                            <span class="priority-badge priority-${entry.task.priority}">${entry.task.priority}</span>
                            <span>${entry.kind === "combined" ? "Due and scheduled" : entry.kind}</span>
                            ${entry.task.scheduledTime ? `<span>${entry.task.scheduledTime}</span>` : ""}
                            ${tags}
                          </div>
                        </button>
                      `;
                    }
                  )
                  .join("")}
              </div>`
            : `<p class="muted">No tasks scheduled.</p>`
        }
      </aside>
    `;
  }

  function tasksForDay(tasks, iso) {
    return tasks
      .map((task) => {
        const due = task.dueDate === iso;
        const scheduled = task.scheduledDate === iso;
        if (!due && !scheduled) return null;
        return {
          task,
          kind: due && scheduled ? "combined" : scheduled ? "scheduled" : "due",
        };
      })
      .filter(Boolean)
      .filter((entry) => {
        if (viewState.typeFilter === "all") return true;
        if (viewState.typeFilter === "due") return entry.kind === "due" || entry.kind === "combined";
        return entry.kind === "scheduled" || entry.kind === "combined";
      })
      .sort((a, b) => {
        const timeCompare = (a.task.scheduledTime || "99:99").localeCompare(b.task.scheduledTime || "99:99");
        if (timeCompare !== 0) return timeCompare;
        return TaskModal.priorityOrder[b.task.priority] - TaskModal.priorityOrder[a.task.priority];
      });
  }

  window.CalendarView = {
    render,
  };

  function setDragPreview(event, element) {
    const clone = element.cloneNode(true);
    clone.classList.add("drag-preview");
    clone.style.width = `${Math.max(element.offsetWidth, 180)}px`;
    document.body.appendChild(clone);
    event.dataTransfer.setDragImage(clone, 18, 18);
    window.setTimeout(() => clone.remove(), 0);
  }
})();
