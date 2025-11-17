// ---------- Player helpers ----------

function createDefaultPlayers(label) {
  return {
    striker: { name: `${label} Batter 1`, runs: 0, balls: 0 },
    nonStriker: { name: `${label} Batter 2`, runs: 0, balls: 0 }
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
  const t = p.striker;
  p.striker = p.nonStriker;
  p.nonStriker = t;
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

// ---------- Global State ----------

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
  matchOver: false,
  history: [],

  battingStats: { A: {}, B: {} },
  battingOrder: { A: [], B: [] },

  retiredHurt: { A: [], B: [] },

  matchSummary: {
    innings1: null,
    innings2: null
  }
};

initBattingForTeam("A");
initBattingForTeam("B");

// ---------- DOM Elements ----------

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
  return Math.floor(balls / 6) + "." + (balls % 6);
}

function currentBattingTeamName() {
  return state.battingTeam === "A" ? state.teamA : state.teamB;
}

function currentBowlingTeamName() {
  return state.battingTeam === "A" ? state.teamB : state.teamA;
}

function registerCurrentBowler() {
  const b = state.currentBowler.trim();
  if (!b) return;
  if (!state.allBowlers.includes(b)) state.allBowlers.push(b);
}

function pushHistory(entry) {
  state.history.push(entry);
}

// ---------- Build View Data ----------

function getCurrentOverEvents(teamKey) {
  const balls = state.scores[teamKey].balls;
  if (balls === 0) return [];

  let legalNeeded = balls % 6;
  if (legalNeeded === 0) legalNeeded = 6;

  const list = [];
  let legalsSeen = 0;

  for (let i = state.history.length - 1; i >= 0 && legalsSeen < legalNeeded; i--) {
    const h = state.history[i];
    if (h.teamKey !== teamKey) continue;

    if (h.type === "legal") {
      list.push(h.symbol);
      legalsSeen++;
    } else if (h.type === "extra") {
      list.push(h.label);
    }
  }

  return list.reverse();
}

function buildOversSummary(teamKey) {
  let list = [];
  let balls = [];
  let runs = 0;
  let legal = 0;
  let overNo = 1;
  let bowler = null;

  for (let h of state.history) {
    if (h.teamKey !== teamKey) continue;

    if (!bowler && h.bowler) bowler = h.bowler;

    if (h.type === "legal") {
      balls.push(h.symbol);
      runs += h.runs;
      legal++;

      if (legal === 6) {
        list.push({ number: overNo, balls: [...balls], runs, bowler: bowler || "-" });
        overNo++;
        balls = [];
        runs = 0;
        legal = 0;
        bowler = null;
      }
    } else {
      balls.push(h.label);
      runs += h.extraRuns;
    }
  }

  if (balls.length > 0) list.push({ number: overNo, balls, runs, bowler: bowler || "-" });

  return list;
}

function buildBowlerStats(teamKey) {
  const stats = {};

  for (let h of state.history) {
    if (h.teamKey !== teamKey) continue;
    if (!h.bowler) continue;

    const name = h.bowler;
    if (!stats[name]) stats[name] = { balls: 0, runs: 0 };

    if (h.type === "legal") {
      stats[name].runs += h.runs;
      stats[name].balls += 1;
    } else {
      stats[name].runs += h.extraRuns;
    }
  }

  return Object.entries(stats).map(([name, s]) => ({
    name,
    overs: Math.floor(s.balls / 6),
    balls: s.balls % 6,
    runs: s.runs
  }));
}

function buildBatsmanStats(teamKey) {
  const order = state.battingOrder[teamKey];
  const stats = state.battingStats[teamKey];
  return order.map(n => ({ name: n, ...stats[n] }));
}

// ---------- Scorecard snapshots ----------

