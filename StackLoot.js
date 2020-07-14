(function(){
  if (window.iAutoStackLoot) {
    clearInterval(window.iAutoStackLoot);
  }
  window.iAutoStackLoot = setInterval(() => {
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
