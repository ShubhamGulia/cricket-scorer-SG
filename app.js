// ------------------ Player helpers ------------------

function createDefaultPlayers(teamLabel) {
  return {
    striker: { name: `${teamLabel} Batter 1`, runs: 0, balls: 0 },
    nonStriker: { name: `${teamLabel} Batter 2`, runs: 0, balls: 0 }
  };
}

// Register a batsman in stats/order
function registerBatsman(teamKey, name) {
  if (!name) return;
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];

  if (!stats[name]) {
    stats[name] = { runs: 0, balls: 0, out: false };
  }
  if (!order.includes(name)) {
    order.push(name);
  }
}

function initBattingForTeam(teamKey) {
  const p = state.players[teamKey];
  registerBatsman(teamKey, p.striker.name);
  registerBatsman(teamKey, p.nonStriker.name);
}

function swapStrike(teamKey) {
  const p = state.players[teamKey];
  const temp = p.striker;
  p.striker = p.nonStriker;
  p.nonStriker = temp;
}

function renameBatsman(teamKey, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];

  if (stats[oldName]) {
    if (!stats[newName]) {
      stats[newName] = stats[oldName];
    } else {
      // merge if somehow existed
      stats[newName].runs += stats[oldName].runs;
      stats[newName].balls += stats[oldName].balls;
    }
    delete stats[oldName];
  } else {
    // no old stats, just register new
    registerBatsman(teamKey, newName);
  }

  const idx = order.indexOf(oldName);
  if (idx !== -1) {
    order[idx] = newName;
  } else if (!order.includes(newName)) {
    order.push(newName);
  }
}

// ------------------ State ------------------

const state = {
  teamA: "Cupcake",
  teamB: "Chips",
  oversPerInnings: 10,
  innings: 1, // 1 or 2
  battingTeam: "A", // "A" or "B"
  scores: {
    A: { runs: 0, wickets: 0, balls: 0, extras: 0 },
    B: { runs: 0, wickets: 0, balls: 0, extras: 0 }
  },
  players: {
    A: createDefaultPlayers("A"),
    B: createDefaultPlayers("B")
  },
  currentBowler: "",
  target: null,
  history: [],
  matchOver: false,
  battingStats: {
    A: {},
    B: {}
  },
  battingOrder: {
    A: [],
    B: []
  }
};

// init batting stats for default players
initBattingForTeam("A");
initBattingForTeam("B");

// ------------------ DOM refs ------------------

