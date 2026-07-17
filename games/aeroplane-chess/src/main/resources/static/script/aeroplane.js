var stompClient = null;
var sessionId;
var colorClasses = ["yellow", "blue", "green", "red"];
var colorLabels = ["黄方", "蓝方", "绿方", "红方"];

function setConnected(connected) {
	$("#connect").prop("disabled", connected);
	$("#disconnect").prop("disabled", !connected);
	if (connected) {
		$("#conversation").show();
	} else {
		$("#conversation").hide();
	}
	$(".player-list").html("");
}

function connect() {
	var socket = new SockJS('/aeroplanechess-websocket');
	stompClient = Stomp.over(socket);
	stompClient.connect({}, function(frame) {
		setConnected(true);
		console.log('Connected: ' + frame);
		sessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
		console.log("connected, session id: " + sessionId);

		stompClient.subscribe("/game/player-list", function(res) {
			$(".player-list").html("");
			var players = JSON.parse(res.body).players;
			for(var i in players) {
				var player = players[i];
				if(player == null) continue;
				var name = player.name;
				if(sessionId == player.sessionId)
					name += " (你)";
				$(".player-list").append(`<div>${name} <span class="${colorClasses[i]}">${colorLabels[i]}<span></div>`)
			}
		});

		stompClient.subscribe("/game/roll-result", function(res) {
			var body = JSON.parse(res.body);
			logAppend(`玩家 ${colorLabels[body.current]} 掷出了 ${body.roll}`);
		});
		
		stompClient.subscribe("/game/move-" + sessionId, function(res) {
			console.log(res.body);
			logAppend("请选择一架飞机进行移动");
			$(".aeroplane-btn").prop("disabled", false).off("click").one("click", function() {
				disableBtn();
				stompClient.send("/app/move/" + (Number($(this).html()) - 1));
			});
		});
		
		stompClient.subscribe("/game/move-result", function(res) {
			$(".aeroplane-list").html("");
			var aeroplanes = JSON.parse(res.body);
			var colorCount = -1;
			for(var i = 0 in aeroplanes) {
				$(".aeroplane-list").append(`<div class="plane">${i % 4 + 1}号：${colorLabels[aeroplanes[i].color]}，当前位置 ${aeroplanes[i].inCellId}</div>`);
			}
			logAppend("系统：已完成移动");
		});
		
		stompClient.subscribe("/game/start", function(res) {
			console.log(res.body);
			logAppend("等待开始...");
		});
		
		stompClient.subscribe("/game/your-turn-" + sessionId, function(res) {
			console.log(res.body);
			logAppend("轮到你掷骰子了");
			$(".roll-btn").prop("disabled", false);
			$(".roll-btn").one("click", function() {
				$(".roll-btn").prop("disabled", true);
				roll();
			});
		});

		stompClient.subscribe("/game/won", function(res) {
			var body = JSON.parse(res.body);
			logAppend(`游戏结束，${colorLabels[body.playerWon]} 获胜`);
		});

		stompClient.send("/app/join");
	});
}

function disconnect() {
	if (stompClient !== null) {
		stompClient.disconnect();
	}
	setConnected(false);
	console.log("Disconnected");
}

function roll() {
	logAppend("正在掷骰...");
	stompClient.send("/app/roll");
}

function logAppend(str) {
	$('.log').prepend(`<p>${new Date().toISOString()} ${str}</p>`);
}

function disableBtn() {
	$(".roll-btn").prop("disabled", true);
	$(".aeroplane-btn").prop("disabled", true);
}

$(function() {
	$("form").on('submit', function(e) {
		e.preventDefault();
	});
	$("#connect").click(function() {
		connect();
	});
	$("#disconnect").click(function() {
		disconnect();
	});
	$("#send").click(function() {
		sendName();
	});
});

$(document).ready(function () {
	connect();
	disableBtn();
});