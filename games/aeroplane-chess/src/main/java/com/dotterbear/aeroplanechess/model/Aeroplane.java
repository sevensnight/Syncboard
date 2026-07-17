package com.dotterbear.aeroplanechess.model;

public class Aeroplane {

	private int color;
	private String inCellId;

	public Aeroplane() {
	}

	public Aeroplane(int color, String inCellId) {
		super();
		this.color = color;
		this.inCellId = inCellId;
	}

	public int getColor() {
		return color;
	}

	public void setColor(int color) {
		this.color = color;
	}

	public String getInCellId() {
		return inCellId;
	}

	public void setInCellId(String inCellId) {
		this.inCellId = inCellId;
	}

	@Override
	public String toString() {
		return "Aeroplane [color=" + color + ", inCellId=" + inCellId + "]";
	}

}
