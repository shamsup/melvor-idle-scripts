(function(){
  const maxInterval = 100;
  const runAwayMessage = 'shamsup Auto Eat ran away because you ran out of food!';
  const stopThievingMessage = 'shamsup Auto Eat stopped pickpocketing because you ran out of food!';

  if (window.shamsup_autoEatTimer) {
    clearTimeout(window.shamsup_autoEatTimer);
  }
  window.shamsup_cancelAutoEat = function() {
    clearTimeout(window.shamsup_autoEatTimer);
    notifyPlayer(CONSTANTS.skill.Attack, 'shamsup Auto Eat Disabled!!', 'danger');
  }
  
  window.shamsup_autoEatTimer = setTimeout(shamsup_autoEat, 100);
  console.log('shamsup Auto Eat enabled! To disable, type `shamsup_cancelAutoEat()` in the console.');
  notifyPlayer(CONSTANTS.skill.Attack, 'shamsup Auto Eat enabled!');

  function calculateSpecialDamage(specialAttack) {
    if (typeof specialAttack === 'number') {
      specialAttack = enemySpecialAttacks[id];
    }
    let baseDamage = specialAttack.setDamage ? specialAttack.setDamage * numberMultiplier : combatData.enemy.maximumStrengthRoll;
    if (specialAttack.stunDamageMultiplier != null && combatData.player.stunned) {
      return baseDamage * specialAttack.stunDamageMultiplier;
    }
    return baseDamage;
  }
  function hasFood() {
    if (!equippedFood[currentCombatFood] || equippedFood[currentCombatFood].qty == 0) {
      if (isDungeon && isInCombat && !equipmentSwapPurchased) {
        return false;
      }
      let newFood = equippedFood.findIndex(food => food && food.qty > 0);
      if (newFood < 0) {
        return false;
      }
      selectEquippedFood(newFood);
    }
    return true;
  }
  function shamsup_autoEat() {
    if (isInCombat && !newEnemyLoading) {
      let enemyMaxHitBase = combatData.enemy.maximumStrengthRoll;
      let enemyMaxHit = enemyMaxHitBase;
      if (combatData.enemy.hasSpecialAttack) {
        let specialAttacks = combatData.enemy.specialAttackID;
        enemyMaxHit = Math.max.call(Math, enemyMaxHit, ...specialAttacks.map(calculateSpecialDamage))
      }
      enemyMaxHit = (1 - (damageReduction / 100)) * enemyMaxHit;

      // hit could kill player and player isn't full health
      while(enemyMaxHit >= combatData.player.hitpoints && combatData.player.hitpoints < maxHitpoints ) {
        // if out of food, run
        if (!hasFood()) {
          stopCombat(false, true, true);
          console.log(runAwayMessage);
          notifyPlayer(CONSTANTS.skill.Attack, runAwayMessage, 'danger');
          window.shamsup_autoEatTimer = setTimeout(shamsup_autoEat, maxInterval);
          return;
        }
        eatFood();
      }
    } else if (isThieving) {
      while(combatData.player.hitpoints <= thievingNPC[npcID].maxHit * numberMultiplier) {
        // if out of food, stop pickpocketing
        if (!hasFood()) {
          pickpocket(npcID, true);
          console.log(stopThievingMessage);
          notifyPlayer(CONSTANTS.skill.Thieving, stopThievingMessage, 'danger');
          window.shamsup_autoEatTimer = setTimeout(shamsup_autoEat, maxInterval);
          return;
        } else {
          eatFood();
        }
      }
    } 
    window.shamsup_autoEatTimer = setTimeout(shamsup_autoEat, maxInterval);
  }
})();
