package com.dotterbear.aeroplanechess.service.impl;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;

import com.dotterbear.aeroplanechess.builder.AeroplaneChessBuilder;
import com.dotterbear.aeroplanechess.enums.CellPrefix;
import com.dotterbear.aeroplanechess.model.Aeroplane;
import com.dotterbear.aeroplanechess.model.AeroplaneChess;
import com.dotterbear.aeroplanechess.utils.AeroplaneChessUtils;
import com.dotterbear.aeroplanechess.utils.DiceUtils;
import com.dotterbear.aeroplanechess.utils.MoveUtils;
import com.dotterbear.websocket.gameroom.model.AbstractGame;
import com.dotterbear.websocket.gameroom.model.Player;
import com.dotterbear.websocket.gameroom.repository.GameRepository;
import com.dotterbear.websocket.gameroom.repository.PlayerRepository;
import com.dotterbear.websocket.gameroom.service.GameService;

public class BotFeatureTest {

	@Test
	public void ready_soloWithBots_shouldStartAfterSingleHumanReady() throws Exception {
		TestBotAwarePlayerService service = new TestBotAwarePlayerService();
		PlayerRepository playerRepository = new PlayerRepository();
		initializePlayerRepository(playerRepository);
		GameRepository<AbstractGame> gameRepository = newGameRepository(playerRepository);
		RecordingGameService recordingGameService = new RecordingGameService();

		inject(service, "playerRepository", playerRepository);
		inject(service, "gameRepository", gameRepository);
		inject(service, "gameService", recordingGameService);
		inject(service, "numOfPlayer", 4);

		AeroplaneChess waitingGame = createConfiguredGame("game-bot-fill", 4, 4);
		waitingGame.setBotFillCount(3);
		waitingGame.setHostSessionId("human-1");
		Player human = new Player("真人1", "human-1");
		waitingGame.getPlayers()[0] = human;
		waitingGame.getJoinCount().set(1);
		playerRepository.addPlayer(human.getSessionId(), waitingGame.getId());
		gameRepository.addWaitingGame(waitingGame.getId(), waitingGame);

		service.ready(human.getSessionId(), waitingGame.getId());

		assertEquals("ready 玩家数量应为人+3机器人", 4, waitingGame.getReadyPlayersSize());
		assertNotNull("应触发 start", recordingGameService.startedGameId);
		for (int seat = 1; seat < 4; seat++) {
			assertNotNull(waitingGame.getPlayers()[seat]);
			assertTrue(waitingGame.getPlayers()[seat].getSessionId().startsWith("bot:"));
		}
	}

	@Test
	public void ready_withTwoHumans_shouldNotFillBotsUntilAllReady() throws Exception {
		TestBotAwarePlayerService service = new TestBotAwarePlayerService();
		PlayerRepository playerRepository = new PlayerRepository();
		initializePlayerRepository(playerRepository);
		GameRepository<AbstractGame> gameRepository = newGameRepository(playerRepository);
		RecordingGameService recordingGameService = new RecordingGameService();

		inject(service, "playerRepository", playerRepository);
		inject(service, "gameRepository", gameRepository);
		inject(service, "gameService", recordingGameService);
		inject(service, "numOfPlayer", 4);

		AeroplaneChess waitingGame = createConfiguredGame("game-wait-all", 4, 4);
		waitingGame.setBotFillCount(2);
		waitingGame.setHostSessionId("human-1");
		Player human1 = new Player("真人1", "human-1");
		Player human2 = new Player("真人2", "human-2");
		waitingGame.getPlayers()[0] = human1;
		waitingGame.getPlayers()[1] = human2;
		waitingGame.getJoinCount().set(2);
		playerRepository.addPlayer(human1.getSessionId(), waitingGame.getId());
		playerRepository.addPlayer(human2.getSessionId(), waitingGame.getId());
		gameRepository.addWaitingGame(waitingGame.getId(), waitingGame);

		service.ready(human1.getSessionId(), waitingGame.getId());
		assertNull("仅一人准备时不应开局", recordingGameService.startedGameId);
		assertNull("未全员准备前不应补机器人", waitingGame.getPlayers()[2]);
		assertEquals(1, waitingGame.getReadyPlayersSize());

		service.ready(human2.getSessionId(), waitingGame.getId());
		assertNotNull("全员准备后应开局", recordingGameService.startedGameId);
		assertNotNull(waitingGame.getPlayers()[2]);
		assertTrue(waitingGame.getPlayers()[2].getSessionId().startsWith("bot:"));
		assertNotNull(waitingGame.getPlayers()[3]);
		assertTrue(waitingGame.getPlayers()[3].getSessionId().startsWith("bot:"));
	}

	@Test
	public void configureBotCount_nonHost_shouldBeIgnored() throws Exception {
		TestBotAwarePlayerService service = new TestBotAwarePlayerService();
		PlayerRepository playerRepository = new PlayerRepository();
		initializePlayerRepository(playerRepository);
		GameRepository<AbstractGame> gameRepository = newGameRepository(playerRepository);
		RecordingGameService recordingGameService = new RecordingGameService();

		inject(service, "playerRepository", playerRepository);
		inject(service, "gameRepository", gameRepository);
		inject(service, "gameService", recordingGameService);
		inject(service, "numOfPlayer", 4);

		AeroplaneChess waitingGame = createConfiguredGame("game-host-only", 4, 4);
		waitingGame.setBotFillCount(0);
		waitingGame.setHostSessionId("human-1");
		Player human1 = new Player("真人1", "human-1");
		Player human2 = new Player("真人2", "human-2");
		waitingGame.getPlayers()[0] = human1;
		waitingGame.getPlayers()[1] = human2;
		waitingGame.getJoinCount().set(2);
		playerRepository.addPlayer(human1.getSessionId(), waitingGame.getId());
		playerRepository.addPlayer(human2.getSessionId(), waitingGame.getId());
		gameRepository.addWaitingGame(waitingGame.getId(), waitingGame);

		service.configureBotFillCount(human2.getSessionId(), waitingGame.getId(), 3);
		assertEquals("非房主不能改 bot 数量", 0, waitingGame.getBotFillCount());
	}

