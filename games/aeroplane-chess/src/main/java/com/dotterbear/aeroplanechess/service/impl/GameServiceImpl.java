package com.dotterbear.aeroplanechess.service.impl;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.dotterbear.aeroplanechess.builder.AeroplaneChessBuilder;
import com.dotterbear.aeroplanechess.enums.CellPrefix;
import com.dotterbear.aeroplanechess.model.Aeroplane;
import com.dotterbear.aeroplanechess.model.AeroplaneChess;
import com.dotterbear.aeroplanechess.utils.AeroplaneChessUtils;
import com.dotterbear.websocket.gameroom.model.Player;
import com.dotterbear.websocket.gameroom.repository.GameRepository;
import com.dotterbear.websocket.gameroom.repository.PlayerRepository;
import com.dotterbear.websocket.gameroom.service.AbstractWebSocketService;
import com.dotterbear.websocket.gameroom.service.GameService;

@Service
public class GameServiceImpl extends AbstractWebSocketService implements GameService<AeroplaneChess> {

	private static final int BOT_AUTO_TURN_DEPTH_LIMIT = 48;
	private static final ThreadLocal<Integer> BOT_AUTO_TURN_DEPTH = ThreadLocal.withInitial(() -> 0);

	private Logger logger = LoggerFactory.getLogger(GameServiceImpl.class);

	@Autowired
	private GameRepository<AeroplaneChess> gameRepository;

	@Autowired
	private PlayerRepository playerRepository;

	@Autowired
	private AeroplaneChessUtils aeroplaneChessUtils;

	@Autowired
	private AeroplaneChessBuilder aeroplaneChessBuilder;

	@Value(value = "${websocket.aeroplanechess.config.numof.aeroplane}")
	private int numOfAeroplane;

	@Value(value = "${websocket.aeroplanechess.config.dice.max}")
	private int diceMax;

	@Value(value = "${websocket.aeroplanechess.config.bot.action-delay-ms:1200}")
	private int botActionDelayMs;

	public void start(String gameId) {
		send("start", gameId, "start", true);
		nextTurn(gameRepository.addPlayingGame(gameId, gameRepository.removeWaitingGame(gameId)), false);
	}

	public void roll(String sessionId, String gameId) {
		logger.info("roll, sessionId: ", sessionId, ", gameId: ", gameId);
		AeroplaneChess game = gameRepository.getPlayingGame(gameId);
		if (game == null)
			return;
		synchronized (game) {
			int rollResult = aeroplaneChessUtils.roll();
			// send roll result to all players
			game.setLastRoll(rollResult);
			send("roll-result", game.getId(), new String[] { "roll", "current" }, new Object[] { rollResult, game.getCurrentPlayerIndex() });

			// send move notification to current player
			if (rollResult == 6 && game.getContinued() == 2) {
				thridSix(game);
			} else {
				sendTo("move", sessionId, gameId, "move", true);
			}
		}
	}

	public void move(String sessionId, String gameId, int aeroplaneIndex) {
		logger.info("move, sessionId: ", sessionId, ", gameId: ", gameId, ", aeroplaneIndex: ", aeroplaneIndex);
		AeroplaneChess game = gameRepository.getPlayingGame(gameId);
		if (game == null)
			return;
		synchronized (game) {
			int rollResult = game.getLastRoll();
			int currentPlayer = game.getCurrentPlayerIndex();
			Aeroplane[] aeroplanes = game.getAeroplanes();
			// move
			List<Integer> encountered = aeroplaneChessUtils.move(aeroplanes, currentPlayer * numOfAeroplane + aeroplaneIndex, rollResult);
			sendMoveResult(game.getId(), aeroplanes, "encountered", encountered);
			// check win
			if (aeroplaneChessUtils.isWin(aeroplanes, currentPlayer))
				playerWin(gameId, currentPlayer);
			else
				nextTurn(game, rollResult == diceMax);
		}
	}

	private void thridSix(AeroplaneChess game) {
		logger.info("thridSix, game: ", game);
		aeroplaneChessUtils.allBackToBase(game.getAeroplanes(), game.getCurrentPlayerIndex());
		sendMoveResult(game.getId(), game.getAeroplanes(), "thrid-six", true);
		nextTurn(game, false);
	}

	private void nextTurn(AeroplaneChess game, boolean isContinue) {
		logger.info("nextTurn, game:", game, ", isContinue: ", isContinue);
		if (isContinue)
			game.setContinued(game.getContinued() + 1);
		else {
			Player[] players = game.getPlayers();
			do
				game.getTurnCount().incrementAndGet();
			while (players[game.getCurrentPlayerIndex()] == null);
			game.setContinued(0);
		}
		Player currentPlayer = game.getPlayers()[game.getCurrentPlayerIndex()];
		if (isBotPlayer(currentPlayer)) {
			playBotTurn(game);
			return;
		}
		sendTo("your-turn", currentPlayer.getSessionId(), game.getId(), "your-turn", true);
	}

