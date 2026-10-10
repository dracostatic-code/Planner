(() => {
  "use strict";

  const STORAGE_KEY = "myDailyPlanner.v1";
  const RETURN_DATE = "2026-11-11";

  const CATEGORY_LABELS = {
    house: "House building",
    practical: "Practical jobs",
    website: "Website work",
    leadbright: "LeadBright",
    personal: "Personal"
  };

  const CATEGORY_ICONS = {
    house: "🏠",
    practical: "🧰",
    website: "🌐",
    leadbright: "✨",
    personal: "🌿"
  };

  const ROUTINE = [
    {
      id: "feed-am",
      time: "8:00 AM",
      title: "Feed animals",        
      detail: "Morning animal feeding",
      category: "routine"            
    },
    {
      id: "feed-pm",
      time: "5:30 PM",
      title: "Feed animals",
      detail: "Evening animal feeding",
      category: "routine"
    },
    {
      id: "dinner",
      time: "6:00–7:00 PM",
      title: "Dinner",
      detail: "Make time to eat and reset",
      category: "routine"
    }
  ];

  const $ = id => document.getElementById(id);

  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const dateShift = (iso, days) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const startOfWeek = iso => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const prettyDate = iso =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });

  const escapeHTML = str =>
    String(str ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));

  const uid = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function validDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const date = new Date(`${iso}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === iso;
  }

  function blankState() {
    return {
      version: 1,
      tasks: [],
      routineChecks: {},
      settings: { hotWeather: false, breaks: true, dark: false },
      createdAt: todayISO()
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankState();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.tasks)) return blankState();
      return {
        ...blankState(),
        ...data,
        settings: {
          ...blankState().settings,
          ...(data.settings || {})
        },
        routineChecks: data.routineChecks || {}
      };
    } catch (err) {
      console.warn("Could not load planner data:", err);
      return blankState();
    }
  }

  let state = loadState();
  let currentView = "today";
  let taskFilter = "all";
  let toastTimer = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("saveStatus").textContent = "Saved locally";
    } catch (err) {
      $("saveStatus").textContent = "Could not save";
      showToast("Your browser could not save data. Export a backup if possible.");
    }
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function completedToday(task) {
    return task.completed && task.completedDate === todayISO();
  }

  function isPaused(task) {
    return task.status === "waiting" || task.status === "hold";
  }

  function isActive(task) {
    return !task.completed && !isPaused(task);
  }

  function getTodayTasks() {
    const today = todayISO();
    return state.tasks.filter(t =>
      completedToday(t) ||
      (!t.completed && !isPaused(t) && (
        t.date === today ||
        (!t.date && t.createdDate <= today) ||
        (t.repeat && t.repeat !== "none" && t.date && t.date < today)
      ))
    );
  }

  function taskCard(task, withDate = false) {
    const category = CATEGORY_LABELS[task.category] || "Personal";
    const done = !!task.completed;
    const paused = isPaused(task);
    const pinned = task.priorityDate === todayISO();
    const id = escapeHTML(task.id);
    const title = escapeHTML(task.title);
    const statusLabel = task.status === "waiting" ? "Waiting on" : "On hold";

    const action = (name, label, extra = "") =>
      `<button class="secondary-button" type="button"
        data-task-action="${name}" data-task-id="${id}" ${extra}
        style="padding:7px 10px;font-size:.75rem">${label}</button>`;

    return `
      <article class="task-card ${done ? "completed" : ""}"
        data-task-card="${id}">
        <input class="task-check" type="checkbox"
          aria-label="Mark ${title} complete"
          data-complete="${id}"
          ${done ? "checked" : ""}
          ${paused && !done ? "disabled" : ""}>
        <div class="task-main">
          <div class="task-title">${title}</div>
          <div class="task-meta">
            <span class="category-tag">
              ${CATEGORY_ICONS[task.category] || "🌿"}
              ${escapeHTML(category)}
            </span>
            ${task.repeat && task.repeat !== "none" ? `
              <span class="category-tag">
                ↻ ${escapeHTML(repeatLabel(task))}
              </span>
            ` : ""}
            ${withDate && task.date ? `
              <span class="date-tag">${escapeHTML(task.date)}</span>
            ` : ""}
            ${paused && !done ? `
              <span class="category-tag">${statusLabel}</span>
            ` : ""}
          </div>
          ${task.notes ? `
            <p class="task-notes">${escapeHTML(task.notes)}</p>
          ` : ""}
          ${paused && task.holdReason ? `
            <p class="task-notes">${escapeHTML(task.holdReason)}</p>
          ` : ""}
          <div class="button-stack" style="margin-top:10px">
            ${!paused && (!done || pinned)
              ? action("pin", pinned ? "★ Unpin" : "☆ Top three",
                `aria-pressed="${pinned}"`)
              : ""}
            ${!done
              ? action("tomorrow", "Tomorrow") + action("date", "Choose date")
              : ""}
            ${paused && !done ? action("resume", "Resume") : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action" type="button"
            data-edit="${id}" aria-label="Edit ${title}">✎</button>
          <button class="task-action" type="button"
            data-delete="${id}" aria-label="Delete ${title}">×</button>
        </div>
      </article>
    `;
  }

  function renderToday() {
    renderRoutine();

    const tasks = getTodayTasks().sort((a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.createdAt || 0) - (b.createdAt || 0)
    );

    const pinned = tasks
      .filter(t => t.priorityDate === todayISO()).slice(0, 3);

    $("topThreeTasks").innerHTML = pinned.map(t => taskCard(t)).join("");
    $("topThreeEmpty").classList.toggle("hidden", pinned.length > 0);
    $("topThreeCount").textContent = `${pinned.length}/3 selected`;

    const otherTasks = tasks.filter(t => !pinned.some(p => p.id === t.id));
    $("todayTasks").innerHTML = otherTasks.map(t => taskCard(t)).join("");
    $("emptyToday").classList.toggle("hidden", tasks.length > 0);

    const checks = state.routineChecks[todayISO()] || {};
    const activeRoutine = getActiveRoutine();
    const routineDone = activeRoutine.filter(r => checks[r.id]).length;
    const done = tasks.filter(completedToday).length + routineDone;
    const total = tasks.length + activeRoutine.length;
    const pct = total ? Math.round(done / total * 100) : 0;

    $("doneCount").textContent = done;
    $("remainingCount").textContent = Math.max(0, total - done);
    $("dailyProgressBar").style.width = `${pct}%`;
    $("dailyProgressText").textContent = total
      ? `${pct}% complete · progress, not perfection.`
      : "No tasks scheduled for today · enjoy your day.";

    $("weatherBanner").classList.toggle("hidden", !state.settings.hotWeather);
  }

  function renderTasks() {
    const filtered = state.tasks
      .filter(t => taskFilter === "all" || t.category === taskFilter)
      .sort((a, b) =>
        Number(a.completed) - Number(b.completed) ||
        (a.date || "9999").localeCompare(b.date || "9999") ||
        (b.createdAt || 0) - (a.createdAt || 0)
      );

    $("allTasks").innerHTML = filtered.map(t => taskCard(t, true)).join("");
    $("emptyTasks").classList.toggle("hidden", filtered.length > 0);

    document.querySelectorAll("[data-filter]").forEach(btn =>
      btn.classList.toggle("selected", btn.dataset.filter === taskFilter)
    );
  }

  function renderProgress() {
    const weekStart = startOfWeek(todayISO());
    const weekEnd = dateShift(weekStart, 6);
    const createdThisWeek = state.tasks.filter(t =>
      t.createdDate >= weekStart && t.createdDate <= weekEnd
    );
    const completedThisWeek = state.tasks.filter(t =>
      t.completed &&
      t.completedDate >= weekStart &&
      t.completedDate <= weekEnd
    );
    const pct = createdThisWeek.length
      ? Math.round(completedThisWeek.length / createdThisWeek.length * 100)
      : (completedThisWeek.length ? 100 : 0);

    $("weeklyPercent").textContent = `${Math.min(100, pct)}% complete`;
    $("weeklyProgressBar").style.width = `${Math.min(100, pct)}%`;
    $("weeklySummary").textContent = completedThisWeek.length
      ? `You've completed ${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} this week. Keep the pace realistic.`
      : "A fresh week is a chance to choose a few useful next steps.";
    $("weekDone").textContent = completedThisWeek.length;
    $("weekAdded").textContent = createdThisWeek.length;

    let streak = 0;
    let cursor = todayISO();

    const hasCompletion = date =>
      state.tasks.some(t => t.completed && t.completedDate === date) ||
      Object.keys(state.routineChecks[date] || {}).some(
        k => state.routineChecks[date][k]
      );

    if (!hasCompletion(cursor)) cursor = dateShift(cursor, -1);
    while (hasCompletion(cursor) && streak < 365) {
      streak++;
      cursor = dateShift(cursor, -1);
    }

    $("streakCount").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
    $("activeProjects").textContent =
      new Set(state.tasks.filter(isActive).map(t => t.category)).size;

    $("categoryProgress").innerHTML =
      Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        const items = state.tasks.filter(t =>
          t.category === key &&
          t.createdDate >= weekStart &&
          t.createdDate <= weekEnd
        );
        const done = items.filter(t =>
          t.completed &&
          t.completedDate >= weekStart &&
          t.completedDate <= weekEnd
        ).length;
        const percent = items.length
          ? Math.round(done / items.length * 100) : 0;

        return `
          <div>
            <div class="category-line-head">
              <span>${CATEGORY_ICONS[key]} ${escapeHTML(label)}</span>
              <span>${done}/${items.length} · ${percent}%</span>
            </div>
            <div class="category-track">
              <div style="width:${percent}%"></div>
            </div>
          </div>
        `;
      }).join("");
  }

  function renderSettings() {
    $("hotWeatherToggle").checked = !!state.settings.hotWeather;
    $("breaksToggle").checked = !!state.settings.breaks;
    $("darkToggle").checked = !!state.settings.dark;
    document.body.classList.toggle("dark", !!state.settings.dark);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content", state.settings.dark ? "#101827" : "#234b91"
      );
    }

    $("themeToggle").textContent = state.settings.dark ? "☼" : "◐";

    document.querySelectorAll("#view-settings .routine-line")
      .forEach(line => line.remove());

    const description = document.querySelector(
      "#view-settings .settings-card > .muted"
    );
    if (description) {
      description.textContent =
        "Manage routines from Today using Add routine, the pencil to edit, or × to delete. Each routine repeats daily from its start date.";
    }
  }

  function renderHeader() {
    const today = todayISO();
    $("todayLabel").textContent = prettyDate(today);
    const diff = Math.round(
      (new Date(`${RETURN_DATE}T12:00:00`) -
        new Date(`${today}T12:00:00`)) / 86400000
    );

    if (diff > 0) {
      $("countdownTitle").textContent = "Your next chapter is getting closer.";
      $("countdownNumber").textContent = diff;
      $("countdownText").textContent =
        "Build the habits that will help you arrive feeling prepared.";
    } else if (diff === 0) {
      $("countdownTitle").textContent = "Today is the day.";
      $("countdownNumber").textContent = "0";
      $("countdownText").textContent = "Take things one step at a time.";
    } else {
      $("countdownTitle").textContent = "One step at a time.";
      $("countdownNumber").textContent = "✓";
      $("countdownText").textContent = "Your plans can keep growing from here.";
    }
  }

  function render() {
    syncCustomTabs();
    renderHeader();
    renderSettings();
    renderToday();
    renderTasks();
    renderProgress();
    renderJournalPrompt();
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll(".tab").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.view === view)
    );
    document.querySelectorAll(".view").forEach(el =>
      el.classList.toggle("hidden", el.id !== `view-${view}`)
    );
    if (view === "progress") renderProgress();
    if (view === "today") renderToday();
    if (view === "tasks") renderTasks();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTaskDialog(task = null) {
    $("taskForm").reset();
    $("taskId").value = task ? task.id : "";
    $("dialogTitle").textContent = task ? "Edit task" : "Add a task";
    $("taskTitle").value = task ? task.title : "";
    $("taskCategory").value = task ? task.category : "house";
    if (!$("taskCategory").value) {
      $("taskCategory").value = state.customTabs[0].id;
    }
    $("taskDate").value = task ? (task.date || todayISO()) : todayISO();
    $("taskNotes").value = task ? (task.notes || "") : "";
    $("taskRepeat").value = task?.repeat || "none";
    $("taskStatus").value = task?.status || "active";
    $("taskHoldReason").value = task?.holdReason || "";

    document.querySelectorAll("[data-repeat-day]").forEach(input => {
      input.checked = (task?.repeatDays || []).includes(Number(input.value));
    });

    updateHoldReason();
    updateRepeatDays();
    $("taskDialog").showModal();
    setTimeout(() => $("taskTitle").focus(), 50);
  }

  function saveTaskFromForm(event) {
    event.preventDefault();
    const title = $("taskTitle").value.trim();
    if (!title) return;

    const id = $("taskId").value;
    const existing = state.tasks.find(t => t.id === id);

    if (existing?.completed && existing.repeat && existing.repeat !== "none") {
      alert("Edit the next unfinished occurrence to change this repeating task.");
      return;
    }

    const status = $("taskStatus").value;
    const holdReason = $("taskHoldReason").value.trim();
    const repeat = $("taskRepeat").value;
    const repeatDays = Array.from(
      document.querySelectorAll("[data-repeat-day]:checked")
    ).map(input => Number(input.value));

    if (repeat === "days" && !repeatDays.length) {
      alert("Choose at least one weekday.");
      return;
    }
    if (existing?.completed && repeat !== "none") {
      alert("Uncheck this completed task before making it repeat.");
      return;
    }

    let taskDate = $("taskDate").value || "";
    if (repeat !== "none") {
      if (!taskDate) {
        alert("Choose a start date for this repeating task.");
        return;
      }
      if (repeat === "days") {
        taskDate = matchingWeekday(taskDate, repeatDays);
      }
    }

    const task = {
      ...existing,
      id: id || uid(),
      title,
      category: $("taskCategory").value,
      date: taskDate,
      repeat,
      repeatDays: repeat === "days" ? repeatDays : [],
      status,
      holdReason: status === "active" ? "" : holdReason,
      priorityDate: status === "active" &&
        (!taskDate || taskDate <= todayISO())
        ? (existing?.priorityDate || "") : "",
      notes: $("taskNotes").value.trim(),
      completed: existing ? existing.completed : false,
      completedDate: existing ? existing.completedDate : "",
      createdDate: existing ? existing.createdDate : todayISO(),
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existing) {
      state.tasks = state.tasks.map(t => t.id === id ? task : t);
    } else {
      state.tasks.push(task);
    }

    saveState();
    $("taskDialog").close();
    render();
    showToast(existing ? "Task updated." : "Task added.");
  }

  function toggleTask(id, checked) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.completed === checked) return;
    if (checked && isPaused(task)) {
      render();
      return;
    }

    if (!checked && task.nextOccurrenceId) {
      const next = state.tasks.find(t => t.id === task.nextOccurrenceId);
      if (next?.completed || next?.nextOccurrenceId) {
        alert("Undo the most recent occurrence first.");
        render();
        return;
      }
      if (next && !confirm(
        "Undo this completion and remove its next scheduled occurrence?"
      )) {
        render();
        return;
      }
      state.tasks = state.tasks.filter(t => t.id !== task.nextOccurrenceId);
      delete task.nextOccurrenceId;
    }

    task.completed = checked;
    task.completedDate = checked ? todayISO() : "";
    task.updatedAt = Date.now();

    if (checked && task.repeat && task.repeat !== "none") {
      const nextDate = nextRepeatDate(task);
      if (nextDate) {
        const nextId = uid();
        task.nextOccurrenceId = nextId;
        const next = {
          ...task,
          id: nextId,
          date: nextDate,
          priorityDate: "",
          status: "active",
          holdReason: "",
          completed: false,
          completedDate: "",
          createdDate: todayISO(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        delete next.nextOccurrenceId;
        state.tasks.push(next);
      }
    }

    saveState();
    render();
    if (checked && task.nextOccurrenceId) {
      showToast("Completed. Next occurrence scheduled.");
    }
  }

  function toggleRoutine(id, checked) {
    const day = todayISO();
    if (!state.routineChecks[day]) state.routineChecks[day] = {};
    state.routineChecks[day][id] = checked;
    saveState();
    render();
  }

  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const note = task.repeat && task.repeat !== "none"
      ? (task.completed
        ? "This removes this history entry; its next occurrence stays."
        : "This also stops future repeats of this task.")
      : "This cannot be undone unless you have a backup.";

    if (!confirm(`Delete "${task.title}"? ${note}`)) return;
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    render();
    showToast("Task deleted.");
  }

  function togglePriority(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    if (task.priorityDate === todayISO()) {
      task.priorityDate = "";
    } else {
      const eligible = getTodayTasks();
      if (
        task.completed || isPaused(task) ||
        !eligible.some(t => t.id === id)
      ) {
        alert("Choose an active task from today's list. You can reschedule a future task to today first.");
        return;
      }
      if (eligible.filter(t => t.priorityDate === todayISO()).length >= 3) {
        alert("You already have three priorities. Unpin one before choosing another.");
        return;
      }
      task.priorityDate = todayISO();
    }

    saveState();
    render();
  }

  function rescheduleTask(id, date) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.completed) return;
    if (!validDate(date)) {
      alert("Please use a valid date, such as 2026-11-11.");
      return;
    }

    if (task.repeat === "days") {
      date = matchingWeekday(date, task.repeatDays || []);
    }
    task.date = date;
    task.priorityDate = "";
    task.updatedAt = Date.now();
    saveState();
    render();
    showToast(`Rescheduled to ${prettyDate(date)}.`);
  }

  function resumeTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.completed) return;

    task.status = "active";
    task.holdReason = "";
    if (task.date && task.date < todayISO()) {
      task.date = task.repeat === "days"
        ? matchingWeekday(todayISO(), task.repeatDays || [])
        : todayISO();
    }
    task.updatedAt = Date.now();
    saveState();
    render();
    showToast("Task resumed.");
  }

  function handleDelegatedClick(event) {
    const action = event.target.closest("[data-task-action]");
    if (action) {
      const id = action.dataset.taskId;
      if (action.dataset.taskAction === "pin") togglePriority(id);
      if (action.dataset.taskAction === "tomorrow") {
        rescheduleTask(id, dateShift(todayISO(), 1));
      }
      if (action.dataset.taskAction === "date") {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        const answer = prompt("New date: YYYY-MM-DD", task.date || todayISO());
        if (answer !== null) rescheduleTask(id, answer.trim());
      }
      if (action.dataset.taskAction === "resume") resumeTask(id);
      return;
    }

    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      const task = state.tasks.find(t => t.id === edit.dataset.edit);
      if (task?.completed && task.repeat && task.repeat !== "none") {
        alert("Edit the next unfinished occurrence to change this repeating task.");
      } else if (task) {
        openTaskDialog(task);
      }
    } else if (del) {
      deleteTask(del.dataset.delete);
    }
  }

  function exportBackup() {
    const blob = new Blob([
      JSON.stringify({
        app: "My Daily Planner",
        exportedAt: new Date().toISOString(),
        data: state
      }, null, 2)
    ], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-daily-planner-backup-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data || parsed;
      if (
        !data || !Array.isArray(data.tasks) ||
        typeof data.settings !== "object"
      ) {
        throw new Error("This file doesn't look like a planner backup.");
      }
      if (!confirm(
        "Import this backup and replace the planner data currently on this phone? Export your current data first if you may need it."
      )) return;

      state = {
        ...blankState(),
        ...data,
        settings: {
          ...blankState().settings,
          ...(data.settings || {})
        },
        routineChecks: data.routineChecks || {}
      };

      render();
      saveState();
      showToast("Backup imported.");
    } catch (err) {
      alert(`Could not import backup: ${err.message}`);
    } finally {
      $("importInput").value = "";
    }
  }

  function resetAll() {
    if (!confirm(
      "Reset every task, routine check and setting on this phone? Export a backup first if you want to keep your data."
    )) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    state = blankState();
    render();
    saveState();
    showToast("Planner reset.");
  }

  // Today's top three
  const prioritySection = document.createElement("section");
  prioritySection.style.marginTop = "24px";
  prioritySection.innerHTML = `
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">FOCUS FOR TODAY</p>
        <h3>Today's top three</h3>
      </div>
      <span id="topThreeCount" class="muted"></span>
    </div>
    <p class="muted" style="font-size:.82rem">
      Choose ☆ Top three on a task to pin it here.
      Your choices reset each day.
    </p>
    <div id="topThreeTasks" class="task-list"></div>
    <p id="topThreeEmpty" class="muted">
      Pick up to three things that matter most today.
    </p>
  `;
   prioritySection.style.marginTop = "0";
  $("view-today").prepend(prioritySection);

  // Task status fields
  const statusControls = document.createElement("div");
  statusControls.innerHTML = `
    <label class="field-label" for="taskStatus">Status</label>
    <select id="taskStatus" class="field-input">
      <option value="active">Active</option>
      <option value="waiting">Waiting on</option>
      <option value="hold">On hold</option>
    </select>
    <div id="holdReasonFields" class="hidden">
      <label class="field-label" for="taskHoldReason">
        What are you waiting for? (optional)
      </label>
      <input id="taskHoldReason" class="field-input" type="text"
        maxlength="200"
        placeholder="Supplies, another person, or arriving in America…">
      <p class="muted" style="font-size:.8rem">
        Paused tasks stay in Task tracker and do not count toward
        today's outstanding tasks.
      </p>
    </div>
  `;
  $("taskNotes").previousElementSibling.before(statusControls);

  function updateHoldReason() {
    $("holdReasonFields").classList.toggle(
      "hidden", $("taskStatus").value === "active"
    );
  }
  $("taskStatus").addEventListener("change", updateHoldReason);

  // Journal check-in
  const journalPrompts = [
    "What went well today, even if it was something small?",
    "What felt difficult, and what support would help?",
    "What would you like your PB and MB to understand about today?",
    "What helped you feel more settled or confident today?",
    "What is one manageable next step you can take tomorrow?"
  ];

  const journalLink = document.querySelector(
    'a[href^="https://docs.google.com/document/"]'
  );

  if (journalLink) {
    const journalCard = document.createElement("div");
    journalCard.className = "settings-card";
    journalCard.style.marginTop = "18px";
    journalCard.innerHTML = `
      <p class="eyebrow">JOURNAL CHECK-IN</p>
      <p id="journalPrompt" style="line-height:1.5"></p>
      <button id="nextJournalPrompt" class="text-button" type="button">
        Try another prompt
      </button>
      <p class="muted" style="font-size:.8rem;margin-bottom:0">
        Use the shared journal button below to write your reflection.
      </p>
    `;
    journalLink.before(journalCard);

    $("nextJournalPrompt").addEventListener("click", () => {
      state.journalPromptChoice = {
        date: todayISO(),
        index: (journalPromptIndex() + 1) % journalPrompts.length
      };
      saveState();
      renderJournalPrompt();
    });
  }

  function journalPromptIndex() {
    const choice = state.journalPromptChoice;
    if (choice?.date === todayISO() && Number.isInteger(choice.index)) {
      return ((choice.index % journalPrompts.length) +
        journalPrompts.length) % journalPrompts.length;
    }
    return Math.floor(
      new Date(`${todayISO()}T12:00:00Z`).getTime() / 86400000
    ) % journalPrompts.length;
  }

  function renderJournalPrompt() {
    if ($("journalPrompt")) {
      $("journalPrompt").textContent = journalPrompts[journalPromptIndex()];
    }
  }

  // Recurring task schedules
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function matchingWeekday(date, days) {
    const valid = days.filter(day =>
      Number.isInteger(day) && day >= 0 && day <= 6
    );
    if (!valid.length) return date;
    for (let offset = 0; offset < 7; offset++) {
      const candidate = dateShift(date, offset);
      if (valid.includes(new Date(`${candidate}T12:00:00`).getDay())) {
        return candidate;
      }
    }
    return date;
  }

  function nextRepeatDate(task) {
    const base = task.date && task.date > todayISO()
      ? task.date : todayISO();

    if (task.repeat === "daily") return dateShift(base, 1);
    if (task.repeat === "weekly") {
      const weekday = new Date(`${task.date || base}T12:00:00`).getDay();
      return matchingWeekday(dateShift(base, 1), [weekday]);
    }
    if (task.repeat === "days" && task.repeatDays?.length) {
      return matchingWeekday(dateShift(base, 1), task.repeatDays);
    }
    return null;
  }

  function repeatLabel(task) {
    if (task.repeat === "daily") return "Daily";
    if (task.repeat === "weekly") return "Weekly";
    return (task.repeatDays || []).map(day => weekdayNames[day]).join(", ");
  }

  const repeatControls = document.createElement("div");
  repeatControls.innerHTML = `
    <label class="field-label" for="taskRepeat">Repeat</label>
    <select id="taskRepeat" class="field-input">
      <option value="none">Doesn't repeat</option>
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="days">Selected weekdays</option>
    </select>
    <fieldset id="repeatDayChoices" class="hidden"
      style="border:1px solid var(--line);border-radius:11px;margin:12px 0;padding:12px">
      <legend>Repeat on</legend>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        ${[1, 2, 3, 4, 5, 6, 0].map(day => `
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" data-repeat-day value="${day}">
            ${weekdayNames[day]}
          </label>
        `).join("")}
      </div>
    </fieldset>
    <p class="muted" style="font-size:.8rem">
      Completing a repeating task saves that completion and schedules
      its next date. An unfinished occurrence stays open until you
      complete or reschedule it.
    </p>
  `;
  $("taskNotes").previousElementSibling.before(repeatControls);

  function updateRepeatDays() {
    $("repeatDayChoices").classList.toggle(
      "hidden", $("taskRepeat").value !== "days"
    );
  }
  $("taskRepeat").addEventListener("change", updateRepeatDays);

  // Navigation and task events
  document.querySelectorAll(".tab").forEach(btn =>
    btn.addEventListener("click", () => switchView(btn.dataset.view))
  );

  ["addTaskTop", "addTaskInline", "addTaskPage"].forEach(id =>
    $(id).addEventListener("click", () => openTaskDialog())
  );

  $("taskForm").addEventListener("submit", saveTaskFromForm);
  $("closeDialog").addEventListener("click", () => $("taskDialog").close());
  $("cancelTask").addEventListener("click", () => $("taskDialog").close());

  $("taskDialog").addEventListener("click", event => {
    if (event.target === $("taskDialog")) $("taskDialog").close();
  });
  $("taskDialog").addEventListener("close", () => {
    if (currentView === "today") $("addTaskTop").focus();
  });

  $("view-today").addEventListener("click", handleDelegatedClick);
  $("view-tasks").addEventListener("click", handleDelegatedClick);

  document.addEventListener("change", event => {
    const taskCheck = event.target.closest("[data-complete]");
    const routineCheck = event.target.closest("[data-routine]");
    if (taskCheck) {
      toggleTask(taskCheck.dataset.complete, taskCheck.checked);
    }
    if (routineCheck) {
      toggleRoutine(routineCheck.dataset.routine, routineCheck.checked);
    }
  });

  $("taskFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    taskFilter = button.dataset.filter;
    renderTasks();
    $("deleteCategoryTab").disabled = taskFilter === "all";
  });

  $("hotWeatherToggle").addEventListener("change", event => {
    state.settings.hotWeather = event.target.checked;
    saveState();
    render();
  });
  $("breaksToggle").addEventListener("change", event => {
    state.settings.breaks = event.target.checked;
    saveState();
    render();
  });
  $("darkToggle").addEventListener("change", event => {
    state.settings.dark = event.target.checked;
    saveState();
    render();
  });
  $("themeToggle").addEventListener("click", () => {
    state.settings.dark = !state.settings.dark;
    saveState();
    render();
  });
  $("dismissWeather").addEventListener("click", () => {
    $("weatherBanner").classList.add("hidden");
  });
  $("exportButton").addEventListener("click", exportBackup);
  $("importInput").addEventListener("change", event =>
    importBackup(event.target.files && event.target.files[0])
  );
  $("resetButton").addEventListener("click", resetAll);

  // Custom category tabs
  const defaultTabLabels = { ...CATEGORY_LABELS };
  const defaultTabIcons = { ...CATEGORY_ICONS };

  function syncCustomTabs() {
    if (!Array.isArray(state.customTabs) || !state.customTabs.length) {
      state.customTabs = Object.entries(defaultTabLabels).map(
        ([id, name]) => ({
          id, name, icon: defaultTabIcons[id] || "📁"
        })
      );
    }

    for (const task of state.tasks) {
      if (
        task.category &&
        !state.customTabs.some(tab => tab.id === task.category)
      ) {
        state.customTabs.push({
          id: task.category,
          name: defaultTabLabels[task.category] || "Recovered category",
          icon: defaultTabIcons[task.category] || "📁"
        });
      }
    }

    Object.keys(CATEGORY_LABELS).forEach(key => {
      delete CATEGORY_LABELS[key];
    });
    Object.keys(CATEGORY_ICONS).forEach(key => {
      delete CATEGORY_ICONS[key];
    });

    state.customTabs.forEach(tab => {
      CATEGORY_LABELS[tab.id] = tab.name;
      CATEGORY_ICONS[tab.id] = tab.icon || "📁";
    });

    if (
      taskFilter !== "all" &&
      !state.customTabs.some(tab => tab.id === taskFilter)
    ) {
      taskFilter = "all";
    }

    $("taskFilters").innerHTML =
      '<button class="filter-chip" data-filter="all" type="button">All</button>' +
      state.customTabs.map(tab => `
        <button class="filter-chip" type="button"
          data-filter="${escapeHTML(tab.id)}">
          ${escapeHTML(tab.name)}
        </button>
      `).join("");

    const selectedCategory = $("taskCategory").value;
    $("taskCategory").innerHTML = state.customTabs.map(tab => `
      <option value="${escapeHTML(tab.id)}">
        ${escapeHTML(tab.name)}
      </option>
    `).join("");

    if (state.customTabs.some(tab => tab.id === selectedCategory)) {
      $("taskCategory").value = selectedCategory;
    }
    $("deleteCategoryTab").disabled = taskFilter === "all";
  }

  const tabControls = document.createElement("div");
  tabControls.className = "button-stack";
  tabControls.style.marginBottom = "16px";
  tabControls.innerHTML = `
    <button id="addCategoryTab" class="secondary-button" type="button">
      ＋ Add tab
    </button>
    <button id="deleteCategoryTab" class="secondary-button" type="button">
      Delete selected tab
    </button>
  `;
  $("taskFilters").after(tabControls);

  $("addCategoryTab").addEventListener("click", () => {
    const answer = prompt("What would you like to name your new tab?");
    if (answer === null) return;
    const name = answer.trim();
    if (!name) return;

    if (
      name.toLowerCase() === "all" ||
      state.customTabs.some(tab =>
        tab.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      alert("Please choose a different tab name.");
      return;
    }

    const id = `category-${uid()}`;
    state.customTabs.push({ id, name, icon: "📁" });
    taskFilter = id;
    saveState();
    render();
    showToast("Tab added.");
  });

  $("deleteCategoryTab").addEventListener("click", () => {
    if (taskFilter === "all") return;
    if (state.customTabs.length === 1) {
      alert("Keep at least one category. Add another tab first.");
      return;
    }

    const selected = state.customTabs.find(tab => tab.id === taskFilter);
    if (!selected) return;
    const destination = state.customTabs.find(tab => tab.id !== selected.id);
    const taskCount = state.tasks.filter(
      task => task.category === selected.id
    ).length;
    const message = taskCount
      ? `Delete "${selected.name}"? Its ${taskCount} task(s) will move to "${destination.name}".`
      : `Delete "${selected.name}"?`;

    if (!confirm(message)) return;
    state.tasks.forEach(task => {
      if (task.category === selected.id) task.category = destination.id;
    });
    state.customTabs = state.customTabs.filter(tab => tab.id !== selected.id);
    taskFilter = "all";
    saveState();
    render();
    showToast("Tab deleted.");
  });

  // Editable daily routines
  function ensureEditableRoutines() {
    if (!Array.isArray(state.routines)) {
      state.routines = ROUTINE.map(item => ({
        ...item, startDate: RETURN_DATE
      }));
    }
  }

  function getActiveRoutine() {
    ensureEditableRoutines();
    return state.routines.filter(item =>
      !item.startDate || item.startDate <= todayISO()
    );
  }

  function editDailyRoutine(id = null) {
    ensureEditableRoutines();
    const existing = state.routines.find(item => item.id === id);

    const name = prompt("Routine name:", existing?.title || "");
    if (name === null || !name.trim()) return;
    const time = prompt(
      "Time or time window (for example 8:00 AM):",
      existing?.time || ""
    );
    if (time === null) return;
    const start = prompt(
      "Start date: YYYY-MM-DD", existing?.startDate || todayISO()
    );
    if (start === null) return;

    const startDate = start.trim();
    if (!validDate(startDate)) {
      alert("Please use a valid date, such as 2026-11-11.");
      return;
    }

    const detail = prompt("Optional note:", existing?.detail || "");
    if (detail === null) return;
    const item = {
      id: existing ? existing.id : `routine-${uid()}`,
      title: name.trim(),
      time: time.trim(),
      detail: detail.trim(),
      startDate,
      category: "routine"
    };

    if (existing) {
      state.routines = state.routines.map(r => r.id === id ? item : r);
    } else {
      state.routines.push(item);
    }
    saveState();
    render();
    showToast(existing ? "Routine updated." : "Routine added.");
  }

  function renderRoutine() {
    ensureEditableRoutines();
    const checks = state.routineChecks[todayISO()] || {};

    const rows = state.routines.map(item => {
      const active = !item.startDate || item.startDate <= todayISO();
      const done = active && !!checks[item.id];
      const id = escapeHTML(item.id);
      const title = escapeHTML(item.title);

      return `
        <article class="task-card ${done ? "completed" : ""}">
          ${active ? `
            <input class="task-check" type="checkbox"
              data-routine="${id}" ${done ? "checked" : ""}
              aria-label="Mark ${title} complete">
          ` : `
            <span class="summary-icon" aria-hidden="true">◷</span>
          `}
          <div class="task-main">
            <div class="task-title">${title}</div>
            <div class="task-meta">
              ${item.time ? `
                <span class="time-tag">${escapeHTML(item.time)}</span>
              ` : ""}
              <span class="category-tag">
                ${active ? "Daily routine" : "Upcoming"}
              </span>
            </div>
            ${!active ? `
              <p class="task-notes">
                Starts ${escapeHTML(prettyDate(item.startDate))}
              </p>
            ` : ""}
            ${item.detail ? `
              <p class="task-notes">${escapeHTML(item.detail)}</p>
            ` : ""}
          </div>
          <div class="task-actions">
            <button class="task-action" type="button"
              data-routine-edit="${id}"
              aria-label="Edit ${title}">✎</button>
            <button class="task-action" type="button"
              data-routine-delete="${id}"
              aria-label="Delete ${title}">×</button>
          </div>
        </article>
      `;
    }).join("");

    const breaks = state.settings.breaks ? `
      <article class="task-card">
        <div class="summary-icon">☕</div>
        <div class="task-main">
          <div class="task-title">Flexible break</div>
          <p class="task-notes">
            Pause, stretch, or drink some water when it suits your day.
          </p>
        </div>
      </article>
    ` : "";

    $("scheduleList").innerHTML = `
      <div class="button-stack">
        <button class="secondary-button" type="button"
          data-routine-add>＋ Add routine</button>
      </div>
      ${rows}
      ${breaks}
    `;
  }

  $("scheduleList").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.hasAttribute("data-routine-add")) editDailyRoutine();
    if (button.hasAttribute("data-routine-edit")) {
      editDailyRoutine(button.dataset.routineEdit);
    }
    if (button.hasAttribute("data-routine-delete")) {
      const id = button.dataset.routineDelete;
      const item = state.routines.find(r => r.id === id);
      if (!item || !confirm(`Delete the daily routine "${item.title}"?`)) {
        return;
      }
      state.routines = state.routines.filter(r => r.id !== id);
      saveState();
      render();
      showToast("Routine deleted.");
    }
  });

  render();
  saveState();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").then(() => {
      $("offlineStatus").textContent =
        "Offline support is ready after the first successful load.";
    }).catch(() => {
      $("offlineStatus").textContent =
        "Offline support could not be enabled in this browser.";
    });
  } else {
    $("offlineStatus").textContent =
      "Offline support requires the site to be served over HTTPS (GitHub Pages provides this).";
  }
})();
