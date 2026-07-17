package com.dotterbear.aeroplanechess.utils;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;

import com.dotterbear.aeroplanechess.enums.CellPrefix;
import com.dotterbear.aeroplanechess.model.Aeroplane;

public class MoveUtils {

	static final int MAX_NUMOF_CIRCLE = 52;

	@Value(value = "${websocket.aeroplanechess.config.numof.aeroplane}")
	private int numOfAeroplane;

	@Value(value = "${websocket.gameroom.config.numof.player}")
	private int numOfPlayer;

	// TODO make this method more readable
	public List<Integer> move(Aeroplane[] aeroplanes, int aeroplaneIndex, int rollResult) {
		Aeroplane aeroplane = aeroplanes[aeroplaneIndex];
		int color = aeroplane.getColor();
		String cellId = aeroplane.getInCellId();
		String destPrefix = cellId.substring(0, 2);
		int destNum = Integer.parseInt(cellId.substring(2));
		List<Integer> encountered = new ArrayList<>();
		int count = rollResult;

		if (destPrefix.equals(CellPrefix.BASE.getPrefix())) {
			toTakeOff(aeroplane, rollResult);
			return encountered;
		}

		if (destPrefix.equals(CellPrefix.TAKEOFF.getPrefix())) {
			destPrefix = CellPrefix.SKY.getPrefix();
			destNum = (color * 13 + 3);
			count--;
		}

		// walk
		while (count > 0) {
			if (destPrefix.equals(CellPrefix.SKY.getPrefix()) && isTurn(destNum, color)) {
				destPrefix = CellPrefix.LANDING.getPrefix();
				destNum = color * 5;
			} else {
				destNum += 1;
				destNum %= MAX_NUMOF_CIRCLE;
			}
			count--;
		}

		// shortcut > jump
		if (destPrefix.equals(CellPrefix.SKY.getPrefix()) && destNum % numOfPlayer == color) {
			int shortcutFrom = getShortcutFrom(color);
			if (shortcutFrom == destNum) {
				destNum += 12;
				destNum %= MAX_NUMOF_CIRCLE;
			} else if (!isTurn(destNum, color)) {
				destNum += numOfPlayer;
				destNum %= MAX_NUMOF_CIRCLE;
			}
		}

		for (int i = 0; i < color * numOfAeroplane; i++) {
			if (aeroplanes[i].getInCellId().equals(destPrefix + destNum)) {
				encountered.add(i);
			}
		}

		for (int i = (color + 1) * numOfAeroplane; i < aeroplanes.length; i++) {
			if (aeroplanes[i].getInCellId().equals(destPrefix + destNum)) {
				encountered.add(i);
			}
		}

		if (!encountered.isEmpty()) {
			if (encountered.size() > 1) {
				destPrefix = CellPrefix.BASE.getPrefix();
				destNum = color;
			} else {
				int i = encountered.get(0);
				Aeroplane a = aeroplanes[i];
				a.setInCellId(CellPrefix.BASE.getPrefix() + a.getColor());
				aeroplanes[i] = a;
			}
		}

		// to goal
		if (destPrefix.equals(CellPrefix.LANDING.getPrefix())) {
			if (destNum == (color + 1) * 5) {
				destPrefix = CellPrefix.GOAL.getPrefix();
				destNum = 0;
			} else if (destNum > (color + 1) * 5) {
				destNum = destNum - (destNum - (color + 1) * 5) * 2;
			}
		}

		aeroplane.setInCellId(destPrefix + destNum);
		aeroplanes[aeroplaneIndex] = aeroplane;
		return encountered;

	}

	private void toTakeOff(Aeroplane aeroplane, int rollResult) {
		if (rollResult % 2 == 0)
			aeroplane.setInCellId(CellPrefix.TAKEOFF.getPrefix() + aeroplane.getColor());
	}

	private int getShortcutFrom(int color) {
		return ((color + 1) * 13 + 7) % 52;
	}

	private boolean isTurn(int cellNum, int color) {
		return cellNum == color * 13;
	}

	public void allBackToBase(Aeroplane[] aeroplanes, int playerIndex) {
		int start = playerIndex * numOfAeroplane;
		for (int i = start; i < start + numOfAeroplane; i++)
			aeroplanes[i].setInCellId(CellPrefix.BASE.getPrefix() + playerIndex);
	}

}
