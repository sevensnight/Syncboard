package com.dotterbear.aeroplanechess.utils;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import com.dotterbear.aeroplanechess.enums.CellPrefix;
import com.dotterbear.aeroplanechess.model.Aeroplane;

public class AeroplaneChessUtils {

	@Autowired
	private DiceUtils diceUtils;

	@Autowired
	private MoveUtils moveUtils;

	@Value(value = "${websocket.aeroplanechess.config.numof.aeroplane}")
	private int numOfAeroplane;

	public int roll() {
		return diceUtils.roll();
	}

	public void allBackToBase(Aeroplane[] aeroplanes, int playerIndex) {
		moveUtils.allBackToBase(aeroplanes, playerIndex);
	}

	public List<Integer> move(Aeroplane[] aeroplanes, int aeroplaneIndex, int rollResult) {
		return moveUtils.move(aeroplanes, aeroplaneIndex, rollResult);
	}

	public boolean isWin(Aeroplane[] aeroplanes, int currentPlayer) {
		int count = 0;
		for (int i = currentPlayer * numOfAeroplane; i < i + numOfAeroplane; i++) {
			if (aeroplanes[i].getInCellId().substring(0, 2).equals(CellPrefix.GOAL.getPrefix()))
				count++;
			else
				break;
		}
		return count == numOfAeroplane;
	}

}
