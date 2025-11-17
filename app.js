// ---------- Player helpers ----------

function createDefaultPlayers(teamLabel) {
  return {
    striker: { name: `${teamLabel} Batter 1`, runs: 0, balls: 0 },
    nonStriker: { name: `${teamLabel} Batter 2`, runs: 0, balls: 0 }
  };
}

function registerBatsman(teamKey, name) {
  if (!name) return;
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];

  if (!stats[name]) {
    stats[name] = { runs: 0, balls: 0, out: false, retired: false };
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
  const tmp = p.striker;
  p.striker = p.nonStriker;
  p.nonStriker = tmp;
}

function renameBatsman(teamKey, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];

  if (stats[oldName]) {
    if (!stats[newName]) {
      stats[newName] = stats[oldName];
    } else {
      stats[newName].runs += stats[oldName].runs;
      stats[newName].balls += stats[oldName].balls;
      stats[newName].out = stats[newName].out || stats[oldName].out;
      stats[newName].retired = stats[newName].retired || stats[oldName].retired;
    }
    delete stats[oldName];
  } else {
    registerBatsman(teamKey, newName);
  }

  const idx = order.indexOf(oldName);
  if (idx !== -1) {
    order[idx] = newName;
  } else if (!order.includes(newName)) {
    order.push(newName);
  }
}

// ---------- State ----------

const state = {
  teamA: "Cupcake",
  teamB: "Chips",
  oversPerInnings: 10,
  innings: 1,
  battingTeam: "A",
  scores: {
    A: { runs: 0, wickets: 0, balls: 0, extras: 0 },
    B: { runs: 0, wickets: 0, balls: 0, extras: 0 }
  },
  players: {
    A: createDefaultPlayers("A"),
    B: createDefaultPlayers("B")
  },
  currentBowler: "",
  allBowlers: [],
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
  },
  retiredHurt: {
    A: [],
    B: []
  },
  matchSummary: {
    innings1: null,
    innings2: null
  }
};

initBattingForTeam("A");
initBattingForTeam("B");

// ---------- DOM refs ----------

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
  scorecard: document.getElementById("scorecard"),
  resultText: document.getElementById("resultText"),

  setupModal: document.getElementById("setupModal"),
  teamAInput: document.getElementById("teamAInput"),
  teamBInput: document.getElementById("teamBInput"),
  oversInput: document.getElementById("oversInput"),
  saveSetupBtn: document.getElementById("saveSetupBtn"),
  cancelSetupBtn: document.getElementById("cancelSetupBtn"),

  undoBtn: document.getElementById("undoBtn"),
  setupBtn: document.getElementById("setupBtn"),
  editBatsmenBtn: document.getElementById("editBatsmenBtn"),
  changeBowlerBtn: document.getElementById("changeBowlerBtn"),
  endInningsBtn: document.getElementById("endInningsBtn"),
  resetBtn: document.getElementById("resetBtn"),
  wicketBtn: document.getElementById("wicketBtn"),
  retireStrikerBtn: document.getElementById("retireStrikerBtn"),
  retireNonStrikerBtn: document.getElementById("retireNonStrikerBtn"),

  extraModal: document.getElementById("extraModal"),
  extraTitle: document.getElementById("extraTitle"),
  extraButtons: document.getElementById("extraButtons"),
  extraCancelBtn: document.getElementById("extraCancelBtn")
};

let pendingExtraType = null;

// ---------- Helpers ----------

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

function registerCurrentBowler() {
  const name = (state.currentBowler || "").trim();
  if (!name) return;
  if (!state.allBowlers.includes(name)) {
    state.allBowlers.push(name);
  }
}

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

function buildBowlerStats(teamKey) {
  const stats = {};

  for (const h of state.history) {
    if (h.teamKey !== teamKey) continue;
    if (!h.bowler) continue;

    const name = h.bowler;
    if (!stats[name]) stats[name] = { runs: 0, balls: 0 };

    if (h.type === "legal") {
      stats[name].runs += h.runs;
      stats[name].balls += 1;
    } else if (h.type === "extra") {
      stats[name].runs += h.extraRuns;
    }
  }

  const list = [];
  for (const [name, s] of Object.entries(stats)) {
    const overs = Math.floor(s.balls / 6);
    const balls = s.balls % 6;
    list.push({ name, runs: s.runs, overs, balls });
  }
  return list;
}

