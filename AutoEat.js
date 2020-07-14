(function(){
  if (window.iAutoEat) {
    clearInterval(window.iAutoEat);
  }
  window.iAutoEat = setInterval(() => {
    if (isInCombat && 2 * combatData.enemy.maximumStrengthRoll >= combatData.player.hitpoints) {
      if (!equippedFood[currentCombatFood] || equippedFood[currentCombatFood].qty == 0) {
        stopCombat(false, true, true);
      } else {
        eatFood();
      }
    } else if (isThieving && combatData.player.hitpoints <= 2 * thievingNPC[npcID].maxHit * numberMultiplier) {
      if (!equippedFood[currentCombatFood] || equippedFood[currentCombatFood].qty == 0) {
        // stop pickpocketing
        pickpocket(npcID, true);
      } else {
        eatFood();
      }
    }
  }, 1000);
})();