const els = {
  matchTitle: document.getElementById("matchTitle"),
  inningsInfo: document.getElementById("inningsInfo"),
  oversInfo: document.getElementById("oversInfo"),
  targetInfo: document.getElementById("targetInfo"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  extrasDisplay: document.getElementById("extrasDisplay"),
  batsmenInfo: document.getElementById("batsmenInfo"),
  bowlerInfo: document.getElementById("bowlerInfo"),
  currentOverBalls: document.getElementById("currentOverBalls"),
  overHistory: document.getElementById("overHistory"),
  bowlerStats: document.getElementById("bowlerStats"),
  batsmanStats: document.getElementById("batsmanStats"),
  resultText: document.getElementById("resultText"),

  // Setup modal
  setupModal: document.getElementById("setupModal"),
  teamAInput: document.getElementById("teamAInput"),
  teamBInput: document.getElementById("teamBInput"),
  oversInput: document.getElementById("oversInput"),
  saveSetupBtn: document.getElementById("saveSetupBtn"),
  cancelSetupBtn: document.getElementById("cancelSetupBtn"),

  // Controls
  undoBtn: document.getElementById("undoBtn"),
  setupBtn: document.getElementById("setupBtn"),
  editBatsmenBtn: document.getElementById("editBatsmenBtn"),
  endInningsBtn: document.getElementById("endInningsBtn"),
  resetBtn: document.getElementById("resetBtn"),
  wicketBtn: document.getElementById("wicketBtn"),

  // Extra modal
  extraModal: document.getElementById("extraModal"),
  extraTitle: document.getElementById("extraTitle"),
  extraButtons: document.getElementById("extraButtons"),
  extraCancelBtn: document.getElementById("extraCancelBtn")
};

let pendingExtraType = null; // "wide" or "noball"

// ------------------ Pure helpers ------------------

function oversFromBalls(balls) {
  const overs = Math.floor(balls / 6);
  const ballsPart = balls % 6;
  return `${overs}.${ballsPart}`;
}

function currentBattingTeamName() {
  return state.battingTeam === "A" ? state.teamA : state.teamB;
}

function currentBowlingTeamName() {
  return state.battingTeam === "A" ? state.teamB : state.teamA;
}

// derive "current over" from history, including wides/no balls
function getCurrentOverEvents(teamKey) {
  const battingScore = state.scores[teamKey];
  const totalLegalBalls = battingScore.balls;

  if (totalLegalBalls === 0) return [];

  let legalNeeded = totalLegalBalls % 6;
  if (legalNeeded === 0) legalNeeded = 6;

  const events = [];
  let legalsSeen = 0;

  for (let i = state.history.length - 1; i >= 0 && legalsSeen < legalNeeded; i--) {
    const h = state.history[i];
    if (h.teamKey !== teamKey) continue;

    if (h.type === "legal") {
      events.push(h.symbol);
      legalsSeen++;
    } else if (h.type === "extra") {
      events.push(h.label);
    }
  }

  return events.reverse();
}

// build over summary from history INCLUDING bowler
function buildOversSummary(teamKey) {
  const overs = [];
  let currentBalls = [];
  let overRuns = 0;
  let legalBalls = 0;
  let overNumber = 1;
  let currentBowlerForOver = null;

  for (const h of state.history) {
    if (h.teamKey !== teamKey) continue;

    if (currentBowlerForOver == null && h.bowler) {
      currentBowlerForOver = h.bowler;
    }

    if (h.type === "legal") {
      currentBalls.push(h.symbol);
      overRuns += h.runs;
      legalBalls++;

      if (legalBalls === 6) {
        overs.push({
          number: overNumber,
          balls: currentBalls.slice(),
          runs: overRuns,
          bowler: currentBowlerForOver || "-"
        });
        overNumber++;
        currentBalls = [];
        overRuns = 0;
        legalBalls = 0;
        currentBowlerForOver = null;
      }
    } else if (h.type === "extra") {
      currentBalls.push(h.label);
      overRuns += h.extraRuns;
    }
  }

  // last partial over
  if (currentBalls.length > 0) {
    overs.push({
      number: overNumber,
      balls: currentBalls,
      runs: overRuns,
      bowler: currentBowlerForOver || "-"
    });
  }

  return overs;
}

// build bowler stats from history (runs conceded, overs bowled)
function buildBowlerStats(teamKey) {
  const stats = {}; // { bowlerName: { runs, balls } }

  for (const h of state.history) {
    if (h.teamKey !== teamKey) continue; // only when this team is batting
    if (!h.bowler) continue;

    const name = h.bowler;
    if (!stats[name]) {
      stats[name] = { runs: 0, balls: 0 };
    }

    if (h.type === "legal") {
      stats[name].runs += h.runs;
      stats[name].balls += 1;
    } else if (h.type === "extra") {
      stats[name].runs += h.extraRuns;
      // wides/no balls: no legal ball
    }
  }

  const list = [];
  for (const [name, s] of Object.entries(stats)) {
    const overs = Math.floor(s.balls / 6);
    const balls = s.balls % 6;
    list.push({
      name,
      runs: s.runs,
      overs,
      balls
    });
  }

  return list;
}

// build batsman stats from battingStats + battingOrder
function buildBatsmanStats(teamKey) {
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];
  const list = [];

  order.forEach((name) => {
    const s = stats[name];
    if (!s) return;
    list.push({
      name,
      runs: s.runs,
      balls: s.balls,
      out: s.out
    });
  });

  return list;
}

// ------------------ UI refresh ------------------

