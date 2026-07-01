const SCHEDULE = {
  Monday: ["Kitchen counters", "Dishes"],
  Tuesday: ["Bathroom", "Vacuum living room"],
  Wednesday: ["Dishes", "Take out trash"],
  Thursday: ["Dust surfaces", "Vacuum bedrooms"],
  Friday: ["Kitchen deep clean", "Dishes"],
  Saturday: ["Laundry", "Mop floors"],
  Sunday: ["Rest / spot clean"],
};

function weekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-w${week}`;
}

function loadDone() {
  try {
    const raw = localStorage.getItem("cleaning-done");
    const data = raw ? JSON.parse(raw) : {};
    return data.week === weekKey() ? data.tasks : {};
  } catch {
    return {};
  }
}

function saveDone(tasks) {
  localStorage.setItem("cleaning-done", JSON.stringify({ week: weekKey(), tasks }));
}

function render() {
  const done = loadDone();
  const container = document.getElementById("schedule");
  container.innerHTML = "";

  for (const [day, tasks] of Object.entries(SCHEDULE)) {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    const heading = document.createElement("h2");
    heading.textContent = day;
    dayEl.appendChild(heading);

    tasks.forEach((task, i) => {
      const id = `${day}-${i}`;
      const row = document.createElement("label");
      row.className = "task" + (done[id] ? " done" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!done[id];
      checkbox.addEventListener("change", () => {
        done[id] = checkbox.checked;
        saveDone(done);
        row.classList.toggle("done", checkbox.checked);
      });

      const label = document.createElement("span");
      label.textContent = task;

      row.appendChild(checkbox);
      row.appendChild(label);
      dayEl.appendChild(row);
    });

    container.appendChild(dayEl);
  }
}

render();
