(function(){
  if (window.iAutoLoot) {
    clearInterval(window.iAutoLoot);
  }
  window.iAutoLoot = setInterval(() => {
    if (droppedLoot.length) {
      lootAll();
    }
  }, 10000);
})();