	private boolean isBotPlayer(Player player) {
		return player != null && BotAwarePlayerService.isBotSessionId(player.getSessionId());
	}

	private void playBotTurn(AeroplaneChess game) {
		int depth = BOT_AUTO_TURN_DEPTH.get();
		if (depth >= BOT_AUTO_TURN_DEPTH_LIMIT) {
			logger.warn("bot auto turn depth reached limit, gameId: {}", game.getId());
			BOT_AUTO_TURN_DEPTH.remove();
			return;
		}
		BOT_AUTO_TURN_DEPTH.set(depth + 1);
		try {
			Player botPlayer = game.getPlayers()[game.getCurrentPlayerIndex()];
			if (!isBotPlayer(botPlayer))
				return;

			int waitMillis = Math.max(0, botActionDelayMs);
			if (waitMillis > 0) {
				send("bot-thinking", game.getId(), new String[] { "player", "wait-ms" }, new Object[] { game.getCurrentPlayerIndex(), waitMillis });
				try {
					Thread.sleep(waitMillis);
				} catch (InterruptedException e) {
					Thread.currentThread().interrupt();
					return;
				}
			}

			int rollResult = aeroplaneChessUtils.roll();
			game.setLastRoll(rollResult);
			send("roll-result", game.getId(), new String[] { "roll", "current" }, new Object[] { rollResult, game.getCurrentPlayerIndex() });

			if (rollResult == diceMax && game.getContinued() == 2) {
				thridSix(game);
				return;
			}

			int aeroplaneIndex = pickBotAeroplaneIndex(game, rollResult);
			move(botPlayer.getSessionId(), game.getId(), aeroplaneIndex);
		} finally {
			int nextDepth = BOT_AUTO_TURN_DEPTH.get() - 1;
			if (nextDepth <= 0)
				BOT_AUTO_TURN_DEPTH.remove();
			else
				BOT_AUTO_TURN_DEPTH.set(nextDepth);
		}
	}

	private int pickBotAeroplaneIndex(AeroplaneChess game, int rollResult) {
		int start = game.getCurrentPlayerIndex() * numOfAeroplane;
		Aeroplane[] aeroplanes = game.getAeroplanes();
		for (int offset = 0; offset < numOfAeroplane; offset++) {
			String inCellId = aeroplanes[start + offset].getInCellId();
			String prefix = inCellId.substring(0, 2);
			if (CellPrefix.GOAL.getPrefix().equals(prefix))
				continue;
			if (CellPrefix.BASE.getPrefix().equals(prefix) && rollResult % 2 != 0)
				continue;
			return offset;
		}
		for (int offset = 0; offset < numOfAeroplane; offset++) {
			String inCellId = aeroplanes[start + offset].getInCellId();
			if (!CellPrefix.GOAL.getPrefix().equals(inCellId.substring(0, 2)))
				return offset;
		}
		return 0;
	}


	public void playerWin(String gameId, int playerIndex) {
		logger.info("playerWin, gameId: ", gameId, ", playerIndex: ", playerIndex);
		AeroplaneChess finished = gameRepository.removePlayingGame(gameId);
		// Drop bot session mappings so the same SyncBoard room can start a fresh match.
		cleanupBotSessions(finished);
		send("won", gameId, "player-won", playerIndex);
	}

	private void cleanupBotSessions(AeroplaneChess game) {
		if (game == null || game.getPlayers() == null)
			return;
		for (Player player : game.getPlayers()) {
			if (player == null || !BotAwarePlayerService.isBotSessionId(player.getSessionId()))
				continue;
			try {
				playerRepository.removePlayer(player.getSessionId());
			} catch (Exception error) {
				logger.warn("cleanup bot session failed: {}", player.getSessionId());
			}
		}
	}

	public void playerLeaved(AeroplaneChess game, int playerIndex) {
		logger.info("playerLeaved, game: ", game, ", playerIndex: ", playerIndex);
		aeroplaneChessUtils.allBackToBase(game.getAeroplanes(), playerIndex);
		sendMoveResult(game.getId(), game.getAeroplanes(), "leaved", playerIndex);
		if (playerIndex == game.getCurrentPlayerIndex())
			nextTurn(game, false);
	}

	public AeroplaneChess newGame() {
		return aeroplaneChessBuilder.build();
	}

	private void sendMoveResult(String gameId, Aeroplane[] aeroplanes, String key, Object value) {
		send("move-result", gameId, new String[] { "aeroplanes", key }, new Object[] { aeroplanes, value });
	}
}
