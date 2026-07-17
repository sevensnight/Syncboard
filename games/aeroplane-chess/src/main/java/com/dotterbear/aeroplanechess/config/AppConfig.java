package com.dotterbear.aeroplanechess.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.dotterbear.aeroplanechess.builder.AeroplaneChessBuilder;
import com.dotterbear.aeroplanechess.service.impl.GameServiceImpl;
import com.dotterbear.aeroplanechess.utils.AeroplaneChessUtils;
import com.dotterbear.aeroplanechess.utils.DiceUtils;
import com.dotterbear.aeroplanechess.utils.MoveUtils;
import com.dotterbear.websocket.gameroom.service.GameService;

@Configuration
public class AppConfig {

	@Bean
	public DiceUtils getDiceUtils(@Value(value = "${websocket.aeroplanechess.config.dice.min}") int diceMin, @Value(value = "${websocket.aeroplanechess.config.dice.max}") int diceMax) {
		return new DiceUtils(diceMin, diceMax);
	}

	@Bean
	public MoveUtils getMoveUtils() {
		return new MoveUtils();
	}

	@Bean
	public AeroplaneChessUtils getAeroplaneChessUtils() {
		return new AeroplaneChessUtils();
	}

	@Bean
	public GameService getGameService() {
		return new GameServiceImpl();
	}

	@Bean
	public AeroplaneChessBuilder getGameBuilder() {
		return new AeroplaneChessBuilder();
	}

}