	@Test
	public void nextTurn_whenCurrentPlayerIsBot_shouldAutoRollAndMove() throws Exception {
		GameServiceImpl gameService = new GameServiceImpl() {
			@Override
			public void send(String path, String gameId, String[] keys, Object[] values) {
			}

			@Override
			public void sendTo(String path, String sessionId, String gameId, String key, Object value) {
			}
		};
		PlayerRepository playerRepository = new PlayerRepository();
		initializePlayerRepository(playerRepository);
		GameRepository<AeroplaneChess> gameRepository = newGameRepository(playerRepository);
		AeroplaneChessUtils utils = createConfiguredUtils(4, 4, 2, 2);

		inject(gameService, "gameRepository", gameRepository);
		inject(gameService, "playerRepository", playerRepository);
		inject(gameService, "aeroplaneChessUtils", utils);
		inject(gameService, "numOfAeroplane", 4);
		inject(gameService, "diceMax", 6);

		AeroplaneChess game = createConfiguredGame("game-bot-turn", 4, 4);
		game.setTurnCount(new AtomicInteger(-1));
		game.setContinued(0);
		game.getPlayers()[0] = new Player("[BOT] 玩家1", "bot:game-bot-turn:0");
		game.getPlayers()[1] = new Player("真人2", "human-2");
		game.getPlayers()[2] = new Player("真人3", "human-3");
		game.getPlayers()[3] = new Player("真人4", "human-4");
		gameRepository.addPlayingGame(game.getId(), game);

		Method nextTurn = GameServiceImpl.class.getDeclaredMethod("nextTurn", AeroplaneChess.class, boolean.class);
		nextTurn.setAccessible(true);
		nextTurn.invoke(gameService, game, false);

		assertEquals("bot 掷骰结果应写回 game", 2, game.getLastRoll());
		assertEquals("bot 应走出基地", CellPrefix.TAKEOFF.getPrefix() + "0", game.getAeroplanes()[0].getInCellId());
		assertEquals("回合应推进到下一位真人", 1, game.getCurrentPlayerIndex());
	}

	private static AeroplaneChessUtils createConfiguredUtils(int numOfPlayer, int numOfAeroplane, int diceMin, int diceMax) throws Exception {
		AeroplaneChessUtils utils = new AeroplaneChessUtils();
		MoveUtils moveUtils = new MoveUtils();
		DiceUtils diceUtils = new DiceUtils(diceMin, diceMax);
		inject(moveUtils, "numOfPlayer", numOfPlayer);
		inject(moveUtils, "numOfAeroplane", numOfAeroplane);
		inject(utils, "diceUtils", diceUtils);
		inject(utils, "moveUtils", moveUtils);
		inject(utils, "numOfAeroplane", numOfAeroplane);
		return utils;
	}

	private static AeroplaneChess createConfiguredGame(String gameId, int numOfPlayer, int numOfAeroplane) throws Exception {
		AeroplaneChessBuilder builder = new AeroplaneChessBuilder();
		inject(builder, "numOfPlayer", numOfPlayer);
		inject(builder, "numOfAeroplane", numOfAeroplane);
		AeroplaneChess game = builder.build();
		game.setId(gameId);
		if (game.getPlayers() == null)
			game.setPlayers(new Player[numOfPlayer]);
		if (game.getAeroplanes() == null)
			game.setAeroplanes(new Aeroplane[numOfPlayer * numOfAeroplane]);
		return game;
	}

	@SuppressWarnings({ "rawtypes", "unchecked" })
	private static <T extends AbstractGame> GameRepository<T> newGameRepository(PlayerRepository playerRepository) throws Exception {
		GameRepository repository = new GameRepository();
		inject(repository, "waitingGameMap", new HashMap<String, T>());
		inject(repository, "playingGameMap", new HashMap<String, T>());
		inject(repository, "playerRepository", playerRepository);
		return repository;
	}

	private static void initializePlayerRepository(PlayerRepository playerRepository) throws Exception {
		inject(playerRepository, "playerGameMap", new HashMap<String, String>());
	}

	private static void inject(Object target, String fieldName, Object value) throws Exception {
		Field field = findField(target.getClass(), fieldName);
		field.setAccessible(true);
		field.set(target, value);
	}

	private static Field findField(Class<?> type, String fieldName) throws Exception {
		Class<?> current = type;
		while (current != null) {
			try {
				return current.getDeclaredField(fieldName);
			} catch (NoSuchFieldException ignored) {
				current = current.getSuperclass();
			}
		}
		throw new NoSuchFieldException(fieldName);
	}

	private static class TestBotAwarePlayerService extends BotAwarePlayerService {
		@Override
		public void send(String path, String gameId, String key, Object value) {
		}

		@Override
		public void send(String path, String gameId, String[] keys, Object[] values) {
		}

		@Override
		public void sendTo(String path, String sessionId, String gameId, String key, Object value) {
		}
	}

	private static class RecordingGameService implements GameService<AbstractGame> {
		private String startedGameId;

		@Override
		public AbstractGame newGame() {
			return null;
		}

		@Override
		public void playerWin(String gameId, int playerIndex) {
		}

		@Override
		public void playerLeaved(AbstractGame game, int playerIndex) {
		}

		@Override
		public void start(String gameId) {
			this.startedGameId = gameId;
		}
	}
}
