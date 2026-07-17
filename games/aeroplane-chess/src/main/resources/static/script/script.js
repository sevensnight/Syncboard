var number_of_player = 4,
	number_of_chess = 4,
	number_of_steps_0 = [1, 3, 4, 6, 4, 3, 6, 3, 4, 6, 4, 3, 3, 5, 1],
	number_of_steps_1 = [1, 4, 3, 6, 3, 4, 6, 4, 3, 6, 3, 4, 3, 5, 1],
	number_of_steps_p1 = 0,
	number_of_steps_p2 = 1,
	number_of_steps_p3 = 0,
	number_of_steps_p4 = 1,
	turn_of_steps = ['r', 'u', 'r', 'd', 'r', 'd', 'l', 'd', 'l', 'u', 'l', 'u'],
	turn_of_steps_p1 = 'd',
	turn_of_steps_p2 = 'l',
	turn_of_steps_p3 = 'u',
	turn_of_steps_p4 = 'r',
	/* color */
	color_p1 = 'yellow',
	color_p2 = 'blue',
	color_p3 = 'green',
	color_p4 = 'red',
	color_of_steps = [color_p4, color_p1, color_p2, color_p3],
	color_of_steps_p1 = 0,
	color_of_steps_p2 = 1,
	color_of_steps_p3 = 2,
	color_of_steps_p4 = 3,
	/* common */
	common_distance = 10,
	/* container chess */
	container_chess_sky_prefix = 'sk',
	container_chess_land_prefix = 'ld',
	container_chess_goal_prefix = 'go',
	container_chess_sky_points = [3, 16, 29, 42];
	container_chess_common_radius = 19,
	container_chess_common_startAngle = 0,
	container_chess_common_endAngle = 2 * Math.PI,
	container_chess_common_distance = 2 * container_chess_common_radius,
	container_chess_common_distance_2 = common_distance % (container_chess_common_radius / common_distance),
	container_chess_c1_x = container_chess_common_radius,
	container_chess_c1_y = container_chess_common_radius,
	container_chess_c2_x = container_chess_c1_x + container_chess_common_distance + common_distance,
	container_chess_c2_y = container_chess_c1_y,
	container_chess_c3_x = container_chess_c1_x,
	container_chess_c3_y = container_chess_c2_y + container_chess_common_distance + common_distance,
	container_chess_c4_x = container_chess_c2_x,
	container_chess_c4_y = container_chess_c3_y,
	/* container home */
	container_home_prefix = 'ba',
	container_home_common_distance = common_distance * 2 - container_chess_common_radius,
	container_home_common_width = number_of_chess * container_chess_common_radius + common_distance,
	container_home_common_height = container_home_common_width,
	container_home_p1_x = container_chess_common_radius + container_chess_common_distance,
	container_home_p1_y = container_chess_common_radius,
	container_home_p2_x = 13 * container_chess_common_distance + common_distance,
	container_home_p2_y = container_home_p1_y + container_home_common_distance,
	container_home_p3_x = container_home_p2_x - container_chess_common_distance,
	container_home_p3_y = container_home_p2_x,
	container_home_p4_x = container_home_p1_x - container_chess_common_distance,
	container_home_p4_y = container_home_p3_y,
	/* container player chess */
	container_start_prefix = 'to',
	container_start_common_distance = 3 * container_chess_common_radius,
	container_start_p1_x = container_chess_c3_x + container_chess_common_distance_2,
	container_start_p1_y = container_chess_c3_y + container_start_common_distance + common_distance,
	container_start_p1_p = 0,
	container_start_p2_x = container_chess_c1_x - container_start_common_distance - common_distance + container_chess_common_distance_2,
	container_start_p2_y = container_chess_c1_y,
	container_start_p2_p = 3,
	container_start_p3_x = container_chess_c2_x,
	container_start_p3_y = container_chess_c2_y - container_start_common_distance - common_distance,
	container_start_p3_p = 6,
	container_start_p4_x = container_start_p3_x + container_start_common_distance + common_distance,
	container_start_p4_y = container_chess_c3_y,
	container_start_p4_p = 9,
	/* canvas */
	canvas_width = container_home_p2_x + container_home_common_width,
	canvas_height = container_home_p2_x + (2 * container_home_common_width),
	/* players */
	p1, p2, p3, p4,
	/* color */
	system_color = '#1520ffb3',
	system_default_color = '#565656',
	system_alert_color = '#ce0000';

