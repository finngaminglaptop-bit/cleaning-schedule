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
  let formRepeats = "repeat";
  let formFrequency = "daily";
  let formWeekday = WEEKDAYS[0].value;
  let formMonthDay = 1;
  let formOneTimeDate = "";

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

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
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

  // Finds the most recent weekly/monthly occurrence strictly before `before`,
  // used to detect a missed instance that should carry over as "delayed".
  // (Daily tasks are handled separately by missedStreakDays.)
  function previousOccurrence(task, before) {
    const created = startOfDay(new Date(task.createdAt));
    const d = new Date(before);

    if (task.frequency === "weekly") {
      for (let i = 0; i < 7; i++) {
        d.setDate(d.getDate() - 1);
        if (d.getDay() === task.weekday) return d < created ? null : new Date(d);
      }
      return null;
    }
    if (task.frequency === "monthly") {
      for (let i = 0; i < 366; i++) {
        d.setDate(d.getDate() - 1);
        const dim = daysInMonth(d.getFullYear(), d.getMonth());
        if (d.getDate() === Math.min(task.monthDay, dim)) return d < created ? null : new Date(d);
      }
      return null;
    }
    return null;
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

  // Builds { task, effectiveDate, delayDays } entries for a given calendar date.
  // effectiveDate is what toggling "done" applies to (may be an earlier missed
  // occurrence that carried over). includeCarryover should only be true for
  // "today" — past/future days show the plain schedule.
  function entriesForDate(date, { includeCarryover }) {
    const iso = toISODate(date);
    const entries = [];

    tasks.forEach((task) => {
      if (!task.repeats) {
        const key = completionKey(task, date);
        const completedOn = completions[key];
        if (completedOn) {
          if (completedOn === iso || task.dueDate === iso) {
            entries.push({ task, effectiveDate: date, delayDays: null });
          }
          return;
        }
        if (task.dueDate === iso) {
          entries.push({ task, effectiveDate: date, delayDays: null });
        } else if (includeCarryover && task.dueDate < iso) {
          entries.push({ task, effectiveDate: date, delayDays: daysBetween(new Date(task.dueDate), date) });
        }
        return;
      }

      if (task.frequency === "daily") {
        // Daily tasks are always due today; a miss on a prior day can't be
        // "made up", so just annotate today's card with how many days in a
        // row were skipped rather than replacing it with a past instance.
        const delayDays = includeCarryover ? missedStreakDays(task, date) : 0;
        entries.push({ task, effectiveDate: date, delayDays: delayDays || null });
        return;
      }

      if (occursOn(task, date)) {
        entries.push({ task, effectiveDate: date, delayDays: null });
        return;
      }

      if (includeCarryover) {
        const prev = previousOccurrence(task, date);
        if (prev && !completions[completionKey(task, prev)]) {
          entries.push({ task, effectiveDate: prev, delayDays: daysBetween(prev, date) });
        }
      }
    });

    return entries;
  }

  // Counts consecutive prior days a daily task was due but not completed,
  // stopping at the first completed day or the task's creation date.
  function missedStreakDays(task, today) {
    const created = startOfDay(new Date(task.createdAt));
    const d = new Date(today);
    let count = 0;
    while (true) {
      d.setDate(d.getDate() - 1);
      if (d < created || count > 365) break;
      if (completions[completionKey(task, d)]) break;
      count++;
    }
    return count;
  }

  function toggleDone(task, effectiveDate) {
    const key = completionKey(task, effectiveDate);
    if (!task.repeats) {
      if (completions[key]) delete completions[key];
      else completions[key] = toISODate(startOfDay(new Date()));
    } else {
      if (completions[key]) delete completions[key];
      else completions[key] = true;
    }
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

  function renderTaskCard(entry, { showPeriodPill }) {
    const { task, effectiveDate, delayDays } = entry;
    const done = isDone(task, effectiveDate);

    const showDelay = delayDays && !done;
    const card = el("div", "task-card" + (done ? " done" : "") + (showDelay ? " delayed" : ""));

    const check = el("button", "task-check" + (done ? " done" : ""));
    check.type = "button";
    check.setAttribute("aria-label", done ? "Mark not done" : "Mark done");
    check.textContent = done ? "✓" : "";
    check.addEventListener("click", () => toggleDone(task, effectiveDate));
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
    if (!task.repeats) meta.appendChild(el("span", "task-pill", "One-time"));
    body.appendChild(meta);

    if (showDelay) {
      body.appendChild(el("div", "delay-note", `Delayed by ${delayDays} day${delayDays === 1 ? "" : "s"}`));
    }

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
    const entries = entriesForDate(today, { includeCarryover: true });

    PERIODS.forEach((period) => {
      const items = entries.filter((e) => e.task.period === period.key);
      if (!items.length) return;
      const group = el("div", "period-group");
      group.appendChild(el("h2", null, period.label));
      items.forEach((entry) => group.appendChild(renderTaskCard(entry, { showPeriodPill: false })));
      container.appendChild(group);
    });

    if (!entries.length && tasks.length) {
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

      const entries = entriesForDate(date, { includeCarryover: isToday }).sort(
        (a, b) => PERIODS.findIndex((p) => p.key === a.task.period) - PERIODS.findIndex((p) => p.key === b.task.period)
      );

      if (!entries.length) {
        section.appendChild(el("p", "no-tasks", "Nothing scheduled"));
      } else {
        entries.forEach((entry) => section.appendChild(renderTaskCard(entry, { showPeriodPill: true })));
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

  function refreshRepeatsFields() {
    const isOnce = formRepeats === "once";
    document.getElementById("frequencyField").classList.toggle("hidden", isOnce);
    document.getElementById("weekdayField").classList.toggle("hidden", isOnce || formFrequency !== "weekly");
    document.getElementById("monthdayField").classList.toggle("hidden", isOnce || formFrequency !== "monthly");
    document.getElementById("oneTimeDateField").classList.toggle("hidden", !isOnce);
  }

  function refreshRepeatsHint() {
    const hint = document.getElementById("repeatsHint");
    hint.textContent =
      formRepeats === "repeat"
        ? "This task keeps coming back on its schedule."
        : "Pick the exact day you'll do this — it stays marked done afterward.";
  }

  function resetForm() {
    editingId = null;
    formIcon = { type: "emoji", value: ICONS[0].emoji };
    formDuration = DURATIONS[1];
    formPeriod = "morning";
    formRepeats = "repeat";
    formFrequency = "daily";
    formWeekday = WEEKDAYS[0].value;
    formMonthDay = new Date().getDate();
    formOneTimeDate = toISODate(new Date());
    document.getElementById("taskName").value = "";
    document.getElementById("taskDesc").value = "";
    document.getElementById("monthDayInput").value = String(formMonthDay);
    document.getElementById("oneTimeDateInput").value = formOneTimeDate;
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
    buildSegmented(document.getElementById("repeatsSeg"), REPEATS, formRepeats, (key) => {
      formRepeats = key;
      populateFormUI();
    });
    buildSegmented(document.getElementById("frequencySeg"), FREQUENCIES, formFrequency, (key) => {
      formFrequency = key;
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
    refreshRepeatsFields();
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
      formRepeats = task.repeats ? "repeat" : "once";
      formFrequency = task.frequency || "daily";
      formWeekday = task.weekday ?? WEEKDAYS[0].value;
      formMonthDay = task.monthDay ?? new Date().getDate();
      formOneTimeDate = task.dueDate || toISODate(new Date());
      document.getElementById("monthDayInput").value = String(formMonthDay);
      document.getElementById("oneTimeDateInput").value = formOneTimeDate;
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
    const repeats = formRepeats === "repeat";

    const base = {
      name,
      description,
      icon: formIcon,
      duration: formDuration,
      period: formPeriod,
      repeats,
    };

    if (repeats) {
      base.frequency = formFrequency;
      base.weekday = formFrequency === "weekly" ? formWeekday : undefined;
      base.monthDay = formFrequency === "monthly" ? monthDay : undefined;
      base.dueDate = undefined;
    } else {
      base.dueDate = document.getElementById("oneTimeDateInput").value || toISODate(new Date());
      base.frequency = undefined;
      base.weekday = undefined;
      base.monthDay = undefined;
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

  /* ---------- house code (sharing UI shell) ---------- */

  function openHouseSheet() {
    const content = document.getElementById("houseContent");
    content.innerHTML = "";
    content.appendChild(
      el(
        "p",
        "house-note",
        "Share your schedule with everyone in your household using a short code — anyone with the code sees the same tasks."
      )
    );

    const options = el("div", "house-options");
    const createBtn = el("button", "btn primary", "Create a household");
    createBtn.type = "button";
    const joinBtn = el("button", "btn secondary", "Join with a code");
    joinBtn.type = "button";
    options.appendChild(createBtn);
    options.appendChild(joinBtn);
    content.appendChild(options);

    const pending = el(
      "p",
      "house-note hidden",
      "Not connected yet — sharing tasks needs a small cloud database to sync between phones. Ask to have this wired up once that's set up."
    );
    content.appendChild(pending);

    [createBtn, joinBtn].forEach((btn) => btn.addEventListener("click", () => pending.classList.remove("hidden")));

    document.getElementById("houseOverlay").classList.remove("hidden");
  }

  function closeHouseSheet() {
    document.getElementById("houseOverlay").classList.add("hidden");
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
    document.getElementById("oneTimeDateInput").addEventListener("change", (e) => {
      formOneTimeDate = e.target.value || formOneTimeDate;
    });

    document.getElementById("houseCodeBtn").addEventListener("click", openHouseSheet);
    document.getElementById("closeHouseSheet").addEventListener("click", closeHouseSheet);
    document.getElementById("houseOverlay").addEventListener("click", (e) => {
      if (e.target.id === "houseOverlay") closeHouseSheet();
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