function refreshUI() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;
  const totalOvers = state.oversPerInnings;

  els.matchTitle.textContent = `${state.teamA} vs ${state.teamB}`;
  els.inningsInfo.textContent = `Batting: ${currentBattingTeamName()} · Innings ${state.innings}`;
  els.oversInfo.textContent = `Overs: ${oversFromBalls(
    battingScore.balls
  )} / ${totalOvers}`;
  els.scoreDisplay.textContent = `Score: ${battingScore.runs}/${battingScore.wickets}`;
  els.extrasDisplay.textContent = `Extras: ${battingScore.extras}`;

  if (state.innings === 2 && state.target != null) {
    els.targetInfo.classList.remove("hidden");
    els.targetInfo.textContent = `Target: ${state.target}`;
  } else {
    els.targetInfo.classList.add("hidden");
  }

  // batsmen + bowler
  const p = state.players[state.battingTeam];
  const s = p.striker;
  const n = p.nonStriker;
  els.batsmenInfo.textContent = `Striker: ${s.name} (${s.runs}/${s.balls})  •  Non-striker: ${n.name} (${n.runs}/${n.balls})`;
  els.bowlerInfo.textContent = `Bowler: ${state.currentBowler || "-"} (tap to edit)`;

  // Current over
  els.currentOverBalls.innerHTML = "";
  const currentOverEvents = getCurrentOverEvents(state.battingTeam);
  currentOverEvents.forEach((text) => {
    const span = document.createElement("span");
    span.className = "ball-badge";
    span.textContent = text;
    els.currentOverBalls.appendChild(span);
  });

  // Over history
  els.overHistory.innerHTML = "";
  const overs = buildOversSummary(state.battingTeam);
  overs.forEach((o) => {
    const div = document.createElement("div");
    div.className = "over-row";
    div.textContent = `Over ${o.number} – ${o.bowler}: ${o.balls.join(
      " "
    )} (${o.runs})`;
    els.overHistory.appendChild(div);
  });

  // Bowler stats
  els.bowlerStats.innerHTML = "";
  const bowlerStats = buildBowlerStats(state.battingTeam);
  bowlerStats.forEach((b) => {
    const div = document.createElement("div");
    div.className = "bowler-row";
    div.textContent = `${b.name}: ${b.overs}.${b.balls} overs, ${b.runs} runs`;
    els.bowlerStats.appendChild(div);
  });

  // Batsman stats
  els.batsmanStats.innerHTML = "";
  const batsmanStats = buildBatsmanStats(state.battingTeam);
  batsmanStats.forEach((b) => {
    const div = document.createElement("div");
    div.className = "batsman-row";
    const outTag = b.out ? " (out)" : "";
    div.textContent = `${b.name}: ${b.runs} (${b.balls})${outTag}`;
    els.batsmanStats.appendChild(div);
  });
}

// ------------------ History ------------------

function pushHistory(entry) {
  state.history.push(entry);
}

// ------------------ Scoring ------------------

