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
  const CATEGORY_ICONS = { house: "🏠", practical: "🧰", website: "🌐", leadbright: "✨", personal: "🌿" };
  const ROUTINE = [
    { id: "feed-am", time: "8:00 AM", title: "Feed animals", detail: "Morning animal feeding", category: "routine" },
    { id: "feed-pm", time: "5:30 PM", title: "Feed animals", detail: "Evening animal feeding", category: "routine" },
    { id: "dinner", time: "6:00–7:00 PM", title: "Dinner", detail: "Make time to eat and reset", category: "routine" }
  ];

  const $ = (id) => document.getElementById(id);
  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  };
  const dateShift = (iso, days) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const startOfWeek = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const prettyDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  const escapeHTML = (str) => String(str ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

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
        ...blankState(), ...data,
        settings: { ...blankState().settings, ...(data.settings || {}) },
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
  function isActive(task) { return !task.completed; }
  function getTodayTasks() {
    return state.tasks.filter(t => t.date === todayISO() || (!t.date && t.createdDate <= todayISO()));
  }
  function taskCard(task, withDate = false) {
    const category = CATEGORY_LABELS[task.category] || "Personal";
    const done = !!task.completed;
    return `<article class="task-card ${done ? "completed" : ""}" data-task-card="${escapeHTML(task.id)}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(task.title)} complete" data-complete="${escapeHTML(task.id)}" ${done ? "checked" : ""}>
      <div class="task-main">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta"><span class="category-tag">${CATEGORY_ICONS[task.category] || "🌿"} ${escapeHTML(category)}</span>${withDate && task.date ? `<span class="date-tag">${escapeHTML(task.date)}</span>` : ""}</div>
        ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ""}
      </div>
      <div class="task-actions"><button class="task-action" type="button" data-edit="${escapeHTML(task.id)}" aria-label="Edit task">✎</button><button class="task-action" type="button" data-delete="${escapeHTML(task.id)}" aria-label="Delete task">×</button></div>
    </article>`;
  }
  function getActiveRoutine() {
    return todayISO() >= RETURN_DATE ? ROUTINE : [];
  }
  function renderRoutine() {
    const routinesActive = todayISO() >= RETURN_DATE;
    const checks = state.routineChecks[todayISO()] || {};
    const rows = ROUTINE.map(item => {
      const done = routinesActive && !!checks[item.id];
      return `<article class="task-card ${done ? "completed" : ""}">
        ${routinesActive ? `<input class="task-check" type="checkbox" data-routine="${item.id}" aria-label="Mark ${item.title} complete" ${done ? "checked" : ""}>` : `<span class="summary-icon" aria-hidden="true">◷</span>`}
        <div class="task-main"><div class="task-title">${item.title}</div><div class="task-meta"><span class="time-tag">${item.time}</span><span class="category-tag">${item.category === "routine" ? "Daily routine" : ""}</span></div><p class="task-notes">${item.detail}</p></div>
      </article>`;
    }).join("");
    const breaks = state.settings.breaks ? `<article class="task-card"><div class="summary-icon">☕</div><div class="task-main"><div class="task-title">Flexible break</div><p class="task-notes">Pause between tasks, stretch, drink water, or simply do nothing for a few minutes. Move this around to suit your day.</p></div></article>` : "";
    const upcoming = routinesActive ? "" : `<p class="muted">These routines start when you arrive in America on ${prettyDate(RETURN_DATE)}. They do not count toward today’s tasks or progress.</p>`;
    $("scheduleList").innerHTML = upcoming + rows + breaks;
  }
  function renderToday() {
    renderRoutine();
    const tasks = getTodayTasks().sort((a,b) => Number(a.completed)-Number(b.completed) || (a.createdAt||0)-(b.createdAt||0));
    $("todayTasks").innerHTML = tasks.map(t => taskCard(t)).join("");
    $("emptyToday").classList.toggle("hidden", tasks.length > 0);
    const checks = state.routineChecks[todayISO()] || {};
    const activeRoutine = getActiveRoutine();
    const routineDone = activeRoutine.filter(r => checks[r.id]).length;
    const done = tasks.filter(completedToday).length + routineDone;
    const total = tasks.length + activeRoutine.length;
    const remaining = Math.max(0, total - done);
    const pct = total ? Math.round(done/total*100) : 0;
    $("doneCount").textContent = done;
    $("remainingCount").textContent = remaining;
    $("dailyProgressBar").style.width = `${pct}%`;
    $("dailyProgressText").textContent = total ? `${pct}% complete · progress, not perfection.` : "No tasks scheduled for today · enjoy your day.";
    $("weatherBanner").classList.toggle("hidden", !state.settings.hotWeather);
  }
  function renderTasks() {
    const filtered = state.tasks.filter(t => taskFilter === "all" || t.category === taskFilter)
      .sort((a,b) => Number(a.completed)-Number(b.completed) || (a.date||"9999").localeCompare(b.date||"9999") || (b.createdAt||0)-(a.createdAt||0));
    $("allTasks").innerHTML = filtered.map(t => taskCard(t, true)).join("");
    $("emptyTasks").classList.toggle("hidden", filtered.length > 0);
    document.querySelectorAll("[data-filter]").forEach(btn => btn.classList.toggle("selected", btn.dataset.filter === taskFilter));
  }
  function renderProgress() {
    const weekStart = startOfWeek(todayISO());
    const weekEnd = dateShift(weekStart, 6);
    const createdThisWeek = state.tasks.filter(t => t.createdDate >= weekStart && t.createdDate <= weekEnd);
    const completedThisWeek = state.tasks.filter(t => t.completed && t.completedDate >= weekStart && t.completedDate <= weekEnd);
    const pct = createdThisWeek.length ? Math.round(completedThisWeek.length / createdThisWeek.length * 100) : (completedThisWeek.length ? 100 : 0);
    $("weeklyPercent").textContent = `${pct}% complete`;
    $("weeklyProgressBar").style.width = `${Math.min(100,pct)}%`;
    $("weeklySummary").textContent = completedThisWeek.length ? `You've completed ${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} this week. Keep the pace realistic.` : "A fresh week is a chance to choose a few useful next steps.";
    $("weekDone").textContent = completedThisWeek.length;
    $("weekAdded").textContent = createdThisWeek.length;
    let streak = 0;
    let cursor = todayISO();
    const hasCompletion = (date) => state.tasks.some(t => t.completed && t.completedDate === date) || Object.keys(state.routineChecks[date] || {}).some(k => state.routineChecks[date][k]);
    if (!hasCompletion(cursor)) cursor = dateShift(cursor, -1);
    while (hasCompletion(cursor) && streak < 365) { streak++; cursor = dateShift(cursor, -1); }
    $("streakCount").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
    $("activeProjects").textContent = new Set(state.tasks.filter(isActive).map(t => t.category)).size;
    $("categoryProgress").innerHTML = Object.entries(CATEGORY_LABELS).map(([key,label]) => {
      const items = state.tasks.filter(t => t.category === key && t.createdDate >= weekStart && t.createdDate <= weekEnd);
      const done = items.filter(t => t.completed && t.completedDate >= weekStart && t.completedDate <= weekEnd).length;
      const percent = items.length ? Math.round(done/items.length*100) : 0;
      return `<div><div class="category-line-head"><span>${CATEGORY_ICONS[key]} ${label}</span><span>${done}/${items.length} · ${percent}%</span></div><div class="category-track"><div style="width:${percent}%"></div></div></div>`;
    }).join("");
  }
  function renderSettings() {
    $("hotWeatherToggle").checked = !!state.settings.hotWeather;
    $("breaksToggle").checked = !!state.settings.breaks;
    $("darkToggle").checked = !!state.settings.dark;
    document.body.classList.toggle("dark", !!state.settings.dark);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", state.settings.dark ? "#101827" : "#234b91");
    }
    $("themeToggle").textContent = state.settings.dark ? "☼" : "◐";
  }
  function renderHeader() {
    const today = todayISO();
    $("todayLabel").textContent = prettyDate(today);
    const target = new Date(`${RETURN_DATE}T12:00:00`);
    const current = new Date(`${today}T12:00:00`);
    const diff = Math.round((target-current)/86400000);
    if (diff > 0) {
      $("countdownTitle").textContent = "Your next chapter is getting closer.";
      $("countdownNumber").textContent = diff;
      $("countdownText").textContent = "Build the habits that will help you arrive feeling prepared.";
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
    renderHeader();
    renderSettings();
    renderToday();
    renderTasks();
    renderProgress();
  }
  function switchView(view) {
    currentView = view;
    document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("hidden", el.id !== `view-${view}`));
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
    $("taskDate").value = task ? (task.date || todayISO()) : todayISO();
    $("taskNotes").value = task ? (task.notes || "") : "";
    $("taskDialog").showModal();
    setTimeout(() => $("taskTitle").focus(), 50);
  }
  function saveTaskFromForm(event) {
    event.preventDefault();
    const title = $("taskTitle").value.trim();
    if (!title) return;
    const id = $("taskId").value;
    const existing = state.tasks.find(t => t.id === id);
    const task = {
      id: id || uid(),
      title,
      category: $("taskCategory").value,
      date: $("taskDate").value || "",
      notes: $("taskNotes").value.trim(),
      completed: existing ? existing.completed : false,
      completedDate: existing ? existing.completedDate : "",
      createdDate: existing ? existing.createdDate : todayISO(),
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };
    if (existing) state.tasks = state.tasks.map(t => t.id === id ? task : t);
    else state.tasks.push(task);
    saveState();
    $("taskDialog").close();
    render();
    showToast(existing ? "Task updated." : "Task added.");
  }
  function toggleTask(id, checked) {
    state.tasks = state.tasks.map(t => t.id === id ? { ...t, completed: checked, completedDate: checked ? todayISO() : "" } : t);
    saveState(); render();
  }
  function toggleRoutine(id, checked) {
    const day = todayISO();
    if (!state.routineChecks[day]) state.routineChecks[day] = {};
    state.routineChecks[day][id] = checked;
    saveState(); render();
  }
  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Delete "${task.title}"? This cannot be undone unless you have a backup.`)) return;
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState(); render(); showToast("Task deleted.");
  }
  function handleDelegatedClick(event) {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) {
      const task = state.tasks.find(t => t.id === edit.dataset.edit);
      if (task) openTaskDialog(task);
    } else if (del) deleteTask(del.dataset.delete);
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: "My Daily Planner", exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-daily-planner-backup-${todayISO()}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data || parsed;
      if (!data || !Array.isArray(data.tasks) || typeof data.settings !== "object") throw new Error("This file doesn't look like a planner backup.");
      if (!confirm("Import this backup and replace the planner data currently on this phone? Export your current data first if you may need it.")) return;
      state = {
        ...blankState(), ...data,
        settings: { ...blankState().settings, ...(data.settings || {}) },
        routineChecks: data.routineChecks || {}
      };
      saveState(); render(); showToast("Backup imported.");
    } catch (err) {
      alert(`Could not import backup: ${err.message}`);
    } finally {
      $("importInput").value = "";
    }
  }
  function resetAll() {
    if (!confirm("Reset every task, routine check and setting on this phone? Export a backup first if you want to keep your data.")) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    state = blankState(); saveState(); render(); showToast("Planner reset.");
  }

  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  ["addTaskTop","addTaskInline","addTaskPage"].forEach(id => $(id).addEventListener("click", () => openTaskDialog()));
  $("taskForm").addEventListener("submit", saveTaskFromForm);
  $("closeDialog").addEventListener("click", () => $("taskDialog").close());
  $("cancelTask").addEventListener("click", () => $("taskDialog").close());
  $("taskDialog").addEventListener("click", event => { if (event.target === $("taskDialog")) $("taskDialog").close(); });
  $("taskDialog").addEventListener("close", () => { if (currentView === "today") $("addTaskTop").focus(); });
  $("taskDialog").addEventListener("change", () => {});
  $("view-today").addEventListener("click", handleDelegatedClick);
  $("view-tasks").addEventListener("click", handleDelegatedClick);
  document.addEventListener("change", event => {
    const taskCheck = event.target.closest("[data-complete]");
    const routineCheck = event.target.closest("[data-routine]");
    if (taskCheck) toggleTask(taskCheck.dataset.complete, taskCheck.checked);
    if (routineCheck) toggleRoutine(routineCheck.dataset.routine, routineCheck.checked);
  });
  $("taskFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    taskFilter = button.dataset.filter;
    renderTasks();
  });
  $("hotWeatherToggle").addEventListener("change", event => { state.settings.hotWeather = event.target.checked; saveState(); render(); });
  $("breaksToggle").addEventListener("change", event => { state.settings.breaks = event.target.checked; saveState(); render(); });
  $("darkToggle").addEventListener("change", event => { state.settings.dark = event.target.checked; saveState(); render(); });
  $("themeToggle").addEventListener("click", () => { state.settings.dark = !state.settings.dark; saveState(); render(); });
  $("dismissWeather").addEventListener("click", () => { $("weatherBanner").classList.add("hidden"); });
  $("exportButton").addEventListener("click", exportBackup);
  $("importInput").addEventListener("change", event => importBackup(event.target.files && event.target.files[0]));
  $("resetButton").addEventListener("click", resetAll);
        ([id, name]) => ({
          id,
          name,
          icon: defaultTabIcons[id] || "📁"
        })
      );
    }

    // Keep categories belonging to existing or imported tasks.
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
        <button class="filter-chip"
                data-filter="${escapeHTML(tab.id)}"
                type="button">
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
    <button id="addCategoryTab"
            class="secondary-button" type="button">
      ＋ Add tab
    </button>
    <button id="deleteCategoryTab"
            class="secondary-button" type="button">
      Delete selected tab
    </button>
  `;
  $("taskFilters").after(tabControls);

  const originalRender = render;
  render = function () {
    syncCustomTabs();
    originalRender();
  };

  const originalOpenTaskDialog = openTaskDialog;
  openTaskDialog = function (task = null) {
    originalOpenTaskDialog(task);
    if (!$("taskCategory").value) {
      $("taskCategory").value = state.customTabs[0].id;
    }
  };

  $("addCategoryTab").addEventListener("click", () => {
    const answer = prompt("What would you like to name your new tab?");
    if (answer === null) return;

    const name = answer.trim();
    if (!name) return;

    if (
      name.toLowerCase() === "all" ||
      state.customTabs.some(
        tab => tab.name.toLowerCase() === name.toLowerCase()
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
      if (task.category === selected.id) {
        task.category = destination.id;
      }
    });

    state.customTabs = state.customTabs.filter(
      tab => tab.id !== selected.id
    );
    taskFilter = "all";
    saveState();
    render();
    showToast("Tab deleted.");
  });

  $("taskFilters").addEventListener("click", () => {
    $("deleteCategoryTab").disabled = taskFilter === "all";
  });
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").then(() => {
      $("offlineStatus").textContent = "Offline support is ready after the first successful load.";
    }).catch(() => {
      $("offlineStatus").textContent = "Offline support could not be enabled in this browser.";
    });
  } else {
    $("offlineStatus").textContent = "Offline support requires the site to be served over HTTPS (GitHub Pages provides this).";
  }
})();