function buildBatsmanStats(teamKey) {
  const stats = state.battingStats[teamKey];
  const order = state.battingOrder[teamKey];
  const list = [];
  order.forEach((name) => {
    const s = stats[name];
    if (!s) return;
    list.push({ name, runs: s.runs, balls: s.balls, out: s.out, retired: s.retired });
  });
  return list;
}

// Snapshot current innings for scorecard (bat + bowl)
function snapshotCurrentInnings() {
  const battingKey = state.battingTeam;
  const bowlingKey = battingKey === "A" ? "B" : "A";
  const battingScore = state.scores[battingKey];

  const battingStatsCopy = JSON.parse(
    JSON.stringify(state.battingStats[battingKey] || {})
  );
  const battingOrderCopy = [...(state.battingOrder[battingKey] || [])];

  const bowlingStatsList = buildBowlerStats(battingKey);

  const summary = {
    battingTeamKey: battingKey,
    bowlingTeamKey: bowlingKey,
    battingTeam: battingKey === "A" ? state.teamA : state.teamB,
    bowlingTeam: bowlingKey === "A" ? state.teamA : state.teamB,
    runs: battingScore.runs,
    wickets: battingScore.wickets,
    balls: battingScore.balls,
    oversText: oversFromBalls(battingScore.balls),
    battingStats: battingStatsCopy,
    battingOrder: battingOrderCopy,
    bowlingStats: bowlingStatsList
  };

  if (state.innings === 1) {
    state.matchSummary.innings1 = summary;
  } else {
    state.matchSummary.innings2 = summary;
  }
}

// Render scorecard for current match (both innings)
function renderScorecard() {
  const container = els.scorecard;
  container.innerHTML = "";

  const m = state.matchSummary;
  if (!m.innings1 && !m.innings2) {
    container.textContent =
      "Scorecard will appear here after each innings finishes.";
    return;
  }

  function renderInningsBlock(inn) {
    const div = document.createElement("div");
    div.className = "scorecard-block";

    const title = document.createElement("div");
    title.className = "scorecard-heading";
    title.textContent = `${inn.battingTeam} innings – ${inn.runs}/${inn.wickets} in ${inn.oversText} overs`;
    div.appendChild(title);

    // Batting
    const batHeader = document.createElement("div");
    batHeader.style.fontWeight = "600";
    batHeader.textContent = "Batting:";
    div.appendChild(batHeader);

    const stats = inn.battingStats || {};
    const order = inn.battingOrder || Object.keys(stats);

    order.forEach((name) => {
      const s = stats[name];
      if (!s) return;
      const line = document.createElement("div");
      let tag = "";
      if (s.out) tag = " (out)";
      else if (s.retired) tag = " (retired hurt)";
      line.textContent = `• ${name}: ${s.runs} (${s.balls})${tag}`;
      div.appendChild(line);
    });

    // Bowling
    const bowlHeader = document.createElement("div");
    bowlHeader.style.fontWeight = "600";
    bowlHeader.style.marginTop = "4px";
    bowlHeader.textContent = `Bowling (${inn.bowlingTeam}):`;
    div.appendChild(bowlHeader);

    (inn.bowlingStats || []).forEach((b) => {
      const line = document.createElement("div");
      line.textContent = `• ${b.name}: ${b.overs}.${b.balls} overs, ${b.runs} runs`;
      div.appendChild(line);
    });

    return div;
  }

  if (m.innings1) {
    const label = document.createElement("div");
    label.textContent = "Innings 1";
    label.style.fontWeight = "600";
    container.appendChild(label);
    container.appendChild(renderInningsBlock(m.innings1));
  }

  if (m.innings2) {
    const label2 = document.createElement("div");
    label2.textContent = "Innings 2";
    label2.style.fontWeight = "600";
    label2.style.marginTop = "6px";
    container.appendChild(label2);
    container.appendChild(renderInningsBlock(m.innings2));
  }
}