var sessionId,
	gameId,
	diceInterval,
	countDownInterval,
	index,
	dices = ['&#9856;', '&#9857;', '&#9858;', '&#9859;', '&#9860;', '&#9861;' ],
	colors =	["黄方", "蓝方", "绿方", "红方" ],
	sockjs,
	stompClient,
	selectedBotCount = 0,
	hasJoinedRoom = false,
	hasPressedReady = false,
	hostSessionId = '',
	isLobbyHost = false,
	readySessionIds = [],
	lastPlayersSnapshot = [],
	winnerBanner,
	winnerDesc,
	winnerConfirm,
	rematchButton,
	lobbyMenu,
	lobbyWaiting,
	boardMask;

var board,
	boardChess,
	boardHover;

window.addEventListener('load', () => {
	board = document.getElementById("board");
	boardChess = document.getElementById('board-chess');
	boardHover = document.getElementById('board-hover');

	/* board */
	resizeCanvas(board);
	resizeCanvas(boardChess);
	resizeCanvas(boardHover);
	elementlDisabled('roll', true);

	var i;
	/* player */
	for (i = 1; i <= number_of_player; i++) {
		this[`p${i}`] = new Player(`玩家 ${i}`, this[`number_of_steps_p${i}`], this[`turn_of_steps_p${i}`],
			this[`color_p${i}`], this[`color_of_steps_p${i}`],
			new Container_Home(this[`container_home_p${i}_x`], this[`container_home_p${i}_y`]),
			new Container_Start(this[`container_start_p${i}_x`], this[`container_start_p${i}_y`], this[`container_start_p${i}_p`])
		);

		for (j = 1; j <= number_of_chess; j++)
			this[`p${i}`].addChess(new Chess(`棋子 ${j}`, this[`container_chess_c${j}_x`], this[`container_chess_c${j}_y`]))
	}

	drawCanvas(board, boardChess);

	var nameInput = document.getElementById('name');
	if (nameInput && typeof initialUsername === 'string') {
		var normalizedInitialUsername = initialUsername.trim();
		if (normalizedInitialUsername && normalizedInitialUsername.toLowerCase() !== 'null')
			nameInput.value = normalizedInitialUsername;
	}

	winnerBanner = document.getElementById('winner-banner');
	winnerDesc = document.getElementById('winner-desc');
	winnerConfirm = document.getElementById('winner-confirm');
	rematchButton = document.getElementById('rematch-button');
	lobbyMenu = document.getElementById('lobby-menu');
	lobbyWaiting = document.getElementById('lobby-waiting');
	boardMask = document.getElementById('board-mask');

	var source = new URLSearchParams(window.location.search).get('source');

	// Surface room binding early (gameId is the SyncBoard room name).
	var roomHint = document.getElementById('room-binding-hint');
	var gameIdSpan = document.getElementById('game-id-span');
	var lobbyRoomLabel = document.getElementById('lobby-room-label');
	if (typeof gameId === 'string' && gameId && gameId.toLowerCase() !== 'null') {
		if (gameIdSpan)
			gameIdSpan.textContent = ` ${gameId}`;
		if (roomHint)
			roomHint.textContent = source === 'syncboard'
				? `当前房间：${gameId}（与 SyncBoard 房间绑定，同房间的人进同一局）`
				: `当前房间：${gameId}`;
		if (lobbyRoomLabel)
			lobbyRoomLabel.textContent = `房间：${gameId} · 先选模式，再进入大厅`;
	}

	bindBotCountButtons(document.getElementById('bot-count-options'));
	bindBotCountButtons(document.getElementById('waiting-bot-count-options'));
	setSelectedBotCount(0);

	var enterRoomBtn = document.getElementById('enter-room-btn');
	if (enterRoomBtn)
		enterRoomBtn.addEventListener('click', enterRoom);

	var readyBtn = document.getElementById('ready-btn');
	if (readyBtn)
		readyBtn.addEventListener('click', pressReady);

	var leaveRoomBtn = document.getElementById('leave-room-btn');
	if (leaveRoomBtn)
		leaveRoomBtn.addEventListener('click', leaveToMenu);

	if (winnerConfirm)
		winnerConfirm.addEventListener('click', () => {
			hideWinnerBanner();
			leaveToMenu();
		});

	if (rematchButton)
		rematchButton.addEventListener('click', requestRematch);

	// Stay on start menu — do NOT auto-start (even from SyncBoard).
	showLobbyMenu();
})

