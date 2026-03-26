const STORAGE_KEY = "rts-browser-ranking-data-v1";

const DEFAULT_ROW = {
  department: "",
  total_received: 0,
  total_completed: 0,
  completed_within_rts: 0,
  total_appeals: 0,
  final_appeals: 0,
  feedback_avg_rating: 0,
  feedback_count: 0,
  total_notified_services: 0,
  services_on_aas: 0,
  services_not_on_aas: 0,
};

const NUMERIC_FIELDS = [
  "total_received",
  "total_completed",
  "completed_within_rts",
  "total_appeals",
  "final_appeals",
  "feedback_avg_rating",
  "feedback_count",
  "total_notified_services",
  "services_on_aas",
  "services_not_on_aas",
];

const datasetInfo = document.getElementById("datasetInfo");
const resetSeedBtn = document.getElementById("resetSeedBtn");
const addRowBtn = document.getElementById("addRowBtn");
const recomputeBtn = document.getElementById("recomputeBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const csvInput = document.getElementById("csvInput");
const inputTableBody = document.getElementById("inputTableBody");
const summaryGrid = document.getElementById("summaryGrid");
const leaderboardBody = document.getElementById("leaderboardBody");
const topCards = document.getElementById("topCards");
const contributionBars = document.getElementById("contributionBars");

let currentRows = loadStoredRows();
let lastRankings = [];

init();

function init() {
  resetSeedBtn.addEventListener("click", () => {
    currentRows = cloneRows(window.RTS_SEED_DATA || []);
    saveRows();
    renderInputTable();
    recompute();
    datasetInfo.textContent = `${currentRows.length} rows loaded.`;
  });

  addRowBtn.addEventListener("click", () => {
    currentRows.push({ ...DEFAULT_ROW, department: `New Department ${currentRows.length + 1}` });
    saveRows();
    renderInputTable();
    recompute();
  });

  recomputeBtn.addEventListener("click", recompute);
  downloadCsvBtn.addEventListener("click", downloadCsv);
  csvInput.addEventListener("change", onCsvUpload);

  renderInputTable();
  recompute();
  datasetInfo.textContent = `${currentRows.length} rows ready.`;
}

function loadStoredRows() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return sanitizeRows(JSON.parse(saved));
    }
  } catch (error) {
    // Ignore invalid stored data and fall back to seed.
  }
  return cloneRows(window.RTS_SEED_DATA || []);
}

function cloneRows(rows) {
  return rows.map((row) => ({
    ...DEFAULT_ROW,
    ...row,
  }));
}

function sanitizeRows(rows) {
  return rows
    .map((row) => {
      const clean = { ...DEFAULT_ROW, ...row };
      NUMERIC_FIELDS.forEach((field) => {
        clean[field] = toNumber(clean[field]);
      });
      clean.department = String(clean.department || "").trim();
      return clean;
    })
    .filter((row) => row.department);
}

function saveRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRows));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderInputTable() {
  inputTableBody.innerHTML = "";

  currentRows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="cell-input text-input" data-index="${index}" data-field="department" value="${escapeHtml(row.department)}" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="total_received" value="${row.total_received}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="total_completed" value="${row.total_completed}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="completed_within_rts" value="${row.completed_within_rts}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="total_appeals" value="${row.total_appeals}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="final_appeals" value="${row.final_appeals}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="feedback_avg_rating" value="${row.feedback_avg_rating}" type="number" min="0" max="5" step="0.1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="feedback_count" value="${row.feedback_count}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="total_notified_services" value="${row.total_notified_services}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="services_on_aas" value="${row.services_on_aas}" type="number" min="0" step="1" /></td>
      <td><input class="cell-input" data-index="${index}" data-field="services_not_on_aas" value="${row.services_not_on_aas}" type="number" min="0" step="1" /></td>
      <td><button class="icon-btn danger-btn" data-remove="${index}" type="button" aria-label="Remove ${escapeHtml(row.department)}">×</button></td>
    `;
    inputTableBody.appendChild(tr);
  });

  inputTableBody.querySelectorAll(".cell-input").forEach((input) => {
    input.addEventListener("input", onCellChange);
  });

  inputTableBody.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      currentRows.splice(Number(button.dataset.remove), 1);
      saveRows();
      renderInputTable();
      recompute();
    });
  });
}

function onCellChange(event) {
  const { index, field } = event.target.dataset;
  const row = currentRows[Number(index)];
  if (!row) {
    return;
  }

  row[field] = field === "department" ? event.target.value : toNumber(event.target.value);
  saveRows();
  recompute();
}

function recompute() {
  const rows = sanitizeRows(currentRows);
  currentRows = rows;
  saveRows();
  lastRankings = buildRankings(rows);
  renderSummary(lastRankings);
  renderLeaderboard(lastRankings);
  renderTopCards(lastRankings.slice(0, 3));
  renderContributionBars(lastRankings);
}

function buildRankings(rows) {
  const withinRate = objectFromRows(rows, (row) => ratio(row.completed_within_rts, row.total_completed));
  const completionRate = objectFromRows(rows, (row) => ratio(row.total_completed, row.total_received));
  const appealBurden = objectFromRows(rows, (row) => ratio(row.total_appeals, row.total_completed));
  const appealClosure = objectFromRows(rows, (row) => ratio(row.final_appeals, row.total_appeals), true);
  const feedbackRaw = objectFromRows(rows, (row) => (row.feedback_avg_rating > 0 ? (row.feedback_avg_rating / 5) * 100 : null), true);
  const aasCoverage = objectFromRows(rows, (row) => {
    const denominator = row.services_on_aas + row.services_not_on_aas;
    if (denominator > 0) {
      return row.services_on_aas / denominator;
    }
    if (row.total_notified_services > 0) {
      return Math.min(1, ratio(row.services_on_aas, row.total_notified_services));
    }
    return null;
  }, true);

  const withinScores = normalizeMap(withinRate);
  const completionScores = normalizeMap(completionRate);
  const appealBurdenScores = normalizeMap(appealBurden, true);
  const appealClosureScores = normalizeMap(appealClosure);
  const aasScores = normalizeMap(aasCoverage);

  const feedbackValues = Object.values(feedbackRaw).filter((value) => value !== null);
  const globalFeedbackAverage = feedbackValues.length
    ? feedbackValues.reduce((sum, value) => sum + value, 0) / feedbackValues.length
    : 50;

  const draft = rows.map((row) => {
    const deliveryScore = 0.7 * withinScores[row.department] + 0.3 * completionScores[row.department];
    const feedbackScore = shrinkFeedback(feedbackRaw[row.department], row.feedback_count, globalFeedbackAverage);

    const appealPartA = appealBurdenScores[row.department] ?? 50;
    const appealPartB = appealClosureScores[row.department] ?? 50;
    const appealScore = 0.6 * appealPartA + 0.4 * appealPartB;

    const aasScore = aasScores[row.department] ?? 50;

    const rawScore =
      0.5 * deliveryScore +
      0.2 * appealScore +
      0.15 * feedbackScore +
      0.15 * aasScore;

    const confidence = Math.min(1, Math.sqrt(ratio(row.total_received, 10000)));

    return {
      ...row,
      within_rate: withinRate[row.department] || 0,
      completion_rate: completionRate[row.department] || 0,
      appeal_burden: appealBurden[row.department],
      appeal_closure_rate: appealClosure[row.department],
      aas_coverage_rate: aasCoverage[row.department],
      delivery_score: deliveryScore,
      appeal_score: appealScore,
      feedback_score: feedbackScore,
      aas_score: aasScore,
      raw_score: rawScore,
      confidence,
    };
  });

  const averageRaw = draft.reduce((sum, row) => sum + row.raw_score, 0) / Math.max(draft.length, 1);
  draft.forEach((row) => {
    row.final_score = row.raw_score * row.confidence + averageRaw * (1 - row.confidence);
  });

  draft.sort((a, b) => b.final_score - a.final_score || b.total_received - a.total_received || a.department.localeCompare(b.department));
  draft.forEach((row, index) => {
    row.rank = index + 1;
  });
  return draft;
}

function objectFromRows(rows, getter, allowNull = false) {
  return rows.reduce((acc, row) => {
    const value = getter(row);
    acc[row.department] = value === null && allowNull ? null : toNumber(value);
    return acc;
  }, {});
}

function normalizeMap(map, reverse = false) {
  const entries = Object.entries(map).filter(([, value]) => value !== null);
  if (!entries.length) {
    return Object.fromEntries(Object.keys(map).map((key) => [key, 50]));
  }

  const values = entries.map(([, value]) => value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => {
      if (value === null) {
        return [key, null];
      }
      if (max === min) {
        return [key, 100];
      }
      let scaled = ((value - min) / (max - min)) * 100;
      if (reverse) {
        scaled = 100 - scaled;
      }
      return [key, scaled];
    })
  );
}

function shrinkFeedback(score, count, globalAverage) {
  if (score === null) {
    return globalAverage;
  }
  const weight = Math.min(1, Math.sqrt(ratio(count, 25)));
  return score * weight + globalAverage * (1 - weight);
}

function ratio(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function renderSummary(rankings) {
  const cards = summaryGrid.querySelectorAll(".stat-card");
  const averageScore = rankings.reduce((sum, row) => sum + row.final_score, 0) / Math.max(rankings.length, 1);
  const bestDelivery = [...rankings].sort((a, b) => b.delivery_score - a.delivery_score)[0];

  cards[0].querySelector(".stat-value").textContent = String(rankings.length);
  cards[1].querySelector(".stat-value").textContent = rankings[0]?.department || "Not available";
  cards[2].querySelector(".stat-value").textContent = averageScore.toFixed(2);
  cards[3].querySelector(".stat-value").textContent = bestDelivery?.department || "Not available";
}

function renderLeaderboard(rankings) {
  leaderboardBody.innerHTML = "";

  rankings.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-pill">#${row.rank}</span></td>
      <td><div class="dept-cell"><strong>${escapeHtml(row.department)}</strong><span>${formatPercent(row.within_rate)} within RTS</span></div></td>
      <td>${row.final_score.toFixed(2)}</td>
      <td>${row.delivery_score.toFixed(1)}</td>
      <td>${row.appeal_score.toFixed(1)}</td>
      <td>${row.feedback_score.toFixed(1)}</td>
      <td>${row.aas_score.toFixed(1)}</td>
      <td>${(row.confidence * 100).toFixed(1)}%</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}

function renderTopCards(rows) {
  topCards.innerHTML = "";
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "mini-card";
    card.innerHTML = `
      <span class="mini-rank">#${row.rank}</span>
      <h3>${escapeHtml(row.department)}</h3>
      <p>Score ${row.final_score.toFixed(2)}</p>
      <strong>${Math.round(row.total_received).toLocaleString()} received</strong>
    `;
    topCards.appendChild(card);
  });
}

function renderContributionBars(rankings) {
  contributionBars.innerHTML = "";
  const metrics = [
    {
      label: "Delivery score",
      value: average(rankings.map((row) => row.delivery_score)),
    },
    {
      label: "Appeal score",
      value: average(rankings.map((row) => row.appeal_score)),
    },
    {
      label: "Feedback score",
      value: average(rankings.map((row) => row.feedback_score)),
    },
    {
      label: "AAS coverage score",
      value: average(rankings.map((row) => row.aas_score)),
    },
  ];

  metrics.forEach((metric) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">${metric.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, metric.value)}%"></div></div>
      <span class="bar-value">${metric.value.toFixed(1)}</span>
    `;
    contributionBars.appendChild(row);
  });
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function onCsvUpload(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  file.text().then((text) => {
    currentRows = parseCsv(text);
    saveRows();
    renderInputTable();
    recompute();
    datasetInfo.textContent = `${currentRows.length} rows from ${file.name}.`;
    csvInput.value = "";
  }).catch((error) => {
    datasetInfo.textContent = `CSV import failed: ${error.message}`;
    csvInput.value = "";
  });
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV needs a header and at least one department row.");
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  const required = ["department", ...NUMERIC_FIELDS];
  required.forEach((header) => {
    if (!headers.includes(header)) {
      throw new Error(`Missing required column: ${header}`);
    }
  });

  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((value) => value.trim());
    const row = { ...DEFAULT_ROW };
    headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex] ?? "";
    });
    row.department = row.department || `Department ${index + 1}`;
    NUMERIC_FIELDS.forEach((field) => {
      row[field] = toNumber(row[field]);
    });
    return row;
  });
}

function downloadCsv() {
  const headers = ["department", ...NUMERIC_FIELDS];
  const lines = [
    headers.join(","),
    ...currentRows.map((row) => headers.map((header) => row[header]).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rts_ranking_inputs.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
