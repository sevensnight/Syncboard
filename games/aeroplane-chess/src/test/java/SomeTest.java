import static org.junit.Assert.assertTrue;

import org.junit.Test;

import com.dotterbear.aeroplanechess.utils.DiceUtils;

public class SomeTest {

	@Test
	public void roll() {
		DiceUtils diceUtils = new DiceUtils(1, 6);
		for (int i = 0; i < 100; i++) {
			int roll = diceUtils.roll();
			assertTrue(roll >= 1 && roll <= 6);
		}
	}

}