var bindBotCountButtons = (container) => {
	if (!container)
		return;
	container.querySelectorAll('[data-bot-count]').forEach((button) => {
		button.addEventListener('click', () => {
			var count = Number(button.dataset.botCount);
			if (!Number.isFinite(count))
				return;
			if (hasJoinedRoom && !isLobbyHost) {
				appendSystemMessage('只有房主可以修改机器人数量。', system_alert_color);
				return;
			}
			setSelectedBotCount(count);
			if (hasJoinedRoom && stompClient && gameId && isLobbyHost)
				sendBotCountConfig(selectedBotCount);
			updateLobbyTip();
		});
	});
};

var setSelectedBotCount = (count) => {
	selectedBotCount = Math.max(0, Math.min(3, Number(count) || 0));
	document.querySelectorAll('[data-bot-count]').forEach((button) => {
		var value = Number(button.dataset.botCount);
		button.classList.toggle('is-active', value === selectedBotCount);
		// In waiting lobby, only host may change bot count.
		if (button.closest('#waiting-bot-count-options'))
			button.disabled = hasJoinedRoom && !isLobbyHost;
	});
	updateLobbyTip();
};

var updateLobbyTip = () => {
	var tip = document.getElementById('lobby-tip');
	var waitingStatus = document.getElementById('waiting-status');
	if (tip) {
		tip.innerHTML = selectedBotCount === 0
			? '选 0：联机模式，房间内所有真人都点「准备」后开局。<br/>选 1–3：由<strong>房主</strong>设定；全员准备后才补机器人开局。'
			: `当前机器人：${selectedBotCount}（房主可改）。全员准备后才会加入机器人，避免有人未进房就开局。`;
	}
	if (waitingStatus && hasJoinedRoom && !hasPressedReady) {
		var hostHint = isLobbyHost ? '你是房主，可设置机器人数量。' : '房主可设置机器人；你只需准备。';
		waitingStatus.textContent = selectedBotCount === 0
			? `联机模式：等待所有真人准备。${hostHint}`
			: `人机模式（${selectedBotCount} bot）：全员准备后补机器人。${hostHint}`;
	}
};

var applyLobbyHostState = (nextHostSessionId) => {
	hostSessionId = nextHostSessionId || '';
	isLobbyHost = Boolean(sessionId && hostSessionId && sessionId === hostSessionId);
	setSelectedBotCount(selectedBotCount);
	var hostBadge = document.getElementById('waiting-host-badge');
	if (hostBadge)
		hostBadge.textContent = isLobbyHost ? '你是房主' : (hostSessionId ? '房主已指定' : '等待房主');
};

var sendBotCountConfig = (count) => {
	if (!stompClient || !gameId)
		return;
	var normalized = Math.max(0, Math.min(3, Number(count) || 0));
	stompClient.send(`/app/config/${gameId}/bot-count/${normalized}`);
};

var showLobbyMenu = () => {
	if (boardMask)
		boardMask.style.display = '';
	if (lobbyMenu)
		lobbyMenu.classList.remove('hidden');
	if (lobbyWaiting)
		lobbyWaiting.classList.add('hidden');
	hasJoinedRoom = false;
	hasPressedReady = false;
};

var showWaitingLobby = () => {
	if (boardMask)
		boardMask.style.display = '';
	if (lobbyMenu)
		lobbyMenu.classList.add('hidden');
	if (lobbyWaiting)
		lobbyWaiting.classList.remove('hidden');
	var waitingRoomLabel = document.getElementById('waiting-room-label');
	if (waitingRoomLabel)
		waitingRoomLabel.textContent = `房间：${gameId || '—'}`;
	updateLobbyTip();
};

var hideLobbyOverlay = () => {
	if (boardMask)
		boardMask.style.display = 'none';
};

