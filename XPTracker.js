(function () {
  const TRACKING_TIME_MINUTES = [60, 60 * 6]; // modify here for different breakdowns, multiple is OK
  const MS_ACCURACY = 20 * 1000; // polling interval in milliseconds for xp checks

  const VALUE = 0, TIMESTAMP = 1, NEXT = 2;
  // linked list, Node: [xpValue, timestamp, nextNode]
  function XPList(expireMinutes) {
    this.head = null;
    this.tail = null;
    this._expireTime = expireMinutes * 60 * 1000;
  };
  XPList.prototype.add = function XPListAdd(value, timestamp = Date.now()) {
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
  XPList.prototype.expireNodes = function XPListExpireNodes(now = Date.now()) {
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
  XPList.prototype.getRange = function XPListGetRange() {
    if (!this.head) {
      return 0;
    }
    return this.tail[VALUE] - this.head[VALUE];
  };
  XPList.prototype.getPeriod = function XPListGetPeriod() {
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


  console.log('Initializing XP tracker...');

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

  window.xpTrackingReset = initialize;
  initialize();

  function initialize() {
    const skillNames = window.skillName;

    // individual session xp tracker for each skill
    const skillSessionXP = skillNames.map(() => new XPList(MAX_KEEP_MINUTES));

    const now = Date.now();
    // initialize each skill's xp
    getSkillsXP().forEach((xp, i) => skillSessionXP[i].add(xp, now));
    // initialize trackers for each interval for each skill
    const skillIntervalXP = TRACKING_TIME_MINUTES.map(minutes => skillSessionXP.map(xpList => new WindowedList(xpList, minutes)));

    /*
      {
        'Woodcutting': {
          'Session': {
            actual: <number: xp gained>,
            period: <number: ms duration of session>
          },
          [interval as string (ie '1 hour')]: {
            actual: <number: xp gained during `period`>,
            period: <number: ms time `actual` was measured (may vary from interval specified)>,
            projected: <number: expected xp gain for the interval (actual * (interval / period))>
          },
          ...all intervals
        },
        ...all skills
      }
    */
    window.shamsupXPTracker = {};

    function updateXPTracker() {
      const now = Date.now();
      getSkillsXP().forEach((xp, i) => {
        skillSessionXP[i].add(xp, now);
        skillSessionXP[i].expireNodes(now);
      });
      skillIntervalXP.forEach(xpLists => xpLists.forEach(xpList => xpList.expireNodes(now)));
      skillNames.forEach((skillName, skillIndex) => {
        window.shamsupXPTracker[skillName] = {};
        const currentSkillTrackers = window.shamsupXPTracker[skillName];
        currentSkillTrackers['Session'] = skillSessionXP[skillIndex].getRange();
        trackingMinuteStrings.forEach((interval, intervalIndex) => {
          const intervalTracker = skillIntervalXP[intervalIndex][skillIndex];
          currentSkillTrackers[interval] = intervalTracker.getRange();
        })
      })
    }
    if (window.iXPTracking) {
      clearInterval(window.iXPTracking);
    }
    window.iXPTracking = setInterval(updateXPTracker, MS_ACCURACY);
    console.log('XP tracker initialized. Cancel the tracker with "clearInterval(window.iXPTracking)".');
  }

  function getSkillXP(skill) {
    return (window.skillXP || [])[skill] || 0;
  }
  function getSkillsXP() {
    return (window.skillName || []).map((_, i) => getSkillXP(i));
  }
})();
