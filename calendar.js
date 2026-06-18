(function () {
  const viewState = {
    monthDate: new Date(),
    selectedDate: TaskStorage.todayIso(),
  };
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function render(root, context) {
    const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(viewState.monthDate);
    root.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${monthTitle}</h1>
          <p class="view-subtitle">Due dates use solid chips. Scheduled work uses dashed chips.</p>
        </div>
        <div class="calendar-actions">
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

    root.querySelectorAll(".date-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        viewState.selectedDate = cell.dataset.date;
        render(root, context);
      });
    });

    root.querySelectorAll("[data-task-chip]").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        context.openTask(chip.dataset.taskChip);
      });
    });

    root.querySelectorAll("[data-day-task]").forEach((item) => {
      item.addEventListener("click", () => context.openTask(item.dataset.dayTask));
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
        ${tasks.slice(0, 4).map((entry) => renderChip(entry, context)).join("")}
        ${tasks.length > 4 ? `<div class="muted">+${tasks.length - 4} more</div>` : ""}
      </button>
    `;
  }

  function renderChip(entry, context) {
    const classes = ["task-chip"];
    if (entry.kind === "scheduled") classes.push("scheduled");
    if (entry.kind === "combined") classes.push("combined");
    return `
      <span class="${classes.join(" ")}" data-task-chip="${entry.task.id}" style="border-left-color:${context.priorityColor(entry.task.priority)}">
        ${entry.kind === "combined" ? "Due + scheduled: " : entry.kind === "scheduled" ? "Scheduled: " : "Due: "}
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
                    (entry) => `
                      <button class="day-panel-item" type="button" data-day-task="${entry.task.id}">
                        <h4>${ProfilesView.escapeHtml(entry.task.title)}</h4>
                        <div class="task-meta">
                          <span class="priority-badge priority-${entry.task.priority}">${entry.task.priority}</span>
                          <span>${entry.kind === "combined" ? "Due and scheduled" : entry.kind}</span>
                          ${entry.task.scheduledTime ? `<span>${entry.task.scheduledTime}</span>` : ""}
                        </div>
                      </button>
                    `
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
      .sort((a, b) => {
        const timeCompare = (a.task.scheduledTime || "99:99").localeCompare(b.task.scheduledTime || "99:99");
        if (timeCompare !== 0) return timeCompare;
        return TaskModal.priorityOrder[b.task.priority] - TaskModal.priorityOrder[a.task.priority];
      });
  }

  window.CalendarView = {
    render,
  };
})();
