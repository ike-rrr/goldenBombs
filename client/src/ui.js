import { playerColor, PLAYER_COLORS } from './game/palette.js';

const NAME_STORAGE_KEY = 'golden-bombs.player-name';

function element(id) {
  return document.getElementById(id);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class GameUI {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.screens = {
      menu: element('screen-menu'),
      lobby: element('screen-lobby'),
      game: element('screen-game'),
      results: element('screen-results'),
    };

    this.nameInput = element('player-name');
    this.codeInput = element('room-code');
    this.menuError = element('menu-error');
    this.createButton = element('btn-create');
    this.joinButton = element('btn-join');
    this.connectionStatus = element('connection-status');
    this.toast = element('toast');

    this.roomCodeDisplay = element('room-code-display');
    this.lobbySeconds = element('lobby-seconds');
    this.lobbyProgress = element('lobby-progress');
    this.lobbyPlayers = element('lobby-players');
    this.playerCount = element('player-count');
    this.startButton = element('btn-start');
    this.leaveButton = element('btn-leave');
    this.lobbyHint = element('lobby-hint');
    this.copyButton = element('btn-copy');
    this.copyLabel = element('copy-label');

    this.myCoins = element('my-coins');
    this.roundTimer = element('round-timer');
    this.scoreboard = element('scoreboard');
    this.roundBanner = element('round-banner');
    this.roundBannerTitle = element('round-banner-title');
    this.roundBannerSub = element('round-banner-sub');
    this.damageFlash = element('damage-flash');

    this.resultsTitle = element('results-title');
    this.resultsWinner = element('results-winner');
    this.resultsList = element('results-list');
    this.resultsReturn = element('results-return');
    this.resultsLeave = element('btn-results-leave');
    this.confetti = element('confetti');

    this.scoreElements = new Map();
    this.lobbyDeadline = 0;
    this.lobbyTotalMs = 30_000;
    this.resultsDeadline = 0;
    this.lobbyInterval = null;
    this.resultsInterval = null;
    this.bannerTimeout = null;
    this.copyTimeout = null;
    this.toastTimeout = null;
    this.connected = false;

    this.nameInput.value = localStorage.getItem(NAME_STORAGE_KEY) ?? '';
    this.bind();
    this.startLobbyTicker();
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  bind() {
    this.createButton.addEventListener('click', () => this.createRoom());
    this.joinButton.addEventListener('click', () => this.joinRoom());

    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.createRoom();
    });

    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    });
    this.codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.joinRoom();
    });

    this.startButton.addEventListener('click', () => this.handlers.onStart?.());
    this.leaveButton.addEventListener('click', () => this.handlers.onLeave?.());
    this.resultsLeave.addEventListener('click', () => this.handlers.onLeave?.());
    this.copyButton.addEventListener('click', () => this.copyRoomCode());

    for (const button of document.querySelectorAll('[data-dir]')) {
      const direction = button.dataset.dir;
      const press = (event) => {
        event.preventDefault();
        button.classList.add('pressed');
        this.handlers.onDirection?.(direction, true);
        if (button.setPointerCapture && event.pointerId !== undefined) {
          try {
            button.setPointerCapture(event.pointerId);
          } catch {
            // Ignore pointer capture failures on older browsers.
          }
        }
      };
      const release = (event) => {
        event.preventDefault();
        button.classList.remove('pressed');
        this.handlers.onDirection?.(direction, false);
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    const bombButton = element('touch-bomb');
    bombButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      bombButton.classList.add('pressed');
      this.handlers.onBomb?.();
    });
    const releaseBomb = () => bombButton.classList.remove('pressed');
    bombButton.addEventListener('pointerup', releaseBomb);
    bombButton.addEventListener('pointercancel', releaseBomb);
    bombButton.addEventListener('pointerleave', releaseBomb);
  }

  createRoom() {
    this.clearMenuError();
    const name = this.getPlayerName();
    this.setBusy(true);
    this.handlers.onCreate?.(name);
  }

  joinRoom() {
    this.clearMenuError();
    const code = this.codeInput.value.trim().toUpperCase();
    if (code.length !== 5) {
      this.showMenuError('Enter the 5-character room code.');
      return;
    }
    const name = this.getPlayerName();
    this.setBusy(true);
    this.handlers.onJoin?.(code, name);
  }

  getPlayerName() {
    const name = this.nameInput.value.trim().slice(0, 14) || 'Player';
    this.nameInput.value = name;
    localStorage.setItem(NAME_STORAGE_KEY, name);
    return name;
  }

  setBusy(busy) {
    this.createButton.disabled = busy || !this.connected;
    this.joinButton.disabled = busy || !this.connected;
    this.createButton.textContent = busy ? 'CONNECTING…' : 'CREATE ROOM';
  }

  setConnected(connected) {
    this.connected = connected;
    this.connectionStatus.classList.toggle('hidden', connected);
    this.connectionStatus.textContent = connected ? 'ONLINE' : 'CONNECTING…';
    this.setBusy(false);
  }

  setActionsEnabled(enabled) {
    this.startButton.disabled = !enabled;
  }

  showMenu() {
    this.showScreen('menu');
    this.setBusy(false);
    this.clearMenuError();
    this.clearLobbyTimer();
    this.clearResultsTimer();
    this.confetti.replaceChildren();
    this.scoreElements.clear();
    this.scoreboard.replaceChildren();
  }

  showLobby(room, myId) {
    this.currentRoom = room;
    this.myId = myId;
    this.showScreen('lobby');
    this.clearResultsTimer();
    this.confetti.replaceChildren();

    this.roomCodeDisplay.textContent = room.code;
    this.playerCount.textContent = `${room.players.length} / ${room.maxPlayers}`;

    this.lobbyDeadline = performance.now() + room.countdownMs;
    this.lobbyTotalMs = Math.max(30_000, room.countdownMs);
    this.updateLobbyClock();

    this.renderLobbyPlayers(room, myId);

    const isHost = room.hostId === myId;
    this.startButton.classList.toggle('hidden', !isHost);
    this.startButton.disabled = false;
    this.lobbyHint.textContent = isHost
      ? 'Start early — or wait for the 30-second countdown.'
      : 'The host can start early. Otherwise the match auto-starts.';

    if (this.copyLabel.textContent !== 'COPIED!') this.copyLabel.textContent = 'COPY';
  }

  renderLobbyPlayers(room, myId) {
    this.lobbyPlayers.replaceChildren();

    room.players.forEach((player) => {
      const palette = playerColor(player.colorIndex);
      const item = document.createElement('li');
      item.className = 'lobby-player';
      item.style.setProperty('--player-color', palette.css);

      const avatar = document.createElement('span');
      avatar.className = 'avatar-pixel';
      avatar.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'lobby-player-name';
      name.textContent = player.name;

      const badges = document.createElement('span');
      badges.className = 'lobby-badges';
      if (player.id === room.hostId) badges.append(this.makeBadge('HOST', 'host'));
      if (player.id === myId) badges.append(this.makeBadge('YOU', 'you'));

      item.append(avatar, name, badges);
      this.lobbyPlayers.append(item);
    });

    for (let index = room.players.length; index < room.maxPlayers; index += 1) {
      const empty = document.createElement('li');
      empty.className = 'lobby-player empty';
      empty.innerHTML = '<span class="avatar-pixel"></span><span class="lobby-player-name">WAITING FOR PLAYER…</span>';
      this.lobbyPlayers.append(empty);
    }
  }

  makeBadge(text, type) {
    const badge = document.createElement('span');
    badge.className = `badge badge-${type}`;
    badge.textContent = text;
    return badge;
  }

  startLobbyTicker() {
    this.lobbyInterval = window.setInterval(() => this.updateLobbyClock(), 100);
  }

  updateLobbyClock() {
    if (this.screens.lobby.classList.contains('hidden')) return;
    const remaining = Math.max(0, this.lobbyDeadline - performance.now());
    this.lobbySeconds.textContent = String(Math.ceil(remaining / 1000));
    const ratio = Math.max(0, Math.min(1, remaining / this.lobbyTotalMs));
    this.lobbyProgress.style.width = `${ratio * 100}%`;
  }

  clearLobbyTimer() {
    this.lobbyDeadline = 0;
  }

  async copyRoomCode() {
    const code = this.roomCodeDisplay.textContent;
    if (!code || code === '-----') return;

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const temporary = document.createElement('textarea');
      temporary.value = code;
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      document.execCommand('copy');
      temporary.remove();
    }

    this.copyLabel.textContent = 'COPIED!';
    clearTimeout(this.copyTimeout);
    this.copyTimeout = window.setTimeout(() => {
      this.copyLabel.textContent = 'COPY';
    }, 1_400);
  }

  showGame(players, myId) {
    this.myId = myId;
    this.showScreen('game');
    this.renderScoreboard(players, myId);
    this.damageFlash.classList.remove('flash');
  }

  renderScoreboard(players, myId) {
    this.scoreboard.replaceChildren();
    this.scoreElements.clear();

    for (const player of players) {
      const palette = playerColor(player.colorIndex);
      const chip = document.createElement('div');
      chip.className = 'score-chip';
      chip.style.setProperty('--player-color', palette.css);
      if (player.id === myId) chip.classList.add('is-you');

      const avatar = document.createElement('span');
      avatar.className = 'avatar-pixel small';

      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = player.name;

      const score = document.createElement('strong');
      score.className = 'score-value';
      score.textContent = `${player.coins}`;

      chip.append(avatar, name, score);
      this.scoreboard.append(chip);
      this.scoreElements.set(player.id, { chip, score });
    }
  }

  updateHud(state) {
    const me = state.players.find((player) => player.id === this.myId);
    if (me) this.myCoins.textContent = String(me.coins);

    this.roundTimer.textContent = formatTime(state.timeLeftMs);
    this.roundTimer.classList.toggle('urgent', state.timeLeftMs <= 10_000);

    const topCoins = Math.max(...state.players.map((player) => player.coins), 0);

    for (const player of state.players) {
      let entry = this.scoreElements.get(player.id);
      if (!entry) {
        this.renderScoreboard(state.players, this.myId);
        return;
      }
      if (entry.score.textContent !== String(player.coins)) {
        entry.score.textContent = String(player.coins);
      }
      entry.chip.classList.toggle('leader', topCoins > 0 && player.coins === topCoins);
    }

    for (const [id, entry] of this.scoreElements.entries()) {
      if (!state.players.some((player) => player.id === id)) {
        entry.chip.remove();
        this.scoreElements.delete(id);
      }
    }
  }

  showRoundBanner(durationMs) {
    clearTimeout(this.bannerTimeout);
    this.roundBannerTitle.textContent = 'COIN RUSH';
    this.roundBannerSub.textContent = `${Math.round(durationMs / 1000)} SECONDS · GO!`;
    this.roundBanner.classList.remove('hidden');
    this.roundBanner.classList.remove('pop');
    void this.roundBanner.offsetWidth;
    this.roundBanner.classList.add('pop');

    this.bannerTimeout = window.setTimeout(() => {
      this.roundBanner.classList.add('hidden');
    }, 1_700);
  }

  flashDamage() {
    this.damageFlash.classList.remove('flash');
    void this.damageFlash.offsetWidth;
    this.damageFlash.classList.add('flash');
  }

  showResults(payload) {
    this.showScreen('results');
    this.clearLobbyTimer();

    const winners = payload.ranking.filter((player) => payload.winnerIds.includes(player.id));
    const localWon = payload.winnerIds.includes(this.myId);
    const topCoins = payload.topCoins;

    if (winners.length > 1) {
      this.resultsTitle.textContent = localWon ? 'SHARED VICTORY!' : 'SHARED VICTORY';
      this.resultsWinner.textContent = `${winners.length} players tied with ${topCoins} coins!`;
    } else if (localWon) {
      this.resultsTitle.textContent = 'YOU WIN!';
      this.resultsWinner.textContent = `${winners[0]?.name ?? 'You'} grabbed ${topCoins} coins.`;
    } else {
      this.resultsTitle.textContent = `${winners[0]?.name ?? 'Someone'} WINS!`;
      this.resultsWinner.textContent = `${topCoins} coins — so close!`;
    }

    this.resultsList.replaceChildren();
    payload.ranking.forEach((player, index) => {
      const palette = playerColor(player.colorIndex);
      const item = document.createElement('li');
      item.className = 'result-row';
      item.style.setProperty('--player-color', palette.css);
      if (payload.winnerIds.includes(player.id)) item.classList.add('winner');

      const rank = document.createElement('span');
      rank.className = 'result-rank';
      rank.textContent = `#${index + 1}`;

      const avatar = document.createElement('span');
      avatar.className = 'avatar-pixel small';

      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = player.name;
      if (player.id === this.myId) name.textContent += ' (YOU)';

      const coins = document.createElement('strong');
      coins.className = 'result-coins';
      coins.textContent = `${player.coins} ◆`;

      item.append(rank, avatar, name, coins);
      this.resultsList.append(item);
    });

    const resultWindow = payload.resultsEndsAt - payload.serverNow;
    this.resultsDeadline = performance.now() + resultWindow;
    this.updateResultsClock();
    this.startResultsTicker();
    this.renderConfetti(localWon ? 70 : 40);
  }

  startResultsTicker() {
    this.clearResultsTimer();
    this.resultsInterval = window.setInterval(() => this.updateResultsClock(), 150);
  }

  updateResultsClock() {
    if (this.screens.results.classList.contains('hidden')) return;
    const remaining = Math.max(0, this.resultsDeadline - performance.now());
    this.resultsReturn.textContent = `Returning to lobby in ${Math.ceil(remaining / 1000)}…`;
  }

  clearResultsTimer() {
    if (this.resultsInterval) {
      clearInterval(this.resultsInterval);
      this.resultsInterval = null;
    }
  }

  renderConfetti(count) {
    this.confetti.replaceChildren();
    const colors = PLAYER_COLORS.map((palette) => palette.css);
    colors.push('#ffd447', '#fff8df');

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty('--confetti-color', colors[index % colors.length]);
      piece.style.setProperty('--fall-duration', `${2 + Math.random() * 2.4}s`);
      piece.style.setProperty('--fall-delay', `${Math.random() * 2.2}s`);
      piece.style.width = `${5 + Math.floor(Math.random() * 6)}px`;
      piece.style.height = `${5 + Math.floor(Math.random() * 6)}px`;
      this.confetti.append(piece);
    }
  }

  showScreen(name) {
    for (const [screenName, screen] of Object.entries(this.screens)) {
      screen.classList.toggle('hidden', screenName !== name);
    }
  }

  showToast(message, type = 'info') {
    this.toast.textContent = message;
    this.toast.className = `toast visible toast-${type}`;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 3_200);
  }

  showMenuError(message) {
    this.menuError.textContent = message;
  }

  clearMenuError() {
    this.menuError.textContent = '';
  }

  showConnectionLost() {
    this.setConnected(false);
    this.showMenu();
    this.showToast('Connection lost. Please rejoin.', 'error');
  }
}