var join = (name) => {
	sockjs = new SockJS('/aeroplanechess-websocket'),
	stompClient = Stomp.over(sockjs);

	/* socket */
	stompClient.connect({}, function(frame) {
		console.log('Connected: ' + frame);
		sessionId = /\/([^\/]+)\/websocket/.exec(sockjs._transport.url)[1];
		console.log("connected, session id: " + sessionId);

		stompClient.subscribe(`/game/${gameId}/error`, function(res) {
			var body = JSON.parse(res.body)
			appendSystemMessage(`错误：${body.message}！`, system_alert_color);
			appendSystemMessage(`请刷新后重试！`, system_alert_color);
			end();
		});

		stompClient.subscribe(`/game/joined-${sessionId}`, function(res) {
			res = JSON.parse(res.body);
			gameId = res["game-id"];
			document.getElementById('game-id-span').innerHTML = ` ${gameId}`;
			document.getElementById('game-id-hidden').value = `${location.origin}#${gameId}`;
			document.getElementById('game-id').addEventListener('click', () => {
				console.log(gameId);
				document.getElementById('game-id-hidden').select();
				try {
					var successful = document.execCommand('copy');
					var msg = successful ? '复制成功' : '复制失败';
					console.log(msg);
				} catch (err) {
					console.log('复制失败');
				}
			})
			if(res.error) {
				appendSystemMessage('错误：游戏已满或等待列表中不存在该房间。', system_alert_color);
				appendSystemMessage(`请刷新后重试！`, system_alert_color);
				end();
				return;
			}
			index = res.index + 1;
			hasJoinedRoom = true;
			showWaitingLobby();
			joined();
		});

		stompClient.send(`/app/join/${gameId}/${name}`);
	});
}

var enterRoom = () => {
	var name = document.getElementById('name').value || '玩家';
	hideWinnerBanner();
	hasPressedReady = false;
	join(name);
	appendSystemMessage(`欢迎 ${name}！`);
	appendSystemMessage('已进入房间大厅，选择机器人数量后点击「准备 / 开始」。');
};

var pressReady = () => {
	if (!stompClient || !gameId || !hasJoinedRoom) {
		appendSystemMessage('请先进入房间。', system_alert_color);
		return;
	}
	hasPressedReady = true;
	// Host syncs bot count once more; non-host only marks ready.
	if (isLobbyHost)
		sendBotCountConfig(selectedBotCount);
	stompClient.send(`/app/ready/${gameId}`);
	var readyBtn = document.getElementById('ready-btn');
	if (readyBtn) {
		readyBtn.disabled = true;
		readyBtn.textContent = '已准备，等待全员…';
	}
	var waitingStatus = document.getElementById('waiting-status');
	if (waitingStatus) {
		waitingStatus.textContent = selectedBotCount > 0
			? `已准备。待房间内所有真人都准备后，再加入 ${selectedBotCount} 个机器人开局。`
			: '已准备，等待其他真人玩家准备（至少 2 人）…';
	}
	appendSystemMessage(selectedBotCount > 0
		? '你已准备。机器人会在全员准备后加入，不会提前开局。'
		: '你已准备，等待其他真人玩家准备（至少 2 人）。', system_color);
};

var leaveToMenu = () => {
	clearInterval(diceInterval);
	clearInterval(countDownInterval);
	hasJoinedRoom = false;
	hasPressedReady = false;
	hostSessionId = '';
	isLobbyHost = false;
	sessionId = null;
	index = null;
	if (stompClient) {
		try {
			stompClient.disconnect(() => {
				console.log('disconnected');
			});
		} catch (_error) {
		}
		stompClient = null;
	}
	sockjs = null;
	var readyBtn = document.getElementById('ready-btn');
	if (readyBtn) {
		readyBtn.disabled = false;
		readyBtn.textContent = '准备 / 开始';
	}
	var list = document.getElementById('lobby-player-list');
	if (list)
		list.innerHTML = '';
	showLobbyMenu();
	appendSystemMessage('已返回开始菜单。');
};

// Keep legacy name used by old form actions if any.
var start = enterRoom;

var end = () => {
	clearInterval(diceInterval);
	clearInterval(countDownInterval);
	if (stompClient)
		stompClient.disconnect(() => {
			console.log('disconnected');
		})
}

var resizeCanvas = (canvas) => {
	canvas.width = canvas_width;
	canvas.height = canvas_height;
}

