(() => {
  "use strict";

  /* ---------- constants ---------- */

  const ICONS = [
    { key: "vacuum", emoji: "🧹", label: "Vacuum" },
    { key: "laundry", emoji: "🧺", label: "Laundry" },
    { key: "dishes", emoji: "🍽️", label: "Dishes" },
    { key: "mop", emoji: "🪣", label: "Mop" },
    { key: "bathroom", emoji: "🚿", label: "Bathroom" },
    { key: "dusting", emoji: "🧴", label: "Dusting" },
    { key: "bed", emoji: "🛏️", label: "Bedroom" },
    { key: "windows", emoji: "🪟", label: "Windows" },
    { key: "trash", emoji: "🗑️", label: "Trash" },
    { key: "kitchen", emoji: "🍳", label: "Kitchen" },
    { key: "plants", emoji: "🪴", label: "Plants" },
    { key: "pets", emoji: "🐾", label: "Pets" },
    { key: "shopping", emoji: "🛒", label: "Shopping" },
    { key: "ironing", emoji: "👕", label: "Ironing" },
    { key: "general", emoji: "✨", label: "General" },
  ];

  const DURATIONS = [5, 15, 30, 45, 60, 90, 120];

  const PERIODS = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
  ];

  // value matches Date#getDay() (0 = Sunday)
  const WEEKDAYS = [
    { key: "mon", label: "Mon", value: 1 },
    { key: "tue", label: "Tue", value: 2 },
    { key: "wed", label: "Wed", value: 3 },
    { key: "thu", label: "Thu", value: 4 },
    { key: "fri", label: "Fri", value: 5 },
    { key: "sat", label: "Sat", value: 6 },
    { key: "sun", label: "Sun", value: 0 },
  ];

  const FREQUENCIES = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  const REPEATS = [
    { key: "repeat", label: "Every time" },
    { key: "once", label: "Just once" },
  ];

  const TASKS_KEY = "cleaning-tasks";
  const COMPLETIONS_KEY = "cleaning-completions";

  /* ---------- state ---------- */

  let tasks = loadTasks();
  let completions = loadCompletions();
  let currentView = "daily";
  let editingId = null;

  // in-progress form selections
  let formIcon = { type: "emoji", value: ICONS[0].emoji };
  let formDuration = DURATIONS[1];
  let formPeriod = "morning";
  let formFrequency = "daily";
  let formWeekday = WEEKDAYS[0].value;
  let formMonthDay = 1;
  let formRepeats = "repeat";

  /* ---------- storage ---------- */

  function loadTasks() {
    try {
      return JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  function loadCompletions() {
    try {
      return JSON.parse(localStorage.getItem(COMPLETIONS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCompletions() {
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
  }

  /* ---------- date helpers ---------- */

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function clampMonthDay(year, month, day) {
    return Math.min(day, daysInMonth(year, month));
  }

  function isoWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNo = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-w${weekNo}`;
  }

  function mondayOfWeek(date) {
    const d = startOfDay(date);
    const diff = (d.getDay() + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  }

  function formatDayTitle(date) {
    return date.toLocaleDateString(navigator.language || "en-US", { weekday: "long" });
  }

  function formatDateSub(date) {
    return date.toLocaleDateString(navigator.language || "en-US", { month: "long", day: "numeric" });
  }

  function formatDuration(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  /* ---------- occurrence logic ---------- */

  function computeDueDate(frequency, weekday, monthDay, from) {
    const d = startOfDay(from);
    if (frequency === "daily") return toISODate(d);

    if (frequency === "weekly") {
      const diff = (weekday - d.getDay() + 7) % 7;
      const target = new Date(d);
      target.setDate(target.getDate() + diff);
      return toISODate(target);
    }

    // monthly
    let year = d.getFullYear();
    let month = d.getMonth();
    let day = clampMonthDay(year, month, monthDay);
    let target = new Date(year, month, day);
    if (target < d) {
      month += 1;
      day = clampMonthDay(year, month, monthDay);
      target = new Date(year, month, day);
    }
    return toISODate(target);
  }

  function occursOn(task, date) {
    if (!task.repeats) return toISODate(date) === task.dueDate;
    if (task.frequency === "daily") return true;
    if (task.frequency === "weekly") return date.getDay() === task.weekday;
    if (task.frequency === "monthly") {
      const dim = daysInMonth(date.getFullYear(), date.getMonth());
      return date.getDate() === Math.min(task.monthDay, dim);
    }
    return false;
  }

  function tasksForDate(date) {
    return tasks.filter((t) => occursOn(t, date));
  }

  function tasksForToday() {
    const today = startOfDay(new Date());
    return tasks.filter((t) => {
      if (!t.repeats) return t.dueDate <= toISODate(today);
      return occursOn(t, today);
    });
  }

  function completionKey(task, date) {
    if (!task.repeats) return `${task.id}:once`;
    if (task.frequency === "daily") return `${task.id}:${toISODate(date)}`;
    if (task.frequency === "weekly") return `${task.id}:${isoWeekKey(date)}`;
    return `${task.id}:${date.getFullYear()}-${date.getMonth()}`;
  }

  function isDone(task, date) {
    return !!completions[completionKey(task, date)];
  }

  function toggleDone(task, date, cardEl) {
    if (!task.repeats) {
      if (cardEl) {
        cardEl.style.opacity = "0";
        setTimeout(() => {
          tasks = tasks.filter((t) => t.id !== task.id);
          saveTasks();
          render();
        }, 150);
      } else {
        tasks = tasks.filter((t) => t.id !== task.id);
        saveTasks();
        render();
      }
      return;
    }
    const key = completionKey(task, date);
    if (completions[key]) delete completions[key];
    else completions[key] = true;
    saveCompletions();
    render();
  }

  /* ---------- rendering ---------- */

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function iconContent(icon) {
    if (icon && icon.type === "custom") {
      const img = document.createElement("img");
      img.src = icon.value;
      img.alt = "";
      return img;
    }
    const span = document.createElement("span");
    span.textContent = (icon && icon.value) || "✨";
    return span;
  }

  function renderTaskCard(task, date, { showPeriodPill }) {
    const done = isDone(task, date);
    const overdue = !task.repeats && task.dueDate < toISODate(startOfDay(new Date()));

    const card = el("div", "task-card" + (done ? " done" : "") + (overdue ? " overdue" : ""));

    const check = el("button", "task-check" + (done ? " done" : ""));
    check.type = "button";
    check.setAttribute("aria-label", done ? "Mark not done" : "Mark done");
    check.textContent = done ? "✓" : "";
    check.addEventListener("click", () => toggleDone(task, date, card));
    card.appendChild(check);

    const icon = el("div", "task-icon");
    icon.appendChild(iconContent(task.icon));
    card.appendChild(icon);

    const body = el("div", "task-body");
    body.appendChild(el("div", "task-name", task.name));

    const meta = el("div", "task-meta");
    if (task.duration) meta.appendChild(el("span", "task-pill", formatDuration(task.duration)));
    if (showPeriodPill) {
      const p = PERIODS.find((p) => p.key === task.period);
      if (p) meta.appendChild(el("span", "task-pill", p.label));
    }
    if (!task.repeats) meta.appendChild(el("span", "task-pill", overdue ? "One-time · overdue" : "One-time"));
    body.appendChild(meta);

    if (task.description) body.appendChild(el("div", "task-desc", task.description));
    card.appendChild(body);

    const actions = el("div", "task-actions");
    const editBtn = el("button", "icon-btn", "✎");
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.addEventListener("click", () => openSheet(task));
    actions.appendChild(editBtn);
    card.appendChild(actions);

    return card;
  }

  function renderDaily() {
    const container = document.getElementById("dailyView");
    container.innerHTML = "";
    const today = startOfDay(new Date());
    const todaysTasks = tasksForToday();

    PERIODS.forEach((period) => {
      const items = todaysTasks.filter((t) => t.period === period.key);
      if (!items.length) return;
      const group = el("div", "period-group");
      group.appendChild(el("h2", null, period.label));
      items.forEach((t) => group.appendChild(renderTaskCard(t, today, { showPeriodPill: false })));
      container.appendChild(group);
    });

    if (!todaysTasks.length && tasks.length) {
      container.appendChild(el("p", "no-tasks", "Nothing scheduled for today."));
    }

    document.getElementById("emptyState").classList.toggle("hidden", tasks.length !== 0);
  }

  function renderWeekly() {
    const container = document.getElementById("weeklyView");
    container.innerHTML = "";
    const monday = mondayOfWeek(new Date());
    const todayIso = toISODate(startOfDay(new Date()));

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const isToday = toISODate(date) === todayIso;

      const section = el("div", "day-section");
      const heading = el("h2");
      heading.appendChild(document.createTextNode(`${formatDayTitle(date)}, ${formatDateSub(date)}`));
      if (isToday) heading.appendChild(el("span", "today-pill", "Today"));
      section.appendChild(heading);

      const items = tasksForDate(date).sort(
        (a, b) => PERIODS.findIndex((p) => p.key === a.period) - PERIODS.findIndex((p) => p.key === b.period)
      );

      if (!items.length) {
        section.appendChild(el("p", "no-tasks", "Nothing scheduled"));
      } else {
        items.forEach((t) => section.appendChild(renderTaskCard(t, date, { showPeriodPill: true })));
      }

      container.appendChild(section);
    }

    document.getElementById("emptyState").classList.toggle("hidden", tasks.length !== 0);
  }

  function renderHeader() {
    const now = new Date();
    document.getElementById("dayTitle").textContent = formatDayTitle(now);
    document.getElementById("dateSub").textContent = formatDateSub(now);
  }

  function render() {
    renderHeader();
    if (currentView === "daily") renderDaily();
    else renderWeekly();
  }

  /* ---------- view toggle ---------- */

  function setView(view) {
    currentView = view;
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    document.getElementById("dailyView").classList.toggle("hidden", view !== "daily");
    document.getElementById("weeklyView").classList.toggle("hidden", view !== "weekly");
    render();
  }

  /* ---------- sheet (add / edit task) ---------- */

  function buildChipRow(container, items, getLabel, getKey, activeKey, onSelect) {
    container.innerHTML = "";
    items.forEach((item) => {
      const key = getKey(item);
      const chip = el("button", "chip" + (key === activeKey ? " active" : ""), getLabel(item));
      chip.type = "button";
      chip.addEventListener("click", () => onSelect(item));
      container.appendChild(chip);
    });
  }

  function buildSegmented(container, items, activeKey, onSelect) {
    container.innerHTML = "";
    items.forEach((item) => {
      const btn = el("button", "segmented-btn" + (item.key === activeKey ? " active" : ""), item.label);
      btn.type = "button";
      btn.addEventListener("click", () => onSelect(item.key));
      container.appendChild(btn);
    });
  }

  function renderIconGrid() {
    const grid = document.getElementById("iconGrid");
    grid.innerHTML = "";
    ICONS.forEach((icon) => {
      const isActive = formIcon.type === "emoji" && formIcon.value === icon.emoji;
      const tile = el("button", "icon-option" + (isActive ? " active" : ""));
      tile.type = "button";
      tile.setAttribute("aria-label", icon.label);
      tile.textContent = icon.emoji;
      tile.addEventListener("click", () => {
        formIcon = { type: "emoji", value: icon.emoji };
        renderIconGrid();
      });
      grid.appendChild(tile);
    });

    const isCustom = formIcon.type === "custom";
    const uploadTile = el("button", "icon-option upload-tile" + (isCustom ? " active" : ""));
    uploadTile.type = "button";
    uploadTile.setAttribute("aria-label", "Upload your own icon");
    if (isCustom) {
      const img = document.createElement("img");
      img.src = formIcon.value;
      img.alt = "";
      uploadTile.appendChild(img);
    } else {
      uploadTile.innerHTML = "📷<span class=\"upload-label\">Upload</span>";
    }
    uploadTile.addEventListener("click", () => document.getElementById("iconUpload").click());
    grid.appendChild(uploadTile);
  }

  function refreshFrequencyFields() {
    document.getElementById("weekdayField").classList.toggle("hidden", formFrequency !== "weekly");
    document.getElementById("monthdayField").classList.toggle("hidden", formFrequency !== "monthly");
  }

  function refreshRepeatsHint() {
    const hint = document.getElementById("repeatsHint");
    if (formRepeats === "repeat") {
      hint.textContent = "This task keeps coming back on its schedule.";
    } else {
      hint.textContent = "This task appears once on its next due date, then disappears once done.";
    }
  }

  function resetForm() {
    editingId = null;
    formIcon = { type: "emoji", value: ICONS[0].emoji };
    formDuration = DURATIONS[1];
    formPeriod = "morning";
    formFrequency = "daily";
    formWeekday = WEEKDAYS[0].value;
    formMonthDay = new Date().getDate();
    formRepeats = "repeat";
    document.getElementById("taskName").value = "";
    document.getElementById("taskDesc").value = "";
    document.getElementById("monthDayInput").value = String(formMonthDay);
    document.getElementById("deleteTaskBtn").classList.add("hidden");
    document.getElementById("sheetTitle").textContent = "New Task";
  }

  function populateFormUI() {
    renderIconGrid();
    buildChipRow(
      document.getElementById("durationChips"),
      DURATIONS,
      (m) => formatDuration(m),
      (m) => m,
      formDuration,
      (m) => {
        formDuration = m;
        populateFormUI();
      }
    );
    buildSegmented(document.getElementById("periodSeg"), PERIODS.map((p) => ({ key: p.key, label: p.label })), formPeriod, (key) => {
      formPeriod = key;
      populateFormUI();
    });
    buildSegmented(document.getElementById("frequencySeg"), FREQUENCIES, formFrequency, (key) => {
      formFrequency = key;
      refreshFrequencyFields();
      populateFormUI();
    });
    buildChipRow(
      document.getElementById("weekdayChips"),
      WEEKDAYS,
      (w) => w.label,
      (w) => w.value,
      formWeekday,
      (w) => {
        formWeekday = w.value;
        populateFormUI();
      }
    );
    buildSegmented(document.getElementById("repeatsSeg"), REPEATS, formRepeats, (key) => {
      formRepeats = key;
      refreshRepeatsHint();
      populateFormUI();
    });
    refreshFrequencyFields();
    refreshRepeatsHint();
  }

  function openSheet(task) {
    if (task) {
      editingId = task.id;
      document.getElementById("taskName").value = task.name;
      document.getElementById("taskDesc").value = task.description || "";
      formIcon = task.icon;
      formDuration = task.duration;
      formPeriod = task.period;
      formFrequency = task.frequency;
      formWeekday = task.weekday ?? WEEKDAYS[0].value;
      formMonthDay = task.monthDay ?? new Date().getDate();
      formRepeats = task.repeats ? "repeat" : "once";
      document.getElementById("monthDayInput").value = String(formMonthDay);
      document.getElementById("deleteTaskBtn").classList.remove("hidden");
      document.getElementById("sheetTitle").textContent = "Edit Task";
    } else {
      resetForm();
    }
    populateFormUI();
    document.getElementById("sheetOverlay").classList.remove("hidden");
  }

  function closeSheet() {
    document.getElementById("sheetOverlay").classList.add("hidden");
  }

  function handleIconUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      formIcon = { type: "custom", value: reader.result };
      renderIconGrid();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("taskName").value.trim();
    if (!name) return;
    const description = document.getElementById("taskDesc").value.trim();
    const monthDay = Math.min(31, Math.max(1, parseInt(document.getElementById("monthDayInput").value, 10) || 1));

    const base = {
      name,
      description,
      icon: formIcon,
      duration: formDuration,
      period: formPeriod,
      frequency: formFrequency,
      weekday: formFrequency === "weekly" ? formWeekday : undefined,
      monthDay: formFrequency === "monthly" ? monthDay : undefined,
      repeats: formRepeats === "repeat",
    };

    if (!base.repeats) {
      base.dueDate = computeDueDate(formFrequency, formWeekday, monthDay, new Date());
    }

    if (editingId) {
      tasks = tasks.map((t) => (t.id === editingId ? { ...t, ...base } : t));
    } else {
      tasks.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), ...base });
    }

    saveTasks();
    closeSheet();
    render();
  }

  function handleDelete() {
    if (!editingId) return;
    tasks = tasks.filter((t) => t.id !== editingId);
    saveTasks();
    closeSheet();
    render();
  }

  /* ---------- wiring ---------- */

  function init() {
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    document.getElementById("fabSchedule").addEventListener("click", () => openSheet(null));
    document.getElementById("closeSheet").addEventListener("click", closeSheet);
    document.getElementById("sheetOverlay").addEventListener("click", (e) => {
      if (e.target.id === "sheetOverlay") closeSheet();
    });
    document.getElementById("taskForm").addEventListener("submit", handleSubmit);
    document.getElementById("deleteTaskBtn").addEventListener("click", handleDelete);
    document.getElementById("iconUpload").addEventListener("change", handleIconUpload);

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