function snapshotCurrentInnings() {
  const teamKey = state.battingTeam;
  const bowlKey = teamKey === "A" ? "B" : "A";

  state.matchSummary[state.innings === 1 ? "innings1" : "innings2"] = {
    battingTeam: teamKey === "A" ? state.teamA : state.teamB,
    bowlingTeam: bowlKey === "A" ? state.teamA : state.teamB,
    runs: state.scores[teamKey].runs,
    wickets: state.scores[teamKey].wickets,
    balls: state.scores[teamKey].balls,
    oversText: oversFromBalls(state.scores[teamKey].balls),
    battingStats: JSON.parse(JSON.stringify(state.battingStats[teamKey])),
    battingOrder: [...state.battingOrder[teamKey]],
    bowlingStats: buildBowlerStats(teamKey)
  };
}

// ---------- UI Rendering ----------

function refreshUI() {
  const t = state.battingTeam;
  const score = state.scores[t];

  els.matchTitle.textContent = `${state.teamA} vs ${state.teamB}`;
  els.inningsInfo.textContent = `Batting: ${currentBattingTeamName()} · Innings ${state.innings}`;
  els.oversInfo.textContent = `Overs: ${oversFromBalls(
    score.balls
  )} / ${state.oversPerInnings}`;
  els.scoreDisplay.textContent = `${score.runs}/${score.wickets}`;
  els.extrasDisplay.textContent = `Extras: ${score.extras}`;

  if (state.innings === 2 && state.target) {
    els.targetInfo.classList.remove("hidden");
    els.targetInfo.textContent = `Target: ${state.target}`;
  } else {
    els.targetInfo.classList.add("hidden");
  }

  const p = state.players[t];
  els.batsmenInfo.textContent = `Striker: ${p.striker.name} (${p.striker.runs}/${p.striker.balls})  •  Non-striker: ${p.nonStriker.name} (${p.nonStriker.runs}/${p.nonStriker.balls})`;
  els.bowlerInfo.textContent = `Bowler: ${state.currentBowler || "-"}`;

  els.currentOverBalls.innerHTML = "";
  getCurrentOverEvents(t).forEach(b => {
    const s = document.createElement("span");
    s.className = "ball-badge";
    s.textContent = b;
    els.currentOverBalls.appendChild(s);
  });

  els.overHistory.innerHTML = "";
  buildOversSummary(t).forEach(o => {
    const d = document.createElement("div");
    d.textContent = `Over ${o.number} – ${o.bowler}: ${o.balls.join(" ")} (${o.runs})`;
    els.overHistory.appendChild(d);
  });

  els.bowlerStats.innerHTML = "";
  buildBowlerStats(t).forEach(b => {
    const d = document.createElement("div");
    d.textContent = `${b.name}: ${b.overs}.${b.balls} overs, ${b.runs} runs`;
    els.bowlerStats.appendChild(d);
  });

  els.batsmanStats.innerHTML = "";
  buildBatsmanStats(t).forEach(b => {
    const d = document.createElement("div");
    let tag = b.out ? " (out)" : b.retired ? " (retired hurt)" : "";
    d.textContent = `${b.name}: ${b.runs} (${b.balls})${tag}`;
    els.batsmanStats.appendChild(d);
  });

  renderScorecard();
}

function renderScorecard() {
  const el = els.scorecard;
  el.innerHTML = "";

  const s = state.matchSummary;
  if (!s.innings1 && !s.innings2) {
    el.textContent = "Scorecard will appear here after each innings finishes.";
    return;
  }

  function block(inn) {
    const d = document.createElement("div");
    d.className = "scorecard-block";

    const h = document.createElement("div");
    h.style.fontWeight = "600";
    h.textContent = `${inn.battingTeam} innings – ${inn.runs}/${inn.wickets} in ${inn.oversText} overs`;
    d.appendChild(h);

    const bh = document.createElement("div");
    bh.style.fontWeight = "600";
    bh.textContent = "Batting:";
    d.appendChild(bh);

    inn.battingOrder.forEach(n => {
      const s = inn.battingStats[n];
      if (!s) return;
      const line = document.createElement("div");
      let tag = s.out ? " (out)" : s.retired ? " (retired hurt)" : "";
      line.textContent = `• ${n}: ${s.runs} (${s.balls})${tag}`;
      d.appendChild(line);
    });

    const bw = document.createElement("div");
    bw.style.fontWeight = "600";
    bw.style.marginTop = "4px";
    bw.textContent = `Bowling (${inn.bowlingTeam}):`;
    d.appendChild(bw);

    inn.bowlingStats.forEach(x => {
      const line = document.createElement("div");
      line.textContent = `• ${x.name}: ${x.overs}.${x.balls} overs, ${x.runs} runs`;
      d.appendChild(line);
    });

    return d;
  }

  if (s.innings1) {
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = "Innings 1";
    el.appendChild(title);
    el.appendChild(block(s.innings1));
  }

  if (s.innings2) {
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.marginTop = "6px";
    title.textContent = "Innings 2";
    el.appendChild(title);
    el.appendChild(block(s.innings2));
  }
}

