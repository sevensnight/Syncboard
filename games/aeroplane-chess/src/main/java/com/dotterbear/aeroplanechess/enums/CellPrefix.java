package com.dotterbear.aeroplanechess.enums;

public enum CellPrefix {

	BASE("ba"), TAKEOFF("to"), SKY("sk"), LANDING("ld"), GOAL("go");

	private String prefix;

	private CellPrefix(String prefix) {
		this.prefix = prefix;
	}

	public String getPrefix() {
		return prefix;
	}

}
