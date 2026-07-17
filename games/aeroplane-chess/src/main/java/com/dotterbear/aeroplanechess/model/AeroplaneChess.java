package com.dotterbear.aeroplanechess.model;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

import com.dotterbear.websocket.gameroom.model.AbstractGame;

public class AeroplaneChess extends AbstractGame {

	private int lastRoll = -1;
	private int continued = 0;
	/** 0 = multiplayer only; 1-3 = fill that many bot seats after all humans are ready. */
	private int botFillCount = 0;
	/** Session id of the lobby host (first human joiner; reassigned on leave). */
	private String hostSessionId = "";
	private Aeroplane[] aeroplanes;
	private AtomicInteger turnCount = new AtomicInteger(-1);

	public int getLastRoll() {
		return lastRoll;
	}

	public void setLastRoll(int lastRoll) {
		this.lastRoll = lastRoll;
	}

	public Aeroplane[] getAeroplanes() {
		return aeroplanes;
	}

	public void setAeroplanes(Aeroplane[] aeroplanes) {
		this.aeroplanes = aeroplanes;
	}

	public int getContinued() {
		return continued;
	}

	public void setContinued(int continued) {
		this.continued = continued;
	}

	public boolean isAutoFillBots() {
		return botFillCount > 0;
	}

	public void setAutoFillBots(boolean autoFillBots) {
		// Backward compatible: true means "fill as many bots as possible" (up to 3).
		if (autoFillBots) {
			if (botFillCount <= 0)
				botFillCount = 3;
		} else {
			botFillCount = 0;
		}
	}

	public int getBotFillCount() {
		return botFillCount;
	}

	public void setBotFillCount(int botFillCount) {
		if (botFillCount < 0)
			this.botFillCount = 0;
		else if (botFillCount > 3)
			this.botFillCount = 3;
		else
			this.botFillCount = botFillCount;
	}

	public String getHostSessionId() {
		return hostSessionId == null ? "" : hostSessionId;
	}

	public void setHostSessionId(String hostSessionId) {
		this.hostSessionId = hostSessionId == null ? "" : hostSessionId;
	}

	public AtomicInteger getTurnCount() {
		return turnCount;
	}

	public void setTurnCount(AtomicInteger turnCount) {
		this.turnCount = turnCount;
	}

	public int getCurrentPlayerIndex() {
		return turnCount.get() % players.length;
	}

	@Override
	public String toString() {
		return "AeroplaneChess [lastRoll=" + lastRoll + ", continued=" + continued + ", botFillCount=" + botFillCount
				+ ", hostSessionId=" + hostSessionId + ", aeroplanes=" + Arrays.toString(aeroplanes) + "]";
	}

}