var drawCanvas = (canvas, canvas_top) => {
	var ctx = canvas.getContext('2d'), ctx_top = canvas_top.getContext('2d'), player, chess, i, j, k, x, y, p, t, tp, n, nc, sc, color, c, s, shortCut;
	for (i = 1; i <= number_of_player; i++)	{
		player = this[`p${i}`];
		nc = 0;
		shortCut = 0;

		color = player.color;
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.fillStyle = color;
		ctx.shadowColor = '#999';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx_top.strokeStyle = '#999';
		ctx_top.lineWidth = 0.5;
		ctx_top.fillStyle = color;
		ctx.globalAlpha = 0.4;
		ctx_top.font = 'bold 30px Arial';
		ctx_top.shadowColor = '#999';
		ctx_top.shadowBlur = 2;
		ctx_top.shadowOffsetX = 2;
		ctx_top.shadowOffsetY = 2;
		// container home
		ctx.fillRect(player.container_home.x, player.container_home.y, container_home_common_width, container_home_common_height);
		ctx.fillStyle = 'white';
		// chess home point
		for (j = 0; j < player.chess.length; j++)	{
			ctx.beginPath();
			ctx.globalAlpha = 0.4;
			ctx.arc(player.container_home.x + player.chess[j].x, player.container_home.y + player.chess[j].y, container_chess_common_radius, container_chess_common_startAngle, container_chess_common_endAngle);
			ctx.stroke();
			ctx.fill();
			ctx_top.beginPath();
			ctx_top.drawImage(document.getElementById(`game-chess-hidden-${i}`), player.container_home.x + player.chess[j].x - common_distance, player.container_home.y + player.chess[j].y - common_distance, container_chess_common_radius, container_chess_common_radius);
			//ctx_top.fillText(j + 1, player.container_home.x + player.chess[j].x - common_distance, player.container_home.y + player.chess[j].y + common_distance);
			//ctx_top.strokeText(j + 1, player.container_home.x + player.chess[j].x - common_distance, player.container_home.y + player.chess[j].y + common_distance);
			player.addFlow(`${container_home_prefix}${j}`, player.container_home.x + player.chess[j].x, player.container_home.y + player.chess[j].y);
		}
		// chess start point
		x = player.container_home.x + player.container_start.x;
		y = player.container_home.y + player.container_start.y;
		ctx.beginPath();
		ctx.shadowColor = '#999';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetX = 2;
		ctx.shadowOffsetY = 2;
		ctx.arc(x, y, container_chess_common_radius, container_chess_common_startAngle, container_chess_common_endAngle);
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.fill();
		ctx.stroke();
		player.addFlow(`${container_start_prefix}${i - 1}`, x, y);

		p = player.container_start.p;
		s = player.number_of_steps;
		c = player.color_of_steps;
		sc = (i - 1) * 5;
		for (j = 0; j < this[`number_of_steps_${s}`].length; j++) {
			tp = t;
			t = j === 0? player.turn_of_steps : turn_of_steps[p];
			for (k = 0; k < this[`number_of_steps_${s}`][j]; k++) {
				shortCut++;
				if (shortCut === 19) {
					ctx.beginPath();
					ctx.strokeStyle = color;
					ctx.setLineDash([5, 3]);
					ctx.beginPath();
					ctx.moveTo(x, y);
					n = turn[tp](x, y, container_chess_common_distance * 6);
					ctx.lineTo(n.x, n.y);
					ctx.stroke();
				}
				color = (j + 1) >= this[`number_of_steps_${s}`].length - 1? player.color : color_of_steps[c];
				n = turn[t](x, y, container_chess_common_distance);
				x = n.x;
				y = n.y;
				ctx.beginPath();
				ctx.setLineDash([1, 0]);
				ctx.arc(x, y, container_chess_common_radius, container_chess_common_startAngle, container_chess_common_endAngle);
				ctx.strokeStyle = color;
				ctx.globalAlpha = (j + 1) >= this[`number_of_steps_${s}`].length - 1? 0.4 : 0.2;
				ctx.fillStyle = color;
				ctx.fill();
				ctx.stroke();
				if (j === this[`number_of_steps_${s}`].length - 1) {
					player.addFlow(`${container_chess_goal_prefix}`, x, y);
				} else if (j === this[`number_of_steps_${s}`].length - 2) {
					player.addFlow(`${container_chess_land_prefix}${sc + k}`, x, y);
				} else {
					var calc = container_chess_sky_points[i - 1] + nc >= 52? (container_chess_sky_points[i - 1] + nc) % 52 : container_chess_sky_points[i - 1] + nc;
					player.addFlow(`${container_chess_sky_prefix}${calc}`, x, y);
				}
				c++;
				if (c === number_of_player)
					c = 0;
				nc++;
			}
			if (j != 0) {
				p++;
				if (p === turn_of_steps.length)
				p = 0;
			}
		}
	}
}