// ---------- UI ----------

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

  const p = state.players[state.battingTeam];
  const s = p.striker;
  const n = p.nonStriker;
  els.batsmenInfo.textContent = `Striker: ${s.name} (${s.runs}/${s.balls})  •  Non-striker: ${n.name} (${n.runs}/${n.balls})`;
  els.bowlerInfo.textContent = `Bowler: ${state.currentBowler || "-"}`;

  els.currentOverBalls.innerHTML = "";
  const currentOverEvents = getCurrentOverEvents(state.battingTeam);
  currentOverEvents.forEach((text) => {
    const span = document.createElement("span");
    span.className = "ball-badge";
    span.textContent = text;
    els.currentOverBalls.appendChild(span);
  });

  // over history (current innings)
  els.overHistory.innerHTML = "";
  buildOversSummary(state.battingTeam).forEach((o) => {
    const div = document.createElement("div");
    div.className = "over-row";
    div.textContent = `Over ${o.number} – ${o.bowler}: ${o.balls.join(
      " "
    )} (${o.runs})`;
    els.overHistory.appendChild(div);
  });

  // bowler stats (current innings)
  els.bowlerStats.innerHTML = "";
  buildBowlerStats(state.battingTeam).forEach((b) => {
    const div = document.createElement("div");
    div.className = "bowler-row";
    div.textContent = `${b.name}: ${b.overs}.${b.balls} overs, ${b.runs} runs`;
    els.bowlerStats.appendChild(div);
  });

  // batsman stats (current innings)
  els.batsmanStats.innerHTML = "";
  buildBatsmanStats(state.battingTeam).forEach((b) => {
    const div = document.createElement("div");
    div.className = "batsman-row";
    let tag = "";
    if (b.out) tag = " (out)";
    else if (b.retired) tag = " (retired hurt)";
    div.textContent = `${b.name}: ${b.runs} (${b.balls})${tag}`;
    els.batsmanStats.appendChild(div);
  });

  // full scorecard for both innings
  renderScorecard();
}

// ---------- History ----------

function pushHistory(entry) {
  state.history.push(entry);
}

// ---------- Scoring ----------

