package com.dotterbear.aeroplanechess.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import com.dotterbear.aeroplanechess.model.AeroplaneChess;
import com.dotterbear.websocket.gameroom.model.AbstractGame;
import com.dotterbear.websocket.gameroom.model.Player;
import com.dotterbear.websocket.gameroom.repository.GameRepository;
import com.dotterbear.websocket.gameroom.repository.PlayerRepository;
import com.dotterbear.websocket.gameroom.service.GameService;
import com.dotterbear.websocket.gameroom.service.PlayerService;

@Service
@Primary
public class BotAwarePlayerService extends PlayerService {

	private static final String BOT_SESSION_PREFIX = "bot:";
	private static final String BOT_NAME_PREFIX = "[BOT] ";

	private Logger logger = LoggerFactory.getLogger(BotAwarePlayerService.class);

	@Autowired
	private PlayerRepository playerRepository;

	@Autowired
	private GameRepository<AbstractGame> gameRepository;

	@Autowired
	private GameService<AbstractGame> gameService;

	@Value(value = "${websocket.gameroom.config.numof.player}")
	private int numOfPlayer;

	@Override
	public String addPlayer(String sessionId, String gameId, String name) {
		String normalizedGameId = gameId == null ? null : gameId.trim();
		if (normalizedGameId == null || normalizedGameId.isEmpty() || "null".equalsIgnoreCase(normalizedGameId))
			return super.addPlayer(sessionId, name);

		synchronized (this) {
			AbstractGame waitingGame = gameRepository.getWaitingGame(normalizedGameId);
			AbstractGame playingGame = gameRepository.getPlayingGame(normalizedGameId);
			if (waitingGame == null && playingGame == null) {
				AbstractGame newGame = gameService.newGame();
				newGame.setId(normalizedGameId);
				gameRepository.addWaitingGame(normalizedGameId, newGame);
			}
		}

		String result = super.addPlayer(sessionId, normalizedGameId, name);

		AbstractGame game = gameRepository.getWaitingGame(normalizedGameId);
		if (game instanceof AeroplaneChess) {
			synchronized (game) {
				AeroplaneChess waitingGame = (AeroplaneChess) game;
				ensureHost(waitingGame, sessionId);
				broadcastLobbyMeta(waitingGame);
				send("player-list", normalizedGameId, "players", waitingGame.getPlayers());
			}
		}

		return result;
	}

	@Override
	public void removePlayer(String sessionId) {
		String gameId = null;
		if (playerRepository.getPlayerGameMap() != null)
			gameId = playerRepository.getPlayerGameMap().get(sessionId);

		super.removePlayer(sessionId);

		if (gameId == null)
			return;

		AbstractGame waiting = gameRepository.getWaitingGame(gameId);
		if (!(waiting instanceof AeroplaneChess))
			return;

		synchronized (waiting) {
			AeroplaneChess game = (AeroplaneChess) waiting;
			if (sessionId.equals(game.getHostSessionId())) {
				game.setHostSessionId("");
				ensureHost(game, null);
			}
			broadcastLobbyMeta(game);
			send("player-list", gameId, "players", game.getPlayers());
		}
	}

	@Override
	public void ready(String sessionId, String gameId) {
		logger.info("ready with optional bot-fill, sessionId: {}, gameId: {}", sessionId, gameId);
		AbstractGame game = gameRepository.getWaitingGame(gameId);
		if (game == null)
			return;

		synchronized (game) {
			Player[] players = game.getPlayers();
			if (!containsSession(players, sessionId))
				return;

			game.addReadyPlayer(sessionId);
			broadcastReadyStatus(gameId, game, players);
			tryStartWaitingGame(gameId, game, players);
		}
	}

