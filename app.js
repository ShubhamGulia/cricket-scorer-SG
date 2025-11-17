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
  target: null,
  history: [],
  matchOver: false
};

// ------------------ DOM refs ------------------

const els = {
  matchTitle: document.getElementById("matchTitle"),
  inningsInfo: document.getElementById("inningsInfo"),
  oversInfo: document.getElementById("oversInfo"),
  targetInfo: document.getElementById("targetInfo"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  extrasDisplay: document.getElementById("extrasDisplay"),
  currentOverBalls: document.getElementById("currentOverBalls"),
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

// ------------------ Helpers ------------------

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

  // Current over from history
  els.currentOverBalls.innerHTML = "";
  const currentOverEvents = getCurrentOverEvents(state.battingTeam);
  currentOverEvents.forEach((text) => {
    const span = document.createElement("span");
    span.className = "ball-badge";
    span.textContent = text;
    els.currentOverBalls.appendChild(span);
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

  pushHistory({
    type: "legal",
    teamKey,
    runs,
    isWicket,
    symbol
  });

  score.runs += runs;
  if (isWicket) score.wickets += 1;

  score.balls += 1;

  checkResultOrEndByOvers();
  refreshUI();
}

function applyExtra(type, batRuns) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];

  const label = type === "wide" ? "Wd" : "Nb";
  const totalExtraRuns = 1 + batRuns;

  pushHistory({
    type: "extra",
    teamKey,
    extraType: type,
    extraRuns: totalExtraRuns,
    label: label + (batRuns ? batRuns : "")
  });

  score.runs += totalExtraRuns;
  score.extras += totalExtraRuns;

  checkResultOrEndByOvers();
  refreshUI();
}

function undoLast() {
  const last = state.history.pop();
  if (!last || state.matchOver) return;

  const score = state.scores[last.teamKey];

  if (last.type === "legal") {
    score.runs -= last.runs;
    if (last.isWicket) score.wickets -= 1;
    score.balls -= 1;
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
    state.history = []; // new innings
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
  state.target = null;
  state.history = [];
  state.matchOver = false;
  els.resultText.textContent = "";
  refreshUI();
}

// ------------------ Modals ------------------

// Match setup
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

els.wicketBtn.addEventListener("click", () => {
  handleLegalBall(0, "W", true);
});

els.undoBtn.addEventListener("click", undoLast);
els.setupBtn.addEventListener("click", openSetup);
els.cancelSetupBtn.addEventListener("click", closeSetup);
els.saveSetupBtn.addEventListener("click", saveSetup);
els.endInningsBtn.addEventListener("click", endInnings);
els.resetBtn.addEventListener("click", resetMatch);

els.extraCancelBtn.addEventListener("click", hideExtraModal);

// ------------------ Init ------------------

refreshUI();

// If you use a service worker for PWA:
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  });
}
