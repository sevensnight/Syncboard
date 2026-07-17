package com.dotterbear.aeroplanechess.utils;

import java.util.Random;

public class DiceUtils {

	private Random random;
	private int min;
	private int max;

	public DiceUtils() {
	}

	public DiceUtils(int min, int max) {
		this.min = min;
		this.max = max;
		random = new Random();
	}

	public int roll() {
		return random.nextInt(max + 1 - min) + min;
	}

}
