(function () {
  const state = {
    weekStart: TaskStorage.startOfWeek(new Date()),
  };
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function render(root, context) {
    const days = getVisibleDays();
    const weekEnd = TaskStorage.addDays(state.weekStart, 6);
    root.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Weekly Planner</h1>
          <p class="view-subtitle">${TaskStorage.formatDate(TaskStorage.toDateInput(state.weekStart))} - ${TaskStorage.formatDate(TaskStorage.toDateInput(weekEnd))}</p>
        </div>
        <div class="calendar-actions">
          <button class="button ghost" type="button" data-week-action="prev">Prev</button>
          <button class="button ghost" type="button" data-week-action="today">This week</button>
          <button class="button ghost" type="button" data-week-action="next">Next</button>
        </div>
      </div>
      <div class="weekly-shell">
        ${renderUnscheduled(context)}
        <div class="week-grid-wrap">
          <div class="week-grid" style="--visible-days:${days.length}">
            <div class="time-gutter"></div>
            ${days.map((day) => renderDayHeader(day)).join("")}
            ${renderSlots(days, context)}
          </div>
          ${renderCurrentTimeLine(days)}
        </div>
      </div>
    `;

    root.querySelectorAll("[data-week-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.weekAction;
        if (action === "prev") state.weekStart = TaskStorage.addDays(state.weekStart, -7);
        if (action === "next") state.weekStart = TaskStorage.addDays(state.weekStart, 7);
        if (action === "today") state.weekStart = TaskStorage.startOfWeek(new Date());
        render(root, context);
      });
    });

    root.querySelectorAll("[data-unscheduled-task], [data-week-task]").forEach((taskEl) => {
      taskEl.addEventListener("dragstart", (event) => {
        const id = taskEl.dataset.unscheduledTask || taskEl.dataset.weekTask;
        event.dataTransfer.setData("text/task-id", id);
        event.dataTransfer.effectAllowed = "move";
      });
      taskEl.addEventListener("click", () => context.openTask(taskEl.dataset.unscheduledTask || taskEl.dataset.weekTask));
    });

    root.querySelectorAll(".week-slot").forEach((slot) => {
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("drag-over");
        const taskId = event.dataTransfer.getData("text/task-id");
        if (taskId) {
          context.updateTask(taskId, {
            scheduledDate: slot.dataset.date,
            scheduledTime: slot.dataset.time,
          });
        }
      });
    });

    root.querySelector(".unscheduled-list").addEventListener("dragover", (event) => event.preventDefault());
    root.querySelector(".unscheduled-list").addEventListener("drop", (event) => {
      event.preventDefault();
      const taskId = event.dataTransfer.getData("text/task-id");
      if (taskId) context.updateTask(taskId, { scheduledDate: null, scheduledTime: null });
    });

    window.onresize = () => {
      if (document.body.contains(root)) render(root, context);
    };
  }

  function renderUnscheduled(context) {
    const tasks = context.tasks
      .filter((task) => !task.scheduledDate)
      .sort((a, b) => TaskModal.priorityOrder[b.priority] - TaskModal.priorityOrder[a.priority]);
    return `
      <aside class="unscheduled-panel">
        <div class="panel-pad">
          <h3>Unscheduled</h3>
          <p class="muted">Drag tasks onto a time slot.</p>
        </div>
        <div class="unscheduled-list">
          ${
            tasks.length
              ? tasks.map((task) => renderSidebarTask(task, context)).join("")
              : `<p class="muted">No tasks scheduled.</p>`
          }
        </div>
      </aside>
    `;
  }

  function renderSidebarTask(task, context) {
    return `
      <article class="task-card" draggable="true" data-unscheduled-task="${task.id}" style="border-left-color:${context.priorityColor(task.priority)}">
        <h4>${ProfilesView.escapeHtml(task.title)}</h4>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${task.estimatedDuration ? `<span>${TaskStorage.formatMinutes(task.estimatedDuration)}</span>` : ""}
        </div>
      </article>
    `;
  }

  function getVisibleDays() {
    const limit = window.innerWidth >= 1024 ? 7 : 3;
    const today = new Date();
    const start = window.innerWidth >= 1024 ? state.weekStart : today;
    const days = [];
    for (let index = 0; index < limit; index += 1) {
      days.push(TaskStorage.addDays(start, index));
    }
    return days;
  }

  function renderDayHeader(date) {
    const iso = TaskStorage.toDateInput(date);
    const weekIndex = (date.getDay() + 6) % 7;
    return `
      <div class="week-day-header${iso === TaskStorage.todayIso() ? " today" : ""}">
        ${dayNames[weekIndex]}<br />
        ${TaskStorage.formatDate(iso)}
      </div>
    `;
  }

  function renderSlots(days, context) {
    const slots = [];
    for (let hour = 8; hour < 22; hour += 1) {
      for (const minute of [0, 30]) {
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        slots.push(`<div class="time-label">${minute === 0 ? time : ""}</div>`);
        days.forEach((day) => {
          const iso = TaskStorage.toDateInput(day);
          const tasks = context.tasks.filter((task) => task.scheduledDate === iso && task.scheduledTime === time);
          slots.push(`
            <div class="week-slot" data-date="${iso}" data-time="${time}">
              ${tasks.map((task) => renderWeekTask(task, context)).join("")}
            </div>
          `);
        });
      }
    }
    return slots.join("");
  }

  function renderWeekTask(task, context) {
    const rows = Math.max(1, Math.ceil((task.estimatedDuration || 30) / 30));
    return `
      <button class="week-task" type="button" draggable="true" data-week-task="${task.id}" style="border-left-color:${context.priorityColor(task.priority)}; min-height:${rows * 34}px">
        <strong>${ProfilesView.escapeHtml(task.title)}</strong>
        <span>${task.scheduledTime || ""}${task.estimatedDuration ? ` · ${TaskStorage.formatMinutes(task.estimatedDuration)}` : ""}</span>
      </button>
    `;
  }

  function renderCurrentTimeLine(days) {
    const now = new Date();
    const todayIso = TaskStorage.toDateInput(now);
    if (!days.some((day) => TaskStorage.toDateInput(day) === todayIso)) return "";
    const hour = now.getHours();
    if (hour < 8 || hour >= 22) return "";
    const slotIndex = (hour - 8) * 2 + now.getMinutes() / 30;
    const top = 42 + slotIndex * 42;
    return `<div class="current-time-line" style="top:${top}px"></div>`;
  }

  window.WeeklyView = {
    render,
  };
})();