	/**
	 * Host requests a fresh lobby after a finished match (same gameId).
	 */
	public void requestRematch(String sessionId, String gameId) {
		logger.info("requestRematch, sessionId: {}, gameId: {}", sessionId, gameId);
		AbstractGame playing = gameRepository.getPlayingGame(gameId);
		if (playing != null) {
			gameRepository.removePlayingGame(gameId);
		}

		AbstractGame waiting = gameRepository.getWaitingGame(gameId);
		if (waiting == null) {
			waiting = gameService.newGame();
			waiting.setId(gameId);
			gameRepository.addWaitingGame(gameId, waiting);
		}

		if (waiting instanceof AeroplaneChess) {
			AeroplaneChess game = (AeroplaneChess) waiting;
			synchronized (game) {
				// Reset seats for a clean rematch lobby.
				Player[] players = game.getPlayers();
				if (players != null) {
					for (int i = 0; i < players.length; i++) {
						players[i] = null;
					}
				}
				if (game.getReadyPlayers() != null) {
					game.getReadyPlayers().clear();
				}
				game.setHostSessionId(sessionId);
				game.setBotFillCount(0);
				broadcastLobbyMeta(game);
			}
		}

		send("rematch", gameId, new String[] { "hostSessionId", "gameId" }, new Object[] { sessionId, gameId });
	}

	/**
	 * Backward-compatible boolean toggle (true ≈ fill up to 3 bots).
	 */
	public void configureAutoFillBots(String sessionId, String gameId, boolean autoFillBots) {
		configureBotFillCount(sessionId, gameId, autoFillBots ? 3 : 0);
	}

	/**
	 * Host-only: set how many bots to inject after ALL humans are ready (0-3).
	 */
	public void configureBotFillCount(String sessionId, String gameId, int botFillCount) {
		int normalizedCount = Math.max(0, Math.min(3, botFillCount));
		logger.info("configureBotFillCount, sessionId: {}, gameId: {}, count: {}", sessionId, gameId, normalizedCount);
		AbstractGame game = gameRepository.getWaitingGame(gameId);
		if (game == null)
			return;

		synchronized (game) {
			Player[] players = game.getPlayers();
			if (!containsSession(players, sessionId))
				return;

			if (!(game instanceof AeroplaneChess))
				return;

			AeroplaneChess waitingGame = (AeroplaneChess) game;
			ensureHost(waitingGame, null);

			if (!sessionId.equals(waitingGame.getHostSessionId())) {
				sendTo("lobby-error", sessionId, gameId, "message", "只有房主可以设置机器人数量");
				broadcastLobbyMeta(waitingGame);
				return;
			}

			waitingGame.setBotFillCount(normalizedCount);
			broadcastLobbyMeta(waitingGame);

			// If everyone is already ready, re-evaluate start (bots fill only then).
			if (areAllHumansReady(waitingGame, players))
				tryStartWaitingGame(gameId, waitingGame, players);
			else
				send("player-list", gameId, "players", players);
		}
	}

	private void tryStartWaitingGame(String gameId, AbstractGame game, Player[] players) {
		int botFillCount = 0;
		if (game instanceof AeroplaneChess)
			botFillCount = ((AeroplaneChess) game).getBotFillCount();

		// Key rule: never inject bots until every seated human is ready.
		// Prevents one player from starting with bots while others are still joining.
		if (!areAllHumansReady(game, players)) {
			send("player-list", gameId, "players", players);
			if (game instanceof AeroplaneChess)
				broadcastLobbyMeta((AeroplaneChess) game);
			return;
		}

		if (botFillCount > 0)
			autoFillBotPlayers(gameId, game, players, botFillCount);

		send("player-list", gameId, "players", players);

		if (shouldStartGame(game, players, botFillCount))
			gameService.start(gameId);
	}

	private boolean areAllHumansReady(AbstractGame game, Player[] players) {
		int onlinePlayers = 0;
		int onlineReady = 0;
		for (Player player : players) {
			if (player == null || isBotSessionId(player.getSessionId()))
				continue;
			onlinePlayers++;
			if (game.getReadyPlayers() != null && game.getReadyPlayers().contains(player.getSessionId()))
				onlineReady++;
		}
		return onlinePlayers > 0 && onlinePlayers == onlineReady;
	}