var renderLobbyPlayerList = (players) => {
	var list = document.getElementById('lobby-player-list');
	if (!list)
		return;
	lastPlayersSnapshot = players || [];
	var html = '';
	for (var i = 0; i < number_of_player; i++) {
		var player = players[i];
		var label = '(空位)';
		var extra = '';
		var ready = false;
		var isHostSeat = false;
		if (player != null) {
			label = player.name || '玩家';
			if (sessionId == player.sessionId)
				extra = ' · 你';
			else if (String(player.sessionId || '').indexOf('bot:') === 0)
				extra = ' · 机器人';
			ready = readySessionIds.indexOf(player.sessionId) >= 0;
			isHostSeat = hostSessionId && player.sessionId === hostSessionId;
			if (isHostSeat)
				extra += ' · 房主';
		}
		html += `<li class="lobby-seat${ready ? ' is-ready' : ''}"><span class="lobby-seat-index">座位 ${i + 1}</span><span class="lobby-seat-name">${label}${extra}</span>${ready ? '<span class="lobby-seat-ready">已准备</span>' : '<span class="lobby-seat-ready" style="color:#94a3b8">未准备</span>'}</li>`;
	}
	list.innerHTML = html;
};

var requestRematch = () => {
	if (!stompClient || !gameId) {
		// Socket already closed after win — re-enter room as fresh lobby.
		hideWinnerBanner();
		showLobbyMenu();
		enterRoom();
		return;
	}
	stompClient.send(`/app/rematch/${gameId}`);
	hideWinnerBanner();
	appendSystemMessage('已请求再来一局，正在重置大厅…', system_color);
};

