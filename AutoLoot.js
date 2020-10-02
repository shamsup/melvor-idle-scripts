(function(){
  if (window.shamsup_autoLootTimer) {
    clearInterval(window.shamsup_autoLootTimer);
  }
  window.shamsup_autoLootTimer = setInterval(() => {
    if (droppedLoot.length) {
      lootAll();
    }
  }, 10000);
})();