	private boolean shouldStartGame(AbstractGame game, Player[] players, int botFillCount) {
		int onlinePlayers = 0;
		int seatedPlayers = 0;

		for (Player player : players) {
			if (player == null)
				continue;
			seatedPlayers++;
			if (!isBotSessionId(player.getSessionId()))
				onlinePlayers++;
		}

		if (!areAllHumansReady(game, players))
			return false;

		if (botFillCount > 0)
			// After bots are filled: need at least 2 seats (e.g. 1 human + 1 bot).
			return seatedPlayers >= 2;

		// Pure multiplayer: need 2+ humans (all already ready).
		return onlinePlayers >= 2;
	}

	private void autoFillBotPlayers(String gameId, AbstractGame game, Player[] players, int botFillCount) {
		int filled = countBots(players);
		for (int seatIndex = 0; seatIndex < players.length; seatIndex++) {
			if (filled >= botFillCount)
				break;
			if (players[seatIndex] != null)
				continue;

			String botSessionId = buildBotSessionId(gameId, seatIndex);
			Player bot = new Player(buildBotName(seatIndex), botSessionId);
			players[seatIndex] = bot;
			if (playerRepository.getPlayerGameMap() == null || !playerRepository.getPlayerGameMap().containsKey(botSessionId)) {
				playerRepository.addPlayer(botSessionId, gameId);
				game.getJoinCount().incrementAndGet();
			}
			game.addReadyPlayer(botSessionId);
			filled++;
		}
	}

	private int countBots(Player[] players) {
		int count = 0;
		for (Player player : players) {
			if (player != null && isBotSessionId(player.getSessionId()))
				count++;
		}
		return count;
	}

	private void ensureHost(AeroplaneChess game, String preferredSessionId) {
		if (game.getHostSessionId() != null && !game.getHostSessionId().isEmpty()
				&& containsSession(game.getPlayers(), game.getHostSessionId())
				&& !isBotSessionId(game.getHostSessionId()))
			return;

		if (preferredSessionId != null && containsSession(game.getPlayers(), preferredSessionId)
				&& !isBotSessionId(preferredSessionId)) {
			game.setHostSessionId(preferredSessionId);
			return;
		}

		Player[] players = game.getPlayers();
		if (players == null)
			return;
		for (Player player : players) {
			if (player != null && !isBotSessionId(player.getSessionId())) {
				game.setHostSessionId(player.getSessionId());
				return;
			}
		}
		game.setHostSessionId("");
	}

	private void broadcastLobbyMeta(AeroplaneChess game) {
		send("lobby-meta", game.getId(),
				new String[] { "hostSessionId", "botCount", "enabled" },
				new Object[] { game.getHostSessionId(), game.getBotFillCount(), game.getBotFillCount() > 0 });
		broadcastReadyStatus(game.getId(), game, game.getPlayers());
	}

	private void broadcastReadyStatus(String gameId, AbstractGame game, Player[] players) {
		java.util.List<String> readySessionIds = new java.util.ArrayList<String>();
		java.util.List<String> readyNames = new java.util.ArrayList<String>();
		if (game.getReadyPlayers() != null) {
			for (Object readyId : game.getReadyPlayers()) {
				String session = String.valueOf(readyId);
				if (isBotSessionId(session))
					continue;
				readySessionIds.add(session);
				if (players != null) {
					for (Player player : players) {
						if (player != null && session.equals(player.getSessionId())) {
							readyNames.add(player.getName());
							break;
						}
					}
				}
			}
		}
		send("ready-status", gameId,
				new String[] { "readySessionIds", "readyNames" },
				new Object[] { readySessionIds.toArray(new String[0]), readyNames.toArray(new String[0]) });
	}

	private boolean containsSession(Player[] players, String sessionId) {
		if (players == null || sessionId == null)
			return false;
		for (Player player : players) {
			if (player != null && sessionId.equals(player.getSessionId()))
				return true;
		}
		return false;
	}

	private String buildBotSessionId(String gameId, int seatIndex) {
		return BOT_SESSION_PREFIX + gameId + ":" + seatIndex;
	}

	private String buildBotName(int seatIndex) {
		return BOT_NAME_PREFIX + "玩家" + (seatIndex + 1);
	}

	public static boolean isBotSessionId(String sessionId) {
		return sessionId != null && sessionId.startsWith(BOT_SESSION_PREFIX);
	}
}
