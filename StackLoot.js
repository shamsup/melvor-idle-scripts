(function(){
  if (window.shamsup_stackLootTimer) {
    clearInterval(window.shamsup_stackLootTimer);
  }
  window.shamsup_stackLootTimer = setInterval(() => {
    let oldLength = droppedLoot.length;
    let lootOrder = new Set(droppedLoot.map(item => item.itemID));
    if (droppedLoot.length) {
      let lootCounts = droppedLoot.reduce((acc, item) => {
        if (!acc[item.itemID]) {
           acc[item.itemID] = 0;
        }
        acc[item.itemID] += item.qty;
        return acc;
      }, {});
      droppedLoot = [...lootOrder].map(itemID => ({
        itemID,
        qty: lootCounts[itemID]
      }));
      if (droppedLoot.length !== oldLength) {
        loadLoot();
      }
    }
  }, 1000);
})();
