(function () {
  const TRACKING_TIME_MINUTES = [60, 60 * 6]; // modify here for different breakdowns, multiple is OK
  const MS_ACCURACY = 20 * 1000; // polling interval in milliseconds for exp checks

  const VALUE = 0, TIMESTAMP = 1, NEXT = 2;
  // linked list, Node: [expValue, timestamp, nextNode]
  function EXPList(expireMinutes) {
    this.head = null;
    this.tail = null;
    this._expireTime = expireMinutes * 60 * 1000;
  };
  EXPList.prototype.add = function EXPListAdd(value, timestamp = Date.now()) {
    if (this.tail && this.tail[VALUE] === value) {
      this.tail[TIMESTAMP] = timestamp;
    } else {
      const node = new Array(3);
      node[VALUE] = value;
      node[TIMESTAMP] = timestamp;
      node[NEXT] = null;

      if (!this.head) {
        this.head = node;
      } else {
        this.tail[NEXT] = node;
      }
      this.tail = node;
    }
  };
  EXPList.prototype.expireNodes = function EXPListExpireNodes(now = Date.now()) {
    const minAllowedTime = now - this._expireTime;
    if (!this.head) {
      return;
    }
    let node = this.head[NEXT]
    while (node && node[TIMESTAMP] < minAllowedTime) {
      node = node[NEXT];
    }
    this.head[NEXT] = node;
  };
  EXPList.prototype.getRange = function EXPListGetRange() {
    if (!this.head) {
      return 0;
    }
    return this.tail[VALUE] - this.head[VALUE];
  };
  EXPList.prototype.getPeriod = function EXPListGetPeriod() {
    if (!this.head) {
      return 0;
    }
    return this.tail[TIMESTAMP] - this.head[TIMESTAMP];
  };

  function WindowedList(existingList, expireMinutes) {
    this.head = existingList.head;
    this._trackingList = existingList;
    this._expireTime = expireMinutes * 60 * 1000;
    this.expireNodes();
  }
  WindowedList.prototype.add = function WindowedListAdd(value, timestamp) {
    return this._trackingList.add(value, timestamp);
  };
  WindowedList.prototype.expireNodes = function WindowedListExpireNodes(now = Date.now()) {
    const minAllowedTime = now - this._expireTime;

    if (!this.head && this._trackingList.head) {
      this.head = this._trackingList.head;
    }

    // move this list head to the first one within our time range
    while (this.head && this.head[TIMESTAMP] < minAllowedTime) {
      this.head = this.head[NEXT];
    }
  };
  WindowedList.prototype.getRange = function WindowedListGetRange() {
    if (!this.head) {
      return 0;
    }
    return this._trackingList.tail[VALUE] - this.head[VALUE];
  };
  WindowedList.prototype.getPeriod = function WindowedListGetPeriod() {
    if (!this.head) {
      return 0;
    }
    return this._trackingList.tail[TIMESTAMP] - this.head[TIMESTAMP];
  };
  

  console.log('Initializing EXP tracker...');

  const trackingMinuteStrings = (function () {
    const modifiers = [24 * 60, 60, 1];
    const modifierStrings = ['day', 'hour', 'minute'];
    return TRACKING_TIME_MINUTES.map(minutes => modifiers.reduce((acc, modifier, i) => {
      let currentString = acc.s;
      let remainder = acc.r;

      let amount = Math.floor(remainder / modifier);

      if (amount >= 1) {
        acc.s = `${currentString && currentString + ' '}${amount} ${amount > 1 ? modifierStrings[i] + 's' : modifierStrings[i]}`;
        acc.r = remainder % modifier;
      }
      return acc;
    }, { s: '', r: minutes }).s);
  })();

  const MAX_KEEP_MINUTES = Math.max.apply(Math, TRACKING_TIME_MINUTES);

  window.expTrackingReset = initialize;
  initialize();

  function initialize() {
    const skillNames = window.skillName;

    // individual exp tracker for each skill
    const skillSessionExp = skillNames.map(() => new EXPList(MAX_KEEP_MINUTES));

    const now = Date.now();
    // initialize each skill's exp
    getSkillsExp().forEach((exp, i) => skillSessionExp[i].add(exp, now));
    // initialize trackers for each interval
    const skillIntervalExp = TRACKING_TIME_MINUTES.map(minutes => skillSessionExp.map(expList => new WindowedList(expList, minutes)));
    
    // { 'Woodcutting': { Session: number, '1 hour': number }, ... }
    window.MAExpTracker = {};

    function updateExpTracker() {
      const now = Date.now();
      getSkillsExp().forEach((exp, i) => {
        skillSessionExp[i].add(exp, now);
        skillSessionExp[i].expireNodes(now);
      });
      skillIntervalExp.forEach(expLists => expLists.forEach(expList => expList.expireNodes(now)));
      skillNames.forEach((skillName, skillIndex) => {
        window.MAExpTracker[skillName] = {};
        const currentSkillTrackers = window.MAExpTracker[skillName];
        currentSkillTrackers['Session'] = skillSessionExp[skillIndex].getRange();
        trackingMinuteStrings.forEach((interval, intervalIndex) => {
          const intervalTracker = skillIntervalExp[intervalIndex][skillIndex];
          currentSkillTrackers[interval] = intervalTracker.getRange();
        })
      })
    }
    if (window.iExpTracking) {
      clearInterval(window.iExpTracking);
    }
    window.iExpTracking = setInterval(updateExpTracker, MS_ACCURACY);
    console.log('EXP tracker initialized. Cancel the tracker with "clearInterval(window.iExpTracking)".');
  }

  function getSkillExp(skill) {
    return (window.skillXP || [])[skill] || 0;
  }
  function getSkillsExp() {
    return (window.skillName || []).map((_, i) => getSkillExp(i));
  }
})();