function handleLegalBall(runs, symbol, isWicket = false) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];
  const p = state.players[teamKey];

  const playersBefore = {
    striker: { ...p.striker },
    nonStriker: { ...p.nonStriker }
  };

  pushHistory({
    type: "legal",
    teamKey,
    runs,
    isWicket,
    symbol,
    playersBefore,
    bowler: state.currentBowler || null
  });

  // update team + striker stats
  score.runs += runs;
  if (isWicket) score.wickets += 1;

  p.striker.runs += runs;
  p.striker.balls += 1;

  // batting stats by name
  registerBatsman(teamKey, p.striker.name);
  const bs = state.battingStats[teamKey];
  bs[p.striker.name].runs += runs;
  bs[p.striker.name].balls += 1;

  score.balls += 1;

  // swap for odd runs (if not wicket)
  if (!isWicket && runs % 2 === 1) {
    swapStrike(teamKey);
  }

  // end of over: swap strike again
  if (score.balls % 6 === 0) {
    swapStrike(teamKey);
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function applyExtra(type, batRuns) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];
  const p = state.players[teamKey];

  const playersBefore = {
    striker: { ...p.striker },
    nonStriker: { ...p.nonStriker }
  };

  const label = type === "wide" ? "Wd" : "Nb";
  const totalExtraRuns = 1 + batRuns;

  pushHistory({
    type: "extra",
    teamKey,
    extraType: type,
    extraRuns: totalExtraRuns,
    label: label + (batRuns ? batRuns : ""),
    batRuns,
    playersBefore,
    bowler: state.currentBowler || null
  });

  // team extras
  score.runs += totalExtraRuns;
  score.extras += totalExtraRuns;

  // runs off the bat go to striker, but ball not counted
  if (batRuns > 0) {
    p.striker.runs += batRuns;
    registerBatsman(teamKey, p.striker.name);
    const bs = state.battingStats[teamKey];
    bs[p.striker.name].runs += batRuns;
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function undoLast() {
  const last = state.history.pop();
  if (!last) return;

  const score = state.scores[last.teamKey];
  const p = state.players[last.teamKey];

  // restore players snapshot
  if (last.playersBefore) {
    p.striker = last.playersBefore.striker;
    p.nonStriker = last.playersBefore.nonStriker;
  }

  if (last.type === "legal") {
    score.runs -= last.runs;
    if (last.isWicket) score.wickets -= 1;
    score.balls -= 1;
    // we do NOT perfectly rollback battingStats here (for simplicity),
    // but for casual use it's usually okay. If needed we can rebuild from history later.
  } else if (last.type === "extra") {
    score.runs -= last.extraRuns;
    score.extras -= last.extraRuns;
  }

  state.matchOver = false;
  els.resultText.textContent = "";
  refreshUI();
}

// ------------------ Result / innings ------------------

function checkResultOrEndByOvers() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;

  if (state.innings === 2 && state.target != null) {
    if (battingScore.runs >= state.target) {
      showResult(`${currentBattingTeamName()} won by ${
        10 - battingScore.wickets
      } wickets`);
      return;
    }
  }

  if (battingScore.balls >= state.oversPerInnings * 6) {
    if (state.innings === 1) {
      endInnings();
    } else {
      const chasingScore = battingScore;
      if (chasingScore.runs >= state.target) {
        showResult(`${currentBattingTeamName()} won`);
      } else {
        const diff = state.target - chasingScore.runs - 1;
        showResult(`${currentBowlingTeamName()} won by ${diff} runs`);
      }
    }
  }
}

function showResult(text) {
  state.matchOver = true;
  els.resultText.textContent = text;
}

function endInnings() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;

  if (state.innings === 1) {
    state.target = battingScore.runs + 1;
    state.innings = 2;
    state.battingTeam = state.battingTeam === "A" ? "B" : "A";
    state.history = []; // fresh for new innings

    // reset players for new batting team and init batting stats for them
    const newTeamKey = state.battingTeam;
    state.players[newTeamKey] = createDefaultPlayers(
      newTeamKey === "A" ? "A" : "B"
    );
    state.battingStats[newTeamKey] = {};
    state.battingOrder[newTeamKey] = [];
    initBattingForTeam(newTeamKey);

    alert(
      `Innings 1 complete: ${battingScore.runs}/${battingScore.wickets}. Target for ${currentBattingTeamName()} is ${state.target}.`
    );
  } else {
    const chasingScore = battingScore;
    if (chasingScore.runs >= state.target) {
      showResult(`${currentBattingTeamName()} won`);
    } else {
      const diff = state.target - chasingScore.runs - 1;
      showResult(`${currentBowlingTeamName()} won by ${diff} runs`);
    }
  }
  refreshUI();
}

function resetMatch() {
  state.innings = 1;
  state.battingTeam = "A";
  state.scores.A = { runs: 0, wickets: 0, balls: 0, extras: 0 };
  state.scores.B = { runs: 0, wickets: 0, balls: 0, extras: 0 };
  state.players.A = createDefaultPlayers("A");
  state.players.B = createDefaultPlayers("B");
  state.target = null;
  state.history = [];
  state.matchOver = false;
  state.currentBowler = "";
  state.battingStats = { A: {}, B: {} };
  state.battingOrder = { A: [], B: [] };
  initBattingForTeam("A");
  initBattingForTeam("B");
  els.resultText.textContent = "";
  refreshUI();
}

// ------------------ Modals ------------------

// Match setup (teams + overs only)
function openSetup() {
  els.teamAInput.value = state.teamA;
  els.teamBInput.value = state.teamB;
  els.oversInput.value = state.oversPerInnings;
  els.setupModal.classList.add("show");
}