var joined = () => {
	stompClient.subscribe(`/game/${gameId}/player-list`, function(res) {
		var name,
			player,
			players = JSON.parse(res.body).players;

		for (var i in players) {
			player = players[i];
			if (player == null)
				name = '(空位)';
			else {
				name = player.name;
				if (sessionId == player.sessionId)
					name += ' (你)';
			}
			document.getElementById(`p${Number(i) + 1}-info-name`).innerHTML = name;
		}
		renderLobbyPlayerList(players);
	});

	stompClient.subscribe(`/game/${gameId}/bot-fill-config`, function(res) {
		var body = JSON.parse(res.body);
		var count = Number(body.count);
		if (!Number.isFinite(count))
			count = body.enabled ? 3 : 0;
		setSelectedBotCount(count);
		appendSystemMessage(count > 0
			? `房主将机器人数量设为 ${count}`
			: '房主已切换为纯联机（0 机器人）');
	});

	stompClient.subscribe(`/game/${gameId}/lobby-meta`, function(res) {
		var body = JSON.parse(res.body);
		var count = Number(body.botCount);
		var previousHost = hostSessionId;
		if (Number.isFinite(count))
			setSelectedBotCount(count);
		applyLobbyHostState(body.hostSessionId || '');
		if (previousHost !== hostSessionId) {
			appendSystemMessage(isLobbyHost
				? '你是本局房主，可设置机器人数量。'
				: '房主已更新。');
		}
	});

	stompClient.subscribe(`/game/${gameId}/lobby-error-${sessionId}`, function(res) {
		var body = JSON.parse(res.body);
		appendSystemMessage(body.message || '大厅操作被拒绝', system_alert_color);
	});

	stompClient.subscribe(`/game/${gameId}/ready-status`, function(res) {
		var body = JSON.parse(res.body);
		readySessionIds = Array.isArray(body.readySessionIds) ? body.readySessionIds : [];
		renderLobbyPlayerList(lastPlayersSnapshot);
		var names = Array.isArray(body.readyNames) ? body.readyNames : [];
		if (names.length)
			appendSystemMessage(`已准备：${names.join('、')}`);
	});

	stompClient.subscribe(`/game/${gameId}/rematch`, function(res) {
		var body = JSON.parse(res.body);
		hideWinnerBanner();
		hasPressedReady = false;
		readySessionIds = [];
		// Reconnect lobby UI and re-join seats.
		if (stompClient) {
			try { stompClient.disconnect(); } catch (_e) {}
			stompClient = null;
		}
		showLobbyMenu();
		appendSystemMessage('房主发起再来一局，正在重新进入大厅…', system_color);
		window.setTimeout(() => {
			enterRoom();
		}, 250);
	});

	stompClient.subscribe(`/game/${gameId}/bot-thinking`, function(res) {
		var body = JSON.parse(res.body),
			waitSeconds = Number(body['wait-ms'] || 0) / 1000,
			playerNumber = Number(body.player) + 1;
		appendSystemMessage(`玩家 ${playerNumber}（机器人）正在思考${waitSeconds > 0 ? `（约 ${waitSeconds.toFixed(1)} 秒）` : ''}...`);
	});

	stompClient.subscribe(`/game/${gameId}/roll-result`, function(res) {
		var body = JSON.parse(res.body);
		if (index === (body.current + 1))
			appendSystemMessage(`你：\t掷出 ${body.roll}`);
		else
			appendSystemMessage(`玩家 ${body.current + 1}：\t掷出 ${body.roll}`);
		clearInterval(diceInterval);
		dice.innerHTML = dices[Number(body.roll) - 1];
	});

	stompClient.subscribe(`/game/${gameId}/move-${sessionId}`, function(res) {
		appendSystemMessage('请选择一个棋子移动！', system_alert_color);
		countDown(() => {
			Array.from(document.getElementById(`p${index}`).getElementsByClassName('chess')).some((element) => {
				if (!element.disabled) {
					element.click();
					return true;
				}
				return false;
			});
		});
	});

	stompClient.subscribe(`/game/${gameId}/move-result`, function(res) {
		var body = JSON.parse(res.body);
		appendSystemMessage('系统：\t已完成移动');
		ctx_top = boardChess.getContext('2d');
		ctx_top.clearRect(0, 0, boardChess.width, boardChess.height);
		infoDisabled(true);
		if (!body.leaved) {
			countDown(() => {
				if (!document.getElementById('roll').disabled)
					document.getElementById('roll').click();
			});
		} else {
			appendSystemMessage(`${colors[body.leaved]} 已离开游戏，该玩家所有飞机已回到基地。`);
		}
		var aeroplanes = body.aeroplanes,
			player,
			player_flow,
			player_chess,
			player_pos;
		ctx_top.font = 'bold 30px Arial';
		for (var i in aeroplanes) {
			player = this[`p${aeroplanes[i].color + 1}`];
			ctx_top.beginPath();
			player_chess = document.getElementById(`p${aeroplanes[i].color + 1}-c${i - (aeroplanes[i].color * 4)}`);
			if (aeroplanes[i].inCellId.indexOf(container_chess_goal_prefix) === 0) {
				player_pos = container_chess_goal_prefix;
				player_chess.style.background = 'grey';
			} else if (aeroplanes[i].inCellId.indexOf(container_home_prefix) === 0) {
				player_pos = `${container_home_prefix}${i - (aeroplanes[i].color * 4)}`;
			} else {
				player_pos = aeroplanes[i].inCellId;
			}
			player_flow = player.flow[player_pos];
			player_chess.dataset.pos = player_pos;
			ctx_top.drawImage(document.getElementById(`game-chess-hidden-${aeroplanes[i].color + 1}`), player_flow.x - common_distance, player_flow.y - common_distance, container_chess_common_radius, container_chess_common_radius);
		}
		rollDice();
	});

	stompClient.subscribe(`/game/${gameId}/start`, function(res) {
		appendSystemMessage('游戏开始！', system_color);
		hideLobbyOverlay();
		var ctx_hover = boardHover.getContext('2d');
		Array.from(document.getElementById(`p${index}`).getElementsByClassName('chess')).forEach((element) => {
			element.addEventListener('click', () => {
				stompClient.send(`/app/move/${gameId}/${(Number(element.value) - 1)}`);
				infoDisabled(true);
				chessDisabled(true);
			});
		});
		Array.from(document.getElementsByClassName('chess')).forEach((element) => {
			element.addEventListener('mouseover', () => {
				if (!element.dataset.pos || element.dataset.pos.indexOf(container_home_prefix) === 0)
					return;
				var player = this[element.id.substr(0, 2)],
					pos = player.flow[element.dataset.pos];
				ctx_hover.beginPath();
				ctx_hover.fillStyle = player.color;
				ctx_hover.arc(pos.x, pos.y, container_chess_common_radius, container_chess_common_startAngle, container_chess_common_endAngle);
				ctx_hover.fill();
			});
			element.addEventListener('mouseout', () => {
				ctx_hover.clearRect(0, 0, boardHover.width, boardHover.height);
			});
		});
		countDown(() => {
			if (!document.getElementById('roll').disabled)
				document.getElementById('roll').click();
		});
		rollDice();
	});

	stompClient.subscribe(`/game/${gameId}/your-turn-${sessionId}`, function(res) {
		appendSystemMessage('轮到你了！', system_alert_color);
		infoDisabled(false);
		elementlDisabled('roll', false);
	});

	stompClient.subscribe(`/game/${gameId}/won`, function(res) {
		var body = JSON.parse(res.body),
			winnerIndex = Number(body['player-won']);
		appendSystemMessage(`玩家 ${winnerIndex + 1} 获胜！`, system_alert_color);
		if ((winnerIndex + 1) === index) {
			appendSystemMessage('恭喜你赢了！', system_alert_color);
			showWinnerBanner('你获胜了！', '可点「再来一局」重置大厅，或返回菜单。');
		} else {
			appendSystemMessage('很遗憾，你输了！', system_alert_color);
			showWinnerBanner(`玩家 ${winnerIndex + 1} 获胜`, '可点「再来一局」或返回菜单。');
		}
		// Keep socket briefly so rematch can be requested; fallback leave on confirm.
		clearInterval(diceInterval);
		clearInterval(countDownInterval);
	});

	// Only join lobby here — user must press「准备 / 开始」explicitly.
	sendBotCountConfig(selectedBotCount);
	appendSystemMessage(selectedBotCount > 0
		? `大厅已就绪，当前机器人数量：${selectedBotCount}。点「准备 / 开始」开局。`
		: '大厅已就绪（联机模式）。好友进入后双方都点「准备 / 开始」。', system_color);
}

