package com.dotterbear.aeroplanechess.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.dotterbear.aeroplanechess.service.impl.BotAwarePlayerService;
import com.dotterbear.aeroplanechess.service.impl.GameServiceImpl;

@Controller
public class GameWebSocketController {

	@Autowired
	private GameServiceImpl gameService;

	@Autowired
	private BotAwarePlayerService botAwarePlayerService;

	@MessageMapping("/roll/{gameId}")
	public void roll(@Header("simpSessionId") String sessionId, @DestinationVariable("gameId") String gameId) {
		gameService.roll(sessionId, gameId);
	}

	@MessageMapping("/move/{gameId}/{aeroplaneIndex}")
	public void move(@Header("simpSessionId") String sessionId, @DestinationVariable("gameId") String gameId, @DestinationVariable("aeroplaneIndex") int aeroplaneIndex) {
		gameService.move(sessionId, gameId, aeroplaneIndex);
	}

	@MessageMapping("/config/{gameId}/bot-fill/{enabled}")
	public void configureBotFill(@Header("simpSessionId") String sessionId, @DestinationVariable("gameId") String gameId, @DestinationVariable("enabled") boolean enabled) {
		botAwarePlayerService.configureAutoFillBots(sessionId, gameId, enabled);
	}

	@MessageMapping("/config/{gameId}/bot-count/{count}")
	public void configureBotCount(@Header("simpSessionId") String sessionId, @DestinationVariable("gameId") String gameId, @DestinationVariable("count") int count) {
		botAwarePlayerService.configureBotFillCount(sessionId, gameId, count);
	}

	@MessageMapping("/rematch/{gameId}")
	public void rematch(@Header("simpSessionId") String sessionId, @DestinationVariable("gameId") String gameId) {
		botAwarePlayerService.requestRematch(sessionId, gameId);
	}
}
