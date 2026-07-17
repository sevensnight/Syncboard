package com.dotterbear.aeroplanechess.controller;

import org.apache.catalina.servlet4preview.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class GameController {

	@RequestMapping(value = "/")
	public String index(HttpServletRequest request, Model model,
			@RequestParam(defaultValue = "null") String gameId,
			@RequestParam(defaultValue = "玩家") String username,
			@RequestParam(defaultValue = "lobby") String room) {
		String normalizedGameId = gameId;
		if (normalizedGameId == null || normalizedGameId.trim().isEmpty() || "null".equalsIgnoreCase(normalizedGameId))
			normalizedGameId = room;

		String normalizedUsername = username;
		if (normalizedUsername == null || normalizedUsername.trim().isEmpty() || "null".equalsIgnoreCase(normalizedUsername))
			normalizedUsername = "玩家";

		model.addAttribute("gameId", normalizedGameId);
		model.addAttribute("username", normalizedUsername);
		return "index";
	}

}