function handleLegalBall(runs, symbol, isWicket = false) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];
  const p = state.players[teamKey];

  registerCurrentBowler();

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

  score.runs += runs;
  if (isWicket) score.wickets += 1;

  p.striker.runs += runs;
  p.striker.balls += 1;

  registerBatsman(teamKey, p.striker.name);
  const bs = state.battingStats[teamKey];
  bs[p.striker.name].runs += runs;
  bs[p.striker.name].balls += 1;

  score.balls += 1;

  const overCompleted = score.balls % 6 === 0;

  if (!isWicket && runs % 2 === 1) {
    swapStrike(teamKey);
  }

  if (overCompleted) {
    swapStrike(teamKey);
  }

  if (
    overCompleted &&
    score.balls < state.oversPerInnings * 6 &&
    !state.matchOver
  ) {
    askForNextBowler();
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function applyExtra(type, batRuns) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];
  const p = state.players[teamKey];

  registerCurrentBowler();

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

  if (type === "wide") {
    score.runs += totalExtraRuns;
    score.extras += totalExtraRuns;
  } else {
    // no ball
    score.runs += totalExtraRuns;
    score.extras += 1;

    if (batRuns > 0) {
      p.striker.runs += batRuns;
      registerBatsman(teamKey, p.striker.name);
      const bs = state.battingStats[teamKey];
      bs[p.striker.name].runs += batRuns;
    }
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function undoLast() {
  const last = state.history.pop();
  if (!last) return;

  const score = state.scores[last.teamKey];
  const p = state.players[last.teamKey];

  if (last.playersBefore) {
    p.striker = last.playersBefore.striker;
    p.nonStriker = last.playersBefore.nonStriker;
  }

  if (last.type === "legal") {
    score.runs -= last.runs;
    if (last.isWicket) score.wickets -= 1;
    score.balls -= 1;
  } else if (last.type === "extra") {
    score.runs -= last.extraRuns;
    if (last.extraType === "wide") {
      score.extras -= last.extraRuns;
    } else {
      score.extras -= 1; // only the mandatory no-ball
    }
  }

  state.matchOver = false;
  els.resultText.textContent = "";
  refreshUI();
}

// ---------- Result / innings ----------

function checkResultOrEndByOvers() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;

  if (state.innings === 2 && state.target != null) {
    if (battingScore.runs >= state.target) {
      snapshotCurrentInnings();
      showResult(
        `${currentBattingTeamName()} won by ${
          10 - battingScore.wickets
        } wickets`
      );
      return;
    }
  }

  if (battingScore.balls >= state.oversPerInnings * 6) {
    if (state.innings === 1) {
      snapshotCurrentInnings();
      endInnings();
    } else {
      snapshotCurrentInnings();
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
  // ALWAYS snapshot when user manually ends an innings
  snapshotCurrentInnings();

  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;

  if (state.innings === 1) {
    state.target = battingScore.runs + 1;
    state.innings = 2;
    state.battingTeam = state.battingTeam === "A" ? "B" : "A";

    state.history = [];
    state.allBowlers = [];

    const newTeamKey = state.battingTeam;
    state.players[newTeamKey] = createDefaultPlayers(
      newTeamKey === "A" ? "A" : "B"
    );
    state.battingStats[newTeamKey] = {};
    state.battingOrder[newTeamKey] = [];
    state.retiredHurt[newTeamKey] = [];
    initBattingForTeam(newTeamKey);

    alert(
      `Innings 1 complete: ${battingScore.runs}/${battingScore.wickets}. Target for ${currentBattingTeamName()} is ${state.target}.`
    );
  } else {
    const chasingScore = battingScore;

    if (state.target == null) {
      const other =
        state.battingTeam === "A" ? state.scores.B.runs : state.scores.A.runs;
      state.target = other + 1;
    }

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
  state.allBowlers = [];
  state.battingStats = { A: {}, B: {} };
  state.battingOrder = { A: [], B: [] };
  state.retiredHurt = { A: [], B: [] };
  state.matchSummary = { innings1: null, innings2: null };
  initBattingForTeam("A");
  initBattingForTeam("B");
  els.resultText.textContent = "";
  refreshUI();
}

// ---------- Bowler selection ----------

function askForNextBowler() {
  const existing = state.allBowlers;
  let message = "New over: enter bowler name";
  if (existing.length > 0) {
    message =
      `New over.\nPrevious bowlers: ${existing.join(
        ", "
      )}.\nType one of them or enter a new name:`;
  }
  const input = prompt(message, state.currentBowler || "");
  if (input !== null) {
    state.currentBowler = input.trim();
    registerCurrentBowler();
  }
}

function changeBowler() {
  const existing = state.allBowlers;
  let message = "Change bowler: enter name";
  if (existing.length > 0) {
    message =
      `Change bowler.\nPrevious bowlers: ${existing.join(
        ", "
      )}.\nType one of them or enter a new name:`;
  }
  const input = prompt(message, state.currentBowler || "");
  if (input !== null) {
    state.currentBowler = input.trim();
    registerCurrentBowler();
    refreshUI();
  }
}

// ---------- Retired hurt ----------

function retireBatsman(isStriker) {
  const teamKey = state.battingTeam;
  const p = state.players[teamKey];
  const batter = isStriker ? p.striker : p.nonStriker;
  const role = isStriker ? "striker" : "non-striker";
  const name = batter.name;

  if (!name) return;

  if (!confirm(`${name} will be retired hurt as ${role}. Continue?`)) return;

  registerBatsman(teamKey, name);
  const bs = state.battingStats[teamKey];
  bs[name].retired = true;
  bs[name].out = false;

  if (!state.retiredHurt[teamKey].includes(name)) {
    state.retiredHurt[teamKey].push(name);
  }

  const newNameRaw = prompt(
    `New batsman replacing ${name} (retired hurt)?\nLeave blank to cancel.`
  );
  if (newNameRaw && newNameRaw.trim()) {
    const newName = newNameRaw.trim();
    const obj = { name: newName, runs: 0, balls: 0 };
    if (isStriker) p.striker = obj;
    else p.nonStriker = obj;
    registerBatsman(teamKey, newName);
  } else {
    state.retiredHurt[teamKey] = state.retiredHurt[teamKey].filter(
      (n) => n !== name
    );
    bs[name].retired = false;
  }

  refreshUI();
}

// ---------- Modals & edits ----------

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

  resetMatch();
  closeSetup();
}

function showExtraModal(type) {
  pendingExtraType = type;
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

function editBatsmen() {
  const teamKey = state.battingTeam;
  const p = state.players[teamKey];
  const oldS = p.striker.name;
  const oldN = p.nonStriker.name;

  const newSRaw = prompt("Striker name", oldS);
  if (newSRaw !== null) {
    const ns = newSRaw.trim() || oldS;
    if (ns !== oldS) {
      renameBatsman(teamKey, oldS, ns);
      p.striker.name = ns;
    }
  }

  const newNRaw = prompt("Non-striker name", oldN);
  if (newNRaw !== null) {
    const nn = newNRaw.trim() || oldN;
    if (nn !== oldN) {
      renameBatsman(teamKey, oldN, nn);
      p.nonStriker.name = nn;
    }
  }

  refreshUI();
}

// ---------- Events ----------

document.querySelectorAll(".run-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const runs = parseInt(btn.dataset.runs, 10);
    handleLegalBall(runs, String(runs));
  });
});