var roll = () => {
	stompClient.send(`/app/roll/${gameId}`);
	elementlDisabled('roll', true);
	chessDisabled(false);
}

var rollDice = () => {
	dice = document.getElementById('dice');
	diceInterval = setInterval(() => {
		var random = Math.floor(Math.random() * 6);
		dice.innerHTML = dices[random];
	}, 50)
}

var countDown = (fn) => {
	clearInterval(countDownInterval);
	count = 5;
	countDownInterval = setInterval(() => {
			document.getElementById('count').innerHTML = count;
			if (count === 0) {
				if (fn)
					fn();
				clearInterval(countDownInterval);
			}
			count--;
		}, 1000);
}

var elementlDisabled = (id, disabled) => {
	document.getElementById(id).disabled = disabled;
}

var chessDisabled = (disabled) => {
	Array.from(document.getElementById(`p${index}`).getElementsByClassName('chess')).forEach((element) => {
		element.style.opacity = disabled? 0.3 : 1;
		element.disabled = window.getComputedStyle(element)['background-color'] === 'rgb(128, 128, 128)'? true : disabled;
	})
}

var infoDisabled = (disabled) => {
	if (disabled) {
		Array.from(document.getElementsByClassName('info-turn')).forEach((element) => {
			element.style.display = 'none';
		})
	} else {
		document.getElementById(`p${index}-info-turn`).style.display = 'block';
	}
}

var appendSystemMessage = (text, color) => {
	var container = document.getElementById('wrapper-system'),
		element = document.createElement('div');
	element.innerHTML = color? '系统：\t' + text : text;
	element.style.color = color? color : system_default_color;
	container.append(element);
	container.scrollTop = container.scrollHeight;
}

var showWinnerBanner = (title, desc) => {
	if (!winnerBanner)
		return;
	document.getElementById('winner-title').innerText = title || '游戏结束';
	if (winnerDesc)
		winnerDesc.innerText = desc || '';
	winnerBanner.classList.add('is-visible');
}

var hideWinnerBanner = () => {
	if (winnerBanner)
		winnerBanner.classList.remove('is-visible');
}

var turn = {
	r: (x, y, n, s) => {
		return {
			x: x + n + (s || 0),
			y: y
		}
	},
	l: (x, y, n, s) => {
		return {
			x: x - n - (s || 0),
			y: y
		}
	},
	u: (x, y, n, s) => {
		return {
			x: x,
			y: y - n - (s || 0)
		}
	},
	d: (x, y, n, s) => {
		return {
			x: x,
			y: y + n + (s || 0)
		}
	}
}

class Player {
	constructor(name, number_of_steps, turn_of_steps, color, color_of_steps, container_home, container_start) {
		this.name = name;
		this.number_of_steps = number_of_steps;
		this.turn_of_steps = turn_of_steps;
		this.color = color;
		this.color_of_steps = color_of_steps;
		this.container_home = container_home;
		this.container_start = container_start;
		this.chess = [];
		this.flow = {};
	}

	addChess(chess) {
		this.chess.push(chess);
	}

	addFlow(id, x, y) {
		this.flow[id] = {
			x: x,
			y: y
		}
	}
}

class Chess {
	constructor(name, x, y) {
		this.name = name;
		this.x = x;
		this.y = y;
	}
}

class Container_Home {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

class Container_Start {
	constructor(x, y, p) {
		this.x = x;
		this.y = y;
		this.p = p;
	}
}
