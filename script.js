(() => {
  "use strict";

  /* ---------- constants ---------- */

  const ICONS = [
    { key: "vacuum", emoji: "🧹", label: "Stofzuigen" },
    { key: "laundry", emoji: "🧺", label: "Wasgoed" },
    { key: "dishes", emoji: "🍽️", label: "Afwas" },
    { key: "mop", emoji: "🪣", label: "Dweilen" },
    { key: "bathroom", emoji: "🚿", label: "Badkamer" },
    { key: "dusting", emoji: "🧴", label: "Stof afnemen" },
    { key: "bed", emoji: "🛏️", label: "Slaapkamer" },
    { key: "windows", emoji: "🪟", label: "Ramen" },
    { key: "trash", emoji: "🗑️", label: "Vuilnis" },
    { key: "kitchen", emoji: "🍳", label: "Keuken" },
    { key: "plants", emoji: "🪴", label: "Planten" },
    { key: "pets", emoji: "🐾", label: "Huisdieren" },
    { key: "shopping", emoji: "🛒", label: "Boodschappen" },
    { key: "ironing", emoji: "👕", label: "Strijken" },
    { key: "general", emoji: "✨", label: "Algemeen" },
  ];

  const DURATIONS = [5, 15, 30, 45, 60, 90, 120];

  const PERIODS = [
    { key: "morning", label: "Ochtend" },
    { key: "afternoon", label: "Middag" },
    { key: "evening", label: "Avond" },
  ];

  // value matches Date#getDay() (0 = Sunday)
  const WEEKDAYS = [
    { key: "mon", label: "Ma", value: 1 },
    { key: "tue", label: "Di", value: 2 },
    { key: "wed", label: "Wo", value: 3 },
    { key: "thu", label: "Do", value: 4 },
    { key: "fri", label: "Vr", value: 5 },
    { key: "sat", label: "Za", value: 6 },
    { key: "sun", label: "Zo", value: 0 },
  ];

  const FREQUENCIES = [
    { key: "daily", label: "Dagelijks" },
    { key: "weekly", label: "Wekelijks" },
    { key: "monthly", label: "Maandelijks" },
  ];

  const REPEATS = [
    { key: "repeat", label: "Elke keer" },
    { key: "once", label: "Eenmalig" },
  ];

  const TASKS_KEY = "cleaning-tasks";
  const COMPLETIONS_KEY = "cleaning-completions";
  const HOUSEHOLD_KEY = "cleaning-household";

  // Shared Firebase project also used by other apps (flashcard-maker,
  // all-you-can-play) — this app only touches its own "households" collection.
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBhJcLbM8mUqiULgmHUPZwr7so5n3pca8s",
    authDomain: "flashcard-maker-61023.firebaseapp.com",
    projectId: "flashcard-maker-61023",
    storageBucket: "flashcard-maker-61023.firebasestorage.app",
    messagingSenderId: "880797755117",
    appId: "1:880797755117:web:d5201d3a4caa8e8ae90ee4",
  };

  /* ---------- state ---------- */

  let tasks = loadTasks();
  let completions = loadCompletions();
  let currentView = "daily";
  let editingId = null;
  let householdCode = localStorage.getItem(HOUSEHOLD_KEY) || null;
  let householdUnsub = null;

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

  // Writes go to the shared household doc when connected, otherwise localStorage.
  function persistTasks() {
    if (householdCode) pushHouseholdState();
    else saveTasks();
  }

  function persistCompletions() {
    if (householdCode) pushHouseholdState();
    else saveCompletions();
  }

  /* ---------- household sync (Firestore) ---------- */

  let _fbCache = null;
  async function fbHousehold() {
    if (_fbCache) return _fbCache;
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");
    const app = initializeApp(FIREBASE_CONFIG);
    _fbCache = { db: fs.getFirestore(app), ...fs };
    return _fbCache;
  }

  function genHouseholdCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function pushHouseholdState() {
    if (!householdCode) return;
    try {
      const { db, doc, updateDoc } = await fbHousehold();
      await updateDoc(doc(db, "households", householdCode), { tasks, completions });
    } catch (err) {
      console.error("Synchroniseren met huishouden is mislukt", err);
    }
  }

  function startHouseholdListener(code) {
    stopHouseholdListener();
    fbHousehold().then(({ db, doc, onSnapshot }) => {
      householdUnsub = onSnapshot(doc(db, "households", code), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        tasks = data.tasks || [];
        completions = data.completions || {};
        render();
      });
    });
  }

  function stopHouseholdListener() {
    if (householdUnsub) {
      householdUnsub();
      householdUnsub = null;
    }
  }

  async function createHousehold() {
    const { db, doc, setDoc, serverTimestamp } = await fbHousehold();
    const code = genHouseholdCode();
    await setDoc(doc(db, "households", code), { code, createdAt: serverTimestamp(), tasks, completions });
    householdCode = code;
    localStorage.setItem(HOUSEHOLD_KEY, code);
    startHouseholdListener(code);
    return code;
  }

  async function joinHousehold(rawCode) {
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) throw new Error("empty");
    const { db, doc, getDoc } = await fbHousehold();
    const snap = await getDoc(doc(db, "households", code));
    if (!snap.exists()) throw new Error("not-found");
    householdCode = code;
    localStorage.setItem(HOUSEHOLD_KEY, code);
    startHouseholdListener(code);
  }

  function leaveHousehold() {
    stopHouseholdListener();
    householdCode = null;
    localStorage.removeItem(HOUSEHOLD_KEY);
    tasks = loadTasks();
    completions = loadCompletions();
    render();
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
    return date.toLocaleDateString("nl-NL", { weekday: "long" });
  }

  function formatDateSub(date) {
    return date.toLocaleDateString("nl-NL", { month: "long", day: "numeric" });
  }

  function formatDuration(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}u ${m}m` : `${h}u`;
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
    persistCompletions();
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
    check.setAttribute("aria-label", done ? "Markeer als niet gedaan" : "Markeer als gedaan");
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
    if (!task.repeats) meta.appendChild(el("span", "task-pill", "Eenmalig"));
    body.appendChild(meta);

    if (showDelay) {
      body.appendChild(el("div", "delay-note", `Vertraagd met ${delayDays} dag${delayDays === 1 ? "" : "en"}`));
    }

    if (task.description) body.appendChild(el("div", "task-desc", task.description));
    card.appendChild(body);

    const actions = el("div", "task-actions");
    const editBtn = el("button", "icon-btn", "✎");
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", "Taak bewerken");
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
      container.appendChild(el("p", "no-tasks", "Niets gepland voor vandaag."));
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
      if (isToday) heading.appendChild(el("span", "today-pill", "Vandaag"));
      section.appendChild(heading);

      const entries = entriesForDate(date, { includeCarryover: isToday }).sort(
        (a, b) => PERIODS.findIndex((p) => p.key === a.task.period) - PERIODS.findIndex((p) => p.key === b.task.period)
      );

      if (!entries.length) {
        section.appendChild(el("p", "no-tasks", "Niets gepland"));
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
    uploadTile.setAttribute("aria-label", "Eigen icoon uploaden");
    if (isCustom) {
      const img = document.createElement("img");
      img.src = formIcon.value;
      img.alt = "";
      uploadTile.appendChild(img);
    } else {
      uploadTile.innerHTML = "📷<span class=\"upload-label\">Uploaden</span>";
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
        ? "Deze taak blijft terugkomen volgens het schema."
        : "Kies de exacte dag waarop je dit gaat doen — hij blijft daarna als voltooid gemarkeerd.";
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
    document.getElementById("sheetTitle").textContent = "Nieuwe taak";
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
      document.getElementById("sheetTitle").textContent = "Taak bewerken";
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
      const img = new Image();
      img.onload = () => {
        // Downscale + compress so custom icons stay tiny — keeps localStorage
        // light and fits comfortably in a shared Firestore document.
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        formIcon = { type: "custom", value: canvas.toDataURL("image/jpeg", 0.8) };
        renderIconGrid();
      };
      img.src = reader.result;
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

    persistTasks();
    closeSheet();
    render();
  }

  function handleDelete() {
    if (!editingId) return;
    tasks = tasks.filter((t) => t.id !== editingId);
    persistTasks();
    closeSheet();
    render();
  }

  /* ---------- house code (household sharing) ---------- */

  function openHouseSheet() {
    renderHouseHome();
    document.getElementById("houseOverlay").classList.remove("hidden");
  }

  function closeHouseSheet() {
    document.getElementById("houseOverlay").classList.add("hidden");
  }

  function renderHouseBusy(message) {
    const content = document.getElementById("houseContent");
    content.innerHTML = "";
    content.appendChild(el("p", "house-note", message));
  }

  function renderHouseHome(message) {
    const content = document.getElementById("houseContent");
    content.innerHTML = "";

    if (householdCode) {
      content.appendChild(
        el(
          "p",
          "house-note",
          "Je bent verbonden met dit huishouden. Iedereen met onderstaande code ziet en bewerkt dezelfde taken."
        )
      );
      content.appendChild(el("div", "house-code-display", householdCode));

      const options = el("div", "house-options");
      const copyBtn = el("button", "btn secondary", "Code kopiëren");
      copyBtn.type = "button";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard?.writeText(householdCode).then(() => {
          copyBtn.textContent = "Gekopieerd!";
          setTimeout(() => (copyBtn.textContent = "Code kopiëren"), 1500);
        });
      });
      const leaveBtn = el("button", "btn danger", "Huishouden verlaten");
      leaveBtn.type = "button";
      leaveBtn.addEventListener("click", () => {
        if (confirm("Weet je zeker dat je dit huishouden wilt verlaten? Je ziet daarna weer je eigen lijst.")) {
          leaveHousehold();
          renderHouseHome();
        }
      });
      options.appendChild(copyBtn);
      options.appendChild(leaveBtn);
      content.appendChild(options);

      if (message) content.appendChild(el("p", "house-note", message));
      return;
    }

    content.appendChild(
      el(
        "p",
        "house-note",
        "Deel je schema met iedereen in je huishouden met een korte code — iedereen met de code ziet en bewerkt dezelfde taken."
      )
    );

    const options = el("div", "house-options");
    const createBtn = el("button", "btn primary", "Huishouden aanmaken");
    createBtn.type = "button";
    const joinBtn = el("button", "btn secondary", "Deelnemen met een code");
    joinBtn.type = "button";
    options.appendChild(createBtn);
    options.appendChild(joinBtn);
    content.appendChild(options);

    if (message) content.appendChild(el("p", "house-note", message));

    createBtn.addEventListener("click", async () => {
      renderHouseBusy("Huishouden wordt aangemaakt...");
      try {
        await createHousehold();
        renderHouseHome();
      } catch (err) {
        renderHouseHome("Aanmaken is niet gelukt — probeer het opnieuw.");
      }
    });

    joinBtn.addEventListener("click", () => renderHouseJoinForm());
  }

  function renderHouseJoinForm(errorMessage) {
    const content = document.getElementById("houseContent");
    content.innerHTML = "";
    content.appendChild(el("p", "house-note", "Vul de code in die je van je huisgenoot hebt gekregen."));

    const input = document.createElement("input");
    input.type = "text";
    input.id = "houseJoinInput";
    input.maxLength = 6;
    input.placeholder = "bijv. AB3XQ9";
    input.autocapitalize = "characters";
    content.appendChild(input);

    if (errorMessage) content.appendChild(el("p", "house-note", errorMessage));

    const options = el("div", "house-options");
    const joinBtn = el("button", "btn primary", "Meedoen");
    joinBtn.type = "button";
    joinBtn.addEventListener("click", async () => {
      const code = input.value.trim();
      if (!code) return;
      if (tasks.length && !confirm("Als je meedoet, wordt je huidige lijst vervangen door die van het huishouden. Doorgaan?")) {
        return;
      }
      renderHouseBusy("Verbinden...");
      try {
        await joinHousehold(code);
        renderHouseHome();
      } catch (err) {
        renderHouseJoinForm(
          err.message === "not-found" ? "Code niet gevonden — controleer de code en probeer opnieuw." : "Er ging iets mis. Probeer het opnieuw."
        );
      }
    });
    const backBtn = el("button", "btn secondary", "Terug");
    backBtn.type = "button";
    backBtn.addEventListener("click", () => renderHouseHome());
    options.appendChild(joinBtn);
    options.appendChild(backBtn);
    content.appendChild(options);
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

    if (householdCode) startHouseholdListener(householdCode);
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