document.querySelectorAll(".extra-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    showExtraModal(type);
  });
});

els.wicketBtn.addEventListener("click", () => {
  if (state.matchOver) return;
  const teamKey = state.battingTeam;
  const p = state.players[teamKey];
  const outName = p.striker.name;

  registerBatsman(teamKey, outName);
  const bs = state.battingStats[teamKey];
  bs[outName].out = true;
  bs[outName].retired = false;

  state.retiredHurt[teamKey] = state.retiredHurt[teamKey].filter(
    (n) => n !== outName
  );

  handleLegalBall(0, "W", true);

  const retiredList = state.retiredHurt[teamKey];
  let choice = null;

  if (retiredList.length > 0) {
    const msg =
      `New batsman in for ${outName}?\n` +
      `Type a name from retired hurt [${retiredList.join(
        ", "
      )}] to bring back,\n` +
      `or enter a NEW name.`;
    const input = prompt(msg);
    if (input && input.trim()) {
      choice = input.trim();
      if (retiredList.includes(choice)) {
        const sStats = bs[choice] || {
          runs: 0,
          balls: 0,
          out: false,
          retired: true
        };
        p.striker = {
          name: choice,
          runs: sStats.runs,
          balls: sStats.balls
        };
        sStats.retired = false;
        state.retiredHurt[teamKey] = retiredList.filter((n) => n !== choice);
      } else {
        p.striker = { name: choice, runs: 0, balls: 0 };
        registerBatsman(teamKey, choice);
      }
    }
  } else {
    const input = prompt(`New batsman in for ${outName}?`);
    if (input && input.trim()) {
      choice = input.trim();
      p.striker = { name: choice, runs: 0, balls: 0 };
      registerBatsman(teamKey, choice);
    }
  }

  refreshUI();
});

els.undoBtn.addEventListener("click", undoLast);
els.setupBtn.addEventListener("click", openSetup);
els.cancelSetupBtn.addEventListener("click", closeSetup);
els.saveSetupBtn.addEventListener("click", saveSetup);
els.editBatsmenBtn.addEventListener("click", editBatsmen);
els.changeBowlerBtn.addEventListener("click", changeBowler);
els.endInningsBtn.addEventListener("click", endInnings);
els.resetBtn.addEventListener("click", resetMatch);
els.extraCancelBtn.addEventListener("click", hideExtraModal);
els.retireStrikerBtn.addEventListener("click", () => retireBatsman(true));
els.retireNonStrikerBtn.addEventListener("click", () => retireBatsman(false));

// ---------- Init ----------

refreshUI();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(console.error);
  });
}