function closeSetup() {
  els.setupModal.classList.remove("show");
}

function saveSetup() {
  state.teamA = els.teamAInput.value.trim() || "Team A";
  state.teamB = els.teamBInput.value.trim() || "Team B";

  const overs = parseInt(els.oversInput.value || "10", 10);
  state.oversPerInnings = Math.max(1, Math.min(overs, 50));

  // starting a fresh match when setup changes
  resetMatch();
  closeSetup();
}

// Extra modal
function showExtraModal(type) {
  pendingExtraType = type; // "wide" or "noball"
  els.extraTitle.textContent =
    type === "wide"
      ? "Wide – runs off the bat?"
      : "No ball – runs off the bat?";

  els.extraButtons.innerHTML = "";

  for (let i = 0; i <= 6; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.addEventListener("click", () => {
      applyExtra(pendingExtraType, i);
      hideExtraModal();
    });
    els.extraButtons.appendChild(b);
  }

  els.extraModal.classList.add("show");
}

function hideExtraModal() {
  els.extraModal.classList.remove("show");
  pendingExtraType = null;
}

// ------------------ Edit batsmen ------------------

function editBatsmen() {
  const teamKey = state.battingTeam;
  const p = state.players[teamKey];
  const oldStrikerName = p.striker.name;
  const oldNonStrikerName = p.nonStriker.name;

  const newStrikerNameRaw = prompt("Striker name", oldStrikerName);
  if (newStrikerNameRaw !== null) {
    const ns = newStrikerNameRaw.trim() || oldStrikerName;
    if (ns !== oldStrikerName) {
      renameBatsman(teamKey, oldStrikerName, ns);
      p.striker.name = ns;
    }
  }

  const newNonStrikerNameRaw = prompt(
    "Non-striker name",
    oldNonStrikerName
  );
  if (newNonStrikerNameRaw !== null) {
    const nn = newNonStrikerNameRaw.trim() || oldNonStrikerName;
    if (nn !== oldNonStrikerName) {
      renameBatsman(teamKey, oldNonStrikerName, nn);
      p.nonStriker.name = nn;
    }
  }

  refreshUI();
}

// ------------------ Event listeners ------------------

document.querySelectorAll(".run-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const runs = parseInt(btn.dataset.runs, 10);
    handleLegalBall(runs, String(runs));
  });
});

document.querySelectorAll(".extra-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type; // "wide" or "noball"
    showExtraModal(type);
  });
});

// Wicket: record ball, mark striker out, then ask for new batsman name
els.wicketBtn.addEventListener("click", () => {
  if (state.matchOver) return;
  const teamKey = state.battingTeam;
  const p = state.players[teamKey];
  const outName = p.striker.name;

  // mark out in stats
  registerBatsman(teamKey, outName);
  state.battingStats[teamKey][outName].out = true;

  // record wicket ball
  handleLegalBall(0, "W", true);

  const newNameRaw = prompt(`New batsman in for ${outName}?`);
  if (newNameRaw && newNameRaw.trim()) {
    const newName = newNameRaw.trim();
    p.striker = { name: newName, runs: 0, balls: 0 };
    registerBatsman(teamKey, newName);
  }

  refreshUI();
});

// Undo, setup, edit, innings, reset
els.undoBtn.addEventListener("click", undoLast);
els.setupBtn.addEventListener("click", openSetup);
els.cancelSetupBtn.addEventListener("click", closeSetup);
els.saveSetupBtn.addEventListener("click", saveSetup);
els.editBatsmenBtn.addEventListener("click", editBatsmen);
els.endInningsBtn.addEventListener("click", endInnings);
els.resetBtn.addEventListener("click", resetMatch);

// Extra cancel
els.extraCancelBtn.addEventListener("click", hideExtraModal);

// Tap bowler line to edit bowler name
els.bowlerInfo.addEventListener("click", () => {
  const current = state.currentBowler || "";
  const nameRaw = prompt("Current bowler name", current);
  if (nameRaw !== null) {
    state.currentBowler = nameRaw.trim();
    refreshUI();
  }
});

// ------------------ Init ------------------

refreshUI();

// If you use a service worker for PWA:
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  });
}