// ---------- Bowler selection ----------

function askForNextBowler() {
  const existing = state.allBowlers;
  let text = "New over: enter bowler name";

  if (existing.length > 0) {
    text = `New over\nPrevious bowlers: ${existing.join(
      ", "
    )}\nEnter one of them or a new name:`;
  }

  const input = prompt(text, state.currentBowler);
  if (input !== null) {
    state.currentBowler = input.trim();
    registerCurrentBowler();
    refreshUI();
  }
}

function editBowler() {
  const existing = state.allBowlers;
  let text = "Edit bowler name:";

  if (existing.length > 0) {
    text = `Edit bowler\nPrevious bowlers: ${existing.join(
      ", "
    )}\nEnter one of them or a new name:`;
  }

  const input = prompt(text, state.currentBowler);
  if (input !== null) {
    state.currentBowler = input.trim();
    registerCurrentBowler();
    refreshUI();
  }
}

// ---------- Scoring ----------

function handleLegalBall(runs, symbol, isWicket = false) {
  if (state.matchOver) return;

  const t = state.battingTeam;
  const score = state.scores[t];
  const p = state.players[t];

  registerCurrentBowler();

  pushHistory({
    type: "legal",
    teamKey: t,
    runs,
    symbol,
    isWicket,
    bowler: state.currentBowler
  });

  score.runs += runs;
  if (isWicket) score.wickets++;
  p.striker.runs += runs;
  p.striker.balls++;

  registerBatsman(t, p.striker.name);
  const bs = state.battingStats[t];
  bs[p.striker.name].runs += runs;
  bs[p.striker.name].balls++;

  score.balls++;

  const overEnd = score.balls % 6 === 0;

  if (!isWicket && runs % 2 === 1) swapStrike(t);

  if (overEnd && !isWicket) {
    swapStrike(t);
    if (
      score.balls < state.oversPerInnings * 6 &&
      !state.matchOver &&
      state.innings <= 2
    ) {
      askForNextBowler();
    }
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function applyExtra(type, batRuns) {
  if (state.matchOver) return;

  const t = state.battingTeam;
  const score = state.scores[t];
  const p = state.players[t];

  registerCurrentBowler();

  const label = type === "wide" ? "Wd" : "Nb";
  const totalExtraRuns = 1 + batRuns;

  pushHistory({
    type: "extra",
    teamKey: t,
    extraType: type,
    extraRuns: totalExtraRuns,
    batRuns,
    label: label + (batRuns ? batRuns : ""),
    bowler: state.currentBowler
  });

  if (type === "wide") {
    score.runs += totalExtraRuns;
    score.extras += totalExtraRuns;
  } else {
    score.runs += totalExtraRuns;
    score.extras += 1;

    if (batRuns > 0) {
      p.striker.runs += batRuns;
      registerBatsman(t, p.striker.name);
      const bs = state.battingStats[t];
      bs[p.striker.name].runs += batRuns;
    }
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function undoLast() {
  const h = state.history.pop();
  if (!h) return;

  const score = state.scores[h.teamKey];

  if (h.type === "legal") {
    score.runs -= h.runs;
    if (h.isWicket) score.wickets--;
    score.balls--;
  } else {
    score.runs -= h.extraRuns;
    if (h.extraType === "wide") {
      score.extras -= h.extraRuns;
    } else {
      score.extras -= 1;
    }
  }

  state.matchOver = false;
  els.resultText.textContent = "";
  refreshUI();
}

// ---------- Wicket ----------

function handleWicket() {
  if (state.matchOver) return;

  const t = state.battingTeam;
  const p = state.players[t];

  const outName = p.striker.name;

  registerBatsman(t, outName);
  const bs = state.battingStats[t];
  bs[outName].out = true;
  bs[outName].retired = false;

  state.retiredHurt[t] = state.retiredHurt[t].filter(n => n !== outName);

  handleLegalBall(0, "W", true);

  const retiredList = state.retiredHurt[t];
  let input;

  if (retiredList.length > 0) {
    input = prompt(
      `New batsman for ${outName}\nChoose from retired hurt: ${retiredList.join(
        ", "
      )}\nOR enter a new name`
    );
  } else {
    input = prompt(`New batsman replacing ${outName}?`);
  }

  let newName = input ? input.trim() : "";

  if (newName && retiredList.includes(newName)) {
    p.striker = {
      name: newName,
      runs: bs[newName].runs,
      balls: bs[newName].balls
    };
    bs[newName].retired = false;
    state.retiredHurt[t] = retiredList.filter(n => n !== newName);
  } else if (newName) {
    p.striker = { name: newName, runs: 0, balls: 0 };
    registerBatsman(t, newName);
  }

  const score = state.scores[t];
  if (score.balls % 6 === 0) {
    swapStrike(t);
    if (
      score.balls < state.oversPerInnings * 6 &&
      !state.matchOver &&
      state.innings <= 2
    ) {
      askForNextBowler();
    }
  }

  refreshUI();
}

// ---------- End innings / Result ----------

function checkResultOrEndByOvers() {
  const t = state.battingTeam;
  const score = state.scores[t];

  if (state.innings === 2 && state.target) {
    if (score.runs >= state.target) {
      snapshotCurrentInnings();
      showResult(`${currentBattingTeamName()} won`);
      return;
    }
  }

  if (score.balls >= state.oversPerInnings * 6) {
    if (state.innings === 1) {
      snapshotCurrentInnings();
      endInnings();
    } else {
      snapshotCurrentInnings();
      const diff = state.target - score.runs - 1;
      if (score.runs >= state.target) {
        showResult(`${currentBattingTeamName()} won`);
      } else {
        showResult(`${currentBowlingTeamName()} won by ${diff} runs`);
      }
    }
  }
}

function endInnings() {
  snapshotCurrentInnings();

  const t = state.battingTeam;
  const score = state.scores[t];

  if (state.innings === 1) {
    state.target = score.runs + 1;
    state.innings = 2;
    state.battingTeam = t === "A" ? "B" : "A";

    state.history = [];
    state.allBowlers = [];

    const newT = state.battingTeam;
    state.players[newT] = createDefaultPlayers(newT);
    state.battingStats[newT] = {};
    state.battingOrder[newT] = [];
    state.retiredHurt[newT] = [];
    initBattingForTeam(newT);

    alert(
      `Innings 1 done: ${score.runs}/${score.wickets}\nTarget for ${currentBattingTeamName()}: ${state.target}`
    );
  } else {
    const diff = state.target - score.runs - 1;
    if (score.runs >= state.target) {
      showResult(`${currentBattingTeamName()} won`);
    } else {
      showResult(`${currentBowlingTeamName()} won by ${diff} runs`);
    }
  }

  refreshUI();
}

function showResult(txt) {
  state.matchOver = true;
  els.resultText.textContent = txt;
}

// ---------- Reset ----------

function resetMatch() {
  state.innings = 1;
  state.battingTeam = "A";
  state.scores = {
    A: { runs: 0, wickets: 0, balls: 0, extras: 0 },
    B: { runs: 0, wickets: 0, balls: 0, extras: 0 }
  };
  state.players.A = createDefaultPlayers("A");
  state.players.B = createDefaultPlayers("B");
  state.battingStats = { A: {}, B: {} };
  state.battingOrder = { A: [], B: [] };
  state.retiredHurt = { A: [], B: [] };
  state.history = [];
  state.allBowlers = [];
  state.target = null;
  state.matchOver = false;
  state.matchSummary = { innings1: null, innings2: null };

  initBattingForTeam("A");
  initBattingForTeam("B");

  els.resultText.textContent = "";
  refreshUI();
}

// ---------- Retired Hurt ----------

function retireBatsman(isStriker) {
  const t = state.battingTeam;
  const p = state.players[t];
  const name = isStriker ? p.striker.name : p.nonStriker.name;

  if (!confirm(`${name} will be retired hurt. Continue?`)) return;

  registerBatsman(t, name);
  const bs = state.battingStats[t];
  bs[name].retired = true;
  bs[name].out = false;

  if (!state.retiredHurt[t].includes(name)) {
    state.retiredHurt[t].push(name);
  }

  const newName = prompt(`New batsman replacing ${name}?`);
  if (newName && newName.trim()) {
    const obj = { name: newName.trim(), runs: 0, balls: 0 };
    if (isStriker) p.striker = obj;
    else p.nonStriker = obj;
    registerBatsman(t, newName.trim());
  }

  refreshUI();
}

// ---------- Extra Modal ----------

function showExtraModal(type) {
  pendingExtraType = type;
  els.extraTitle.textContent =
    type === "wide" ? "Wide – runs off bat?" : "No ball – runs off bat?";

  els.extraButtons.innerHTML = "";
  for (let i = 0; i <= 6; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.onclick = () => {
      applyExtra(type, i);
      hideExtraModal();
    };
    els.extraButtons.appendChild(b);
  }

  els.extraModal.classList.add("show");
}

function hideExtraModal() {
  els.extraModal.classList.remove("show");
  pendingExtraType = null;
}

// ---------- Setup Modal ----------

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
  state.oversPerInnings = parseInt(els.oversInput.value, 10) || 10;

  resetMatch();
  closeSetup();
}

// ---------- Edit Batsmen ----------

function editBatsmen() {
  const t = state.battingTeam;
  const p = state.players[t];

  const oldS = p.striker.name;
  const oldN = p.nonStriker.name;

  let ns = prompt("Edit striker", oldS);
  if (ns !== null && ns.trim()) {
    renameBatsman(t, oldS, ns.trim());
    p.striker.name = ns.trim();
  }

  let nn = prompt("Edit non-striker", oldN);
  if (nn !== null && nn.trim()) {
    renameBatsman(t, oldN, nn.trim());
    p.nonStriker.name = nn.trim();
  }

  refreshUI();
}

// ---------- Event Listeners ----------

document.querySelectorAll(".run-btn").forEach(btn => {
  btn.onclick = () => {
    const r = parseInt(btn.dataset.runs, 10);
    handleLegalBall(r, String(r));
  };
});

document.querySelectorAll(".extra-btn").forEach(btn => {
  btn.onclick = () => showExtraModal(btn.dataset.type);
});

els.wicketBtn.onclick = handleWicket;
els.undoBtn.onclick = undoLast;

els.setupBtn.onclick = openSetup;
els.cancelSetupBtn.onclick = closeSetup;
els.saveSetupBtn.onclick = saveSetup;

els.editBatsmenBtn.onclick = editBatsmen;
els.changeBowlerBtn.onclick = editBowler;

els.endInningsBtn.onclick = endInnings;
els.resetBtn.onclick = resetMatch;

els.retireStrikerBtn.onclick = () => retireBatsman(true);
els.retireNonStrikerBtn.onclick = () => retireBatsman(false);

els.extraCancelBtn.onclick = hideExtraModal;

// ---------- Init ----------

refreshUI();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
