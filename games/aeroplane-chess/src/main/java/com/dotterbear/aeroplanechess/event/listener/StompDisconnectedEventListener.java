package com.dotterbear.aeroplanechess.event.listener;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.dotterbear.websocket.gameroom.service.PlayerService;

@Component
public class StompDisconnectedEventListener implements ApplicationListener<SessionDisconnectEvent> {

	@Autowired
	@Lazy
	private PlayerService playerService;

	@Override
	public void onApplicationEvent(SessionDisconnectEvent sessionDisconnectEvent) {
		StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(sessionDisconnectEvent.getMessage());
		playerService.removePlayer(headerAccessor.getSessionId());
	}
}
