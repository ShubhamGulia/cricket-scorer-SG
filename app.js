const state = {
  teamA: "Cupcake",
  teamB: "Chips",
  oversPerInnings: 10,
  innings: 1, // 1 or 2
  battingTeam: "A", // "A" or "B"
  scores: {
    A: { runs: 0, wickets: 0, balls: 0, extras: 0, currentOver: [] },
    B: { runs: 0, wickets: 0, balls: 0, extras: 0, currentOver: [] }
  },
  target: null,
  history: [], // for undo
  matchOver: false
};

const els = {
  matchTitle: document.getElementById("matchTitle"),
  inningsInfo: document.getElementById("inningsInfo"),
  oversInfo: document.getElementById("oversInfo"),
  targetInfo: document.getElementById("targetInfo"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  extrasDisplay: document.getElementById("extrasDisplay"),
  currentOverBalls: document.getElementById("currentOverBalls"),
  resultText: document.getElementById("resultText"),
  setupModal: document.getElementById("setupModal"),
  teamAInput: document.getElementById("teamAInput"),
  teamBInput: document.getElementById("teamBInput"),
  oversInput: document.getElementById("oversInput"),
  undoBtn: document.getElementById("undoBtn"),
  setupBtn: document.getElementById("setupBtn"),
  endInningsBtn: document.getElementById("endInningsBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveSetupBtn: document.getElementById("saveSetupBtn"),
  cancelSetupBtn: document.getElementById("cancelSetupBtn"),
  wicketBtn: document.getElementById("wicketBtn")
};

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

  // Target
  if (state.innings === 2 && state.target != null) {
    els.targetInfo.classList.remove("hidden");
    els.targetInfo.textContent = `Target: ${state.target}`;
  } else {
    els.targetInfo.classList.add("hidden");
  }

  // Current over balls
  els.currentOverBalls.innerHTML = "";
  battingScore.currentOver.forEach((b) => {
    const span = document.createElement("span");
    span.className = "ball-badge";
    span.textContent = b;
    els.currentOverBalls.appendChild(span);
  });
}

function pushHistory(entry) {
  state.history.push(entry);
}

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
  score.currentOver.push(symbol);

  if (score.currentOver.length === 6) {
    score.currentOver = [];
  }

  checkResultOrEndByOvers();
  refreshUI();
}

function handleExtra(type) {
  if (state.matchOver) return;

  const teamKey = state.battingTeam;
  const score = state.scores[teamKey];

  let label = type === "wide" ? "Wd" : "Nb";

  const addBatRuns = parseInt(
    prompt("Runs scored off the bat? (0–6)", "0") || "0",
    10
  );
  const totalExtraRuns = 1 + (isNaN(addBatRuns) ? 0 : addBatRuns);

  pushHistory({
    type: "extra",
    teamKey,
    extraType: type,
    extraRuns: totalExtraRuns,
    label: label + (addBatRuns ? addBatRuns : "")
  });

  score.runs += totalExtraRuns;
  score.extras += totalExtraRuns;
  score.currentOver.push(label + (addBatRuns ? addBatRuns : ""));

  // no ball / wide do NOT add to legal balls

  if (score.currentOver.length === 6) {
    score.currentOver = [];
  }

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
    score.currentOver.pop();
  } else if (last.type === "extra") {
    score.runs -= last.extraRuns;
    score.extras -= last.extraRuns;
    score.currentOver.pop();
  }

  state.resultText = "";
  document.getElementById("resultText").textContent = "";
  state.matchOver = false;
  refreshUI();
}

function checkResultOrEndByOvers() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;
  const chasingScore =
    state.battingTeam === "A" ? state.scores.B : state.scores.A;

  // If innings 2 and target exists, see if chase complete
  if (state.innings === 2 && state.target != null) {
    if (battingScore.runs >= state.target) {
      showResult(`${currentBattingTeamName()} won by ${
        10 - battingScore.wickets
      } wickets`);
    }
  }

  // If all overs finished for this innings
  if (battingScore.balls >= state.oversPerInnings * 6) {
    if (state.innings === 1) {
      endInnings();
    } else {
      // chase ended by overs
      if (!state.matchOver) {
        if (battingScore.runs >= state.target) {
          showResult(`${currentBattingTeamName()} tied or won on last ball`);
        } else {
          const diff = state.target - battingScore.runs - 1;
          showResult(`${currentBowlingTeamName()} won by ${diff} runs`);
        }
      }
    }
  }
}

function showResult(text) {
  state.matchOver = true;
  document.getElementById("resultText").textContent = text;
}

function endInnings() {
  const battingScore =
    state.battingTeam === "A" ? state.scores.A : state.scores.B;

  if (state.innings === 1) {
    state.target = battingScore.runs + 1;
    state.innings = 2;
    state.battingTeam = state.battingTeam === "A" ? "B" : "A";
    alert(
      `Innings 1 complete: ${battingScore.runs}/${battingScore.wickets}. Target for ${currentBattingTeamName()} is ${state.target}.`
    );
  } else {
    // manual end of innings 2
    const chasingScore =
      state.battingTeam === "A" ? state.scores.A : state.scores.B;
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
  state.scores.A = { runs: 0, wickets: 0, balls: 0, extras: 0, currentOver: [] };
  state.scores.B = { runs: 0, wickets: 0, balls: 0, extras: 0, currentOver: [] };
  state.target = null;
  state.history = [];
  state.matchOver = false;
  document.getElementById("resultText").textContent = "";
  refreshUI();
}

// Setup modal
function openSetup() {
  els.teamAInput.value = state.teamA;
  els.teamBInput.value = state.teamB;
  els.oversInput.value = state.oversPerInnings;
  els.setupModal.classList.add("show");     // SHOW MODAL
}

function closeSetup() {
  els.setupModal.classList.remove("show");  // HIDE MODAL
}

function saveSetup() {
  state.teamA = els.teamAInput.value.trim() || "Team A";
  state.teamB = els.teamBInput.value.trim() || "Team B";
  const overs = parseInt(els.oversInput.value || "10", 10);
  state.oversPerInnings = Math.max(1, Math.min(overs, 50));
  resetMatch();
  closeSetup();
}

// Event listeners
document.querySelectorAll(".run-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const runs = parseInt(btn.dataset.runs, 10);
    handleLegalBall(runs, String(runs));
  });
});

document.querySelectorAll(".extra-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    handleExtra(btn.dataset.type);
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

// Initial UI
refreshUI();

// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  });
}
