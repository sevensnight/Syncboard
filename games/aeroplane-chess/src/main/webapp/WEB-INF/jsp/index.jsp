<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>飞行棋</title>
<link href="/css/style.css" rel="stylesheet"></link>
<link rel="icon" href="favicon.png"/>
</head>
<body>
	<div class="app-shell">
		<div class="wrapper-header">
			<h1 id="title">飞行棋</h1>
			<p id="room-binding-hint" class="room-binding-hint">房间与 SyncBoard 房间名绑定，同房间好友会进入同一局</p>
		</div>
		<div id="game-id"><img src="image/ic_link_white_24dp/web/ic_link_white_24dp_1x.png" alt="分享房间"><span id="game-id-span"></span></div>
		<input id="game-id-hidden">
		<img id="game-chess-hidden-1" src="image/aeroplanes1.png" alt="黄方棋子">
		<img id="game-chess-hidden-2" src="image/aeroplanes2.png" alt="蓝方棋子">
		<img id="game-chess-hidden-3" src="image/aeroplanes3.png" alt="绿方棋子">
		<img id="game-chess-hidden-4" src="image/aeroplanes4.png" alt="红方棋子">
		<div id="board-mask">
			<!-- 开始菜单：不自动开局 -->
			<div id="lobby-menu" class="lobby-panel">
				<h2 class="lobby-title">开始菜单</h2>
				<p id="lobby-room-label" class="lobby-subtitle">选择模式后进入房间</p>
				<label class="lobby-field-label" for="name">昵称</label>
				<input id="name" type="text" placeholder="输入昵称" maxlength="6" />
				<div class="lobby-field-label">机器人数量</div>
				<div id="bot-count-options" class="bot-count-options" role="group" aria-label="机器人数量">
					<button type="button" class="bot-count-btn is-active" data-bot-count="0">0 · 联机</button>
					<button type="button" class="bot-count-btn" data-bot-count="1">1</button>
					<button type="button" class="bot-count-btn" data-bot-count="2">2</button>
					<button type="button" class="bot-count-btn" data-bot-count="3">3</button>
				</div>
				<p id="lobby-tip" class="lobby-tip">选 0：进入大厅等好友，双方都点「准备」后开局。<br/>选 1–3：你点准备后自动加入对应数量机器人。</p>
				<button type="button" id="enter-room-btn" class="lobby-primary-btn">进入房间</button>
			</div>

			<!-- 房间大厅：已入房，等待准备 -->
			<div id="lobby-waiting" class="lobby-panel hidden">
				<h2 class="lobby-title">房间大厅</h2>
				<p id="waiting-room-label" class="lobby-subtitle"></p>
				<p id="waiting-host-badge" class="lobby-host-badge">等待房主</p>
				<ul id="lobby-player-list" class="lobby-player-list"></ul>
				<p id="waiting-status" class="lobby-tip">已进入房间。全员准备后才会开局；机器人由房主设置。</p>
				<div class="lobby-field-label">机器人数量（仅房主可改）</div>
				<div id="waiting-bot-count-options" class="bot-count-options" role="group" aria-label="大厅机器人数量">
					<button type="button" class="bot-count-btn is-active" data-bot-count="0">0 · 联机</button>
					<button type="button" class="bot-count-btn" data-bot-count="1">1</button>
					<button type="button" class="bot-count-btn" data-bot-count="2">2</button>
					<button type="button" class="bot-count-btn" data-bot-count="3">3</button>
				</div>
				<button type="button" id="ready-btn" class="lobby-primary-btn">准备 / 开始</button>
				<button type="button" id="leave-room-btn" class="lobby-secondary-btn">返回菜单</button>
			</div>
		</div>
		<div id="winner-banner" class="winner-banner" aria-live="polite">
				<div class="winner-banner-content">
					<h2 id="winner-title">游戏结束</h2>
					<p id="winner-desc"></p>
					<div class="winner-actions">
						<button id="rematch-button" type="button">再来一局</button>
						<button id="winner-confirm" type="button">返回菜单</button>
					</div>
				</div>
			</div>
			<div id="background"></div>
		<div id="background-mask"></div>
		<div class="wrapper">
			<section class="board-stage">
				<div class="board-layer-stack">
					<canvas id="board"></canvas>
					<canvas id="board-chess"></canvas>
					<canvas id="board-hover"></canvas>
					<div id="count"></div>
				</div>
			</section>
			<section class="side-stage">
				<div class="wrapper-options">
					<div id="p1" class="player-container">
						<div class="info-container">
							<div id="p1-info-name" class="info-name">玩家 1</div>
							<div id="p1-info-turn" class="info-turn">轮到你了！</div>
						</div>
						<div class="chess-container">
							<input type="button" id="p1-c0" class="chess" value="1" disabled data-pos="ba0">
							<input type="button" id="p1-c1" class="chess" value="2" disabled data-pos="ba0">
							<input type="button" id="p1-c2" class="chess" value="3" disabled data-pos="ba0">
							<input type="button" id="p1-c3" class="chess" value="4" disabled data-pos="ba0">
						</div>
					</div>
					<div id="p2" class="player-container">
						<div class="info-container">
							<div id="p2-info-name" class="info-name">玩家 2</div>
							<div id="p2-info-turn" class="info-turn">轮到你了！</div>
						</div>
						<div class="chess-container">
							<input type="button" id="p2-c0" class="chess" value="1" disabled data-pos="ba1">
							<input type="button" id="p2-c1" class="chess" value="2" disabled data-pos="ba1">
							<input type="button" id="p2-c2" class="chess" value="3" disabled data-pos="ba1">
							<input type="button" id="p2-c3" class="chess" value="4" disabled data-pos="ba1">
						</div>
					</div>
					<div id="p3" class="player-container">
						<div class="info-container">
							<div id="p3-info-name" class="info-name">玩家 3</div>
							<div id="p3-info-turn" class="info-turn">轮到你了！</div>
						</div>
						<div class="chess-container">
							<input type="button" id="p3-c0" class="chess" value="1" disabled data-pos="ba2">
							<input type="button" id="p3-c1" class="chess" value="2" disabled data-pos="ba2">
							<input type="button" id="p3-c2" class="chess" value="3" disabled data-pos="ba2">
							<input type="button" id="p3-c3" class="chess" value="4" disabled data-pos="ba2">
						</div>
					</div>
					<div id="p4" class="player-container">
						<div class="info-container">
							<div id="p4-info-name" class="info-name">玩家 4</div>
							<div id="p4-info-turn" class="info-turn">轮到你了！</div>
						</div>
						<div class="chess-container">
							<input type="button" id="p4-c0" class="chess" value="1" disabled data-pos="ba3">
							<input type="button" id="p4-c1" class="chess" value="2" disabled data-pos="ba3">
							<input type="button" id="p4-c2" class="chess" value="3" disabled data-pos="ba3">
							<input type="button" id="p4-c3" class="chess" value="4" disabled data-pos="ba3">
						</div>
					</div>
					<div id="dice"></div>
					<div>
						<input id="roll" type="button" onclick="roll()" value="掷骰子" disabled>
					</div>
				</div>
				<div class="wrapper-message">
					<div id="wrapper-system" class="wrapper-system"></div>
					<div id="wrapper-chat" class="wrapper-chat"></div>
				</div>
				<div class="wrapper-rule">
					<div>
						规则说明
					</div>
					<ol class="rule">
						<li>掷出 2、4、6 时，可以将一架飞机从基地移动到起飞点。</li>
						<li>跳跃落点时可将对手飞机撞回基地。</li>
						<li>若落点已有两架及以上对手飞机，当前飞机会被撞回基地。</li>
						<li>掷出 6 点可继续行动；若连续第三次掷出 6 点，该玩家全部飞机回基地。</li>
						<li>恰好落在捷径点可走捷径，但捷径过程中不会撞回对手飞机。</li>
						<li>祝你玩得开心！</li>
					</ol>
				</div>
			</section>
		</div>
	</div>
</body>
<script>
	var gameId = "${gameId}";
	var initialUsername = "${username}";
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
<script src="script/script.js"></script>
</html>
