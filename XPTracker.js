(function () {
  const TRACKING_TIME_MINUTES = [60, 60 * 6]; // modify here for different breakdowns, multiple is OK
  const MS_ACCURACY = 5 * 1000; // polling interval in milliseconds for xp checks
  const INCLUDE_UI = true; // whether or not to add the tracker UI to the header
  const ID_PREFIX = 'shamsup-xp-tracker';

  /* DO NOT MODIFY BELOW THIS LINE */

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
  const levelPredictionWindows = []; // minutes to base level prediction off of, by skill ID
  levelPredictionWindows[CONSTANTS.skill.Attack] = 10;
  levelPredictionWindows[CONSTANTS.skill.Strength] = 10;
  levelPredictionWindows[CONSTANTS.skill.Defence] = 10;
  levelPredictionWindows[CONSTANTS.skill.Ranged] = 10;
  levelPredictionWindows[CONSTANTS.skill.Magic] = 10;
  levelPredictionWindows[CONSTANTS.skill.Hitpoints] = 20;
  levelPredictionWindows[CONSTANTS.skill.Slayer] = 20;
  levelPredictionWindows[CONSTANTS.skill.Prayer] = 20;
  levelPredictionWindows[CONSTANTS.skill.Woodcutting] = 5;
  levelPredictionWindows[CONSTANTS.skill.Fishing] = 10;
  levelPredictionWindows[CONSTANTS.skill.Mining] = 20;
  levelPredictionWindows[CONSTANTS.skill.Thieving] = 10;
  levelPredictionWindows[CONSTANTS.skill.Cooking] = 5;
  levelPredictionWindows[CONSTANTS.skill.Crafting] = 5;
  levelPredictionWindows[CONSTANTS.skill.Firemaking] = 5;
  levelPredictionWindows[CONSTANTS.skill.Fletching] = 5;
  levelPredictionWindows[CONSTANTS.skill.Herblore] = 5;
  levelPredictionWindows[CONSTANTS.skill.Runecrafting] = 5;
  levelPredictionWindows[CONSTANTS.skill.Smithing] = 5;
  levelPredictionWindows[CONSTANTS.skill.Farming] = 6 * 60;
  const trackingMinuteStrings = TRACKING_TIME_MINUTES.map(minutes => timeToString(minutes * 60));
  const xpTrackerTabs = ['Session', 'ETA'].concat(trackingMinuteStrings);
  const MAX_KEEP_MINUTES = Math.max.apply(Math, TRACKING_TIME_MINUTES);
  let xpTrackerSelectedTab = 0;

  window.shamsup_xpTrackingReset = initialize;
  const xpTracker = {};
  const skillNames = window.skillName;
  let skillSessionXP;
  let skillIntervalXP;
  let skillPredictionXP;
  initialize();

  function initialize() {
    if ($(`#${ID_PREFIX}`).length) {
      $(`#${ID_PREFIX}`).remove();
    }

    window.shamsup_xpTracker = xpTracker;
    const now = Date.now();
    // individual session xp tracker for each skill
    skillSessionXP = skillNames.map(() => new XPList(MAX_KEEP_MINUTES));
    // initialize each skill's xp
    getSkillsXP().forEach((xp, i) => skillSessionXP[i].add(xp, now));
    // initialize trackers for each interval for each skill
    skillIntervalXP = TRACKING_TIME_MINUTES.map(minutes => skillSessionXP.map(xpList => new WindowedList(xpList, minutes)));
    // initialize level prediction trackers for each skill
    skillPredictionXP = levelPredictionWindows.map((minutes, skillIndex) => new WindowedList(skillSessionXP[skillIndex], minutes));

    loadXPValues();

    function updateXPTracker() {
      const now = Date.now();
      getSkillsXP().forEach((xp, i) => {
        skillSessionXP[i].add(xp, now);
        skillSessionXP[i].expireNodes(now);
      });
      skillIntervalXP.forEach(xpLists => xpLists.forEach(xpList => xpList.expireNodes(now)));
      skillPredictionXP.forEach(xpList => xpList.expireNodes(now));
      loadXPValues();
      if (INCLUDE_UI) drawXPTracker();
    }

    if (window.iXPTracking) {
      clearInterval(window.iXPTracking);
    }
    window.iXPTracking = setInterval(updateXPTracker, MS_ACCURACY);
    window.shamsup_xpTrackerSelectTab = xpTrackerSelectTab;
    if (INCLUDE_UI) {
      drawHeaderButton();
      drawXPTracker();
    }
    console.log('XP tracker initialized. Cancel the tracker with "clearInterval(window.iXPTracking)".');
  }

  function getSkillXP(skill) {
    return (window.skillXP || [])[skill] || 0;
  }
  function getSkillsXP() {
    return (skillNames || []).map((_, i) => getSkillXP(i));
  }

  function loadXPValues() {
    skillNames.forEach((skillName, skillIndex) => {
      if (!xpTracker[skillName]) {
        xpTracker[skillName] = {};
      }
      updateSkillSessionXP(skillIndex);
      updateSkillIntervalXP(skillIndex);
      updateSkillETAPredictionXP(skillIndex);
    });
  }

  function updateSkillSessionXP(skillIndex) {
    xpTracker[skillNames[skillIndex]]['Session'] = {
      actual: skillSessionXP[skillIndex].getRange(),
      period: skillSessionXP[skillIndex].getPeriod(),
    };
  }

  function updateSkillIntervalXP(skillIndex) {
    trackingMinuteStrings.forEach((interval, intervalIndex) => {
      const intervalTracker = skillIntervalXP[intervalIndex][skillIndex];
      const actualXP = intervalTracker.getRange();
      const trackPeriod = intervalTracker.getPeriod();
      const projectedXP = (TRACKING_TIME_MINUTES[intervalIndex] * 60 * 1000) / (trackPeriod || 1) * actualXP;
      xpTracker[skillNames[skillIndex]][interval] = {
        actual: actualXP,
        period: trackPeriod,
        projected: projectedXP
      };
    });
  }

  function updateSkillETAPredictionXP(skillIndex) {
    const nextLevelXP = exp.level_to_xp(skillLevel[skillIndex] + 1);
    const xpToLevel = nextLevelXP - skillXP[skillIndex];
    const periodActualXP = skillPredictionXP[skillIndex].getRange();
    xpTracker[skillNames[skillIndex]]['ETA'] = {
      actual: skillPredictionXP[skillIndex].getRange(),
      progress: nextLevelProgress[skillIndex],
      eta: (xpToLevel / periodActualXP) * skillPredictionXP[skillIndex].getPeriod(),
    };
  }

  function timeToString(seconds, short = false) {
    const modifiers = [24 * 60 * 60, 60 * 60, 60, 1];
    const modifierStrings = ['day', 'hour', 'minute', 'second'];
    return modifiers.reduce((acc, modifier, i) => {
      let currentString = acc.s;
      let remainder = acc.r;

      let amount = Math.floor(remainder / modifier);

      if (amount >= 1) {
        acc.s = `${currentString && currentString + ' '}${amount}`
        if (short) {
          acc.s += modifierStrings[i][0];
        } else {
          acc.s += ` ${amount > 1 ? modifierStrings[i] + 's' : modifierStrings[i]}`;
        }
        acc.r = remainder % modifier;
      }
      return acc;
    }, { s: '', r: seconds }).s;
  }

  function drawHeaderButton() {
    // add button to the header and skills list container
    if ($(`#${ID_PREFIX}-dropdown-button`).length === 0) {
      $('#header-theme > .d-flex.align-items-center:last-child').prepend(`
      <div class="dropdown d-inline-block ml-2" id="${ID_PREFIX}">
        <button id="${ID_PREFIX}-dropdown-button" type="button" class="btn btn-sm btn-dual" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          <img class="skill-icon-xxs" src="assets/media/main/statistics_header.svg" />
        </button>
        <div id="${ID_PREFIX}-dropdown-ui" class="dropdown-menu dropdown-menu-right p-0 font-size-sm" aria-labelledby="${ID_PREFIX}-dropdown-button" style="min-width: 350px;" x-placement="bottom-end">
          <div class="bg-primary text-center">
            <h5 class="dropdown-header">XP Tracker by shamsup</h5>
          </div>
          <div class="col-12 my-2 d-flex justify-content-between flex-wrap">${
            xpTrackerTabs.map((interval, intervalIndex) => `
              <button class="btn btn-sm ${intervalIndex === xpTrackerSelectedTab ? 'btn-success' : 'btn-secondary'}" onclick="shamsup_xpTrackerSelectTab(${intervalIndex});">${interval}</button>
            `).join('')
          }</div>
        ${
        xpTrackerTabs.map((_, intervalIndex) => `
            <div class="col-12 ${intervalIndex !== xpTrackerSelectedTab ? 'd-none' : ''}" id="${ID_PREFIX}-list-${intervalIndex}">
              <table class="table table-sm table-vcenter my-0">
                <thead>
                  <tr>
                    <th class="text-left" style="width: 42px" scope="col"><small>Skill</small></th>
                    ${
                      intervalIndex === 1 ? (`
                        <th class="text-right" style="" scope="col"><small>%</small></th>
                        <th class="text-center" style="width: 120px;" scope="col"><small>Progress</small></th>
                        <th class="text-right text-nowrap" style="min-width: 90px;" scope="col"><small>ETA</small></th>
                      `) : (`
                        <th class="text-right" style="min-width: 90px;" scope="col"><small>XP</small></th>
                        <th class="text-right" style="min-width: 90px;" scope="col"><small>Time</small></th>
                        ${intervalIndex !== 0 ? '<th class="text-right text-nowrap" style="min-width: 90px;" scope="col"><small>Projected XP</small></th>' : ''}
                      `)
                    }
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          `).join('')
        }
        </div>
      </div>
      `);

      $(`#${ID_PREFIX}-dropdown-ui`).on('click', function(e) {
        e.stopPropagation();
      });
    }
  }

  function drawXPTracker() {
    const $xpUI = $(`#${ID_PREFIX}-dropdown-ui`);
    xpTrackerTabs.forEach((interval, intervalIndex) => {
      const isSession = intervalIndex === 0;
      const isEta = intervalIndex === 1;
      const $list = $xpUI.find(`#${ID_PREFIX}-list-${intervalIndex}`);
      const skillActive = skillNames.map((skill, skillIndex) => {
        if (isSession) {
          return xpTracker[skill].Session.actual > 0;
        } else if (isEta) {
          return xpTracker[skill]['ETA'].actual > 0;
        }
        return xpTracker[skill][trackingMinuteStrings[intervalIndex - 2]].actual > 0
      }
      );
      skillNames.forEach((skill, skillIndex) => {
        let $skill = $list.find(`#${ID_PREFIX}-list-${intervalIndex}-skill-${skillIndex}`);
        if (skillActive[skillIndex]) {
          const skillTracker = xpTracker[skill][interval];

          if (isEta) {
            let etaFormatted = timeToString(Math.floor(skillTracker.eta / 1000), true);
            let progressFormatted = Math.floor(skillTracker.progress) + '%';
            if ($skill.length) {
              $skill.find('.progress .progress-bar').css('width', skillTracker.progress + '%');
              $skill.find('.eta').html(etaFormatted);
              $skill.find('.percent').html(progressFormatted);
            } else {
              $skill = $(`
                <tr id="${ID_PREFIX}-list-${intervalIndex}-skill-${skillIndex}">
                  <th class="text-left" scope="row"><img class="skill-icon-xxs" src="assets/media/skills/${skill.toLowerCase()}/${skill.toLowerCase()}.svg" alt="${skill}" /></th>
                  <td class="text-right"><small class="percent">${progressFormatted}</small></td>
                  <td class="text-center">
                    <div class="progress combat active" style="height: 10px; width: 100%;">
                      <div class="progress-bar bg-info" style="width: ${skillTracker.progress}%" />
                    </div>
                  </td>
                  <td class="text-right text-nowrap"><small class="eta">${etaFormatted}</small></td>
                </tr>
              `);
              $list.find('tbody').append($skill);
            }
          } else {
            let xpFormatted = skillTracker.actual.toFixed(2) + 'xp';
            let periodFormatted = timeToString(Math.floor(skillTracker.period / 1000), true);
            let projectedXPFormatted = isSession ? '' : skillTracker.projected.toFixed(2) + 'xp';

            if ($skill.length) {
              $skill.find('.actual').html(xpFormatted);
              $skill.find('.period').html(periodFormatted);
              if (!isSession) {
                $skill.find('.projected').html(projectedXPFormatted);
              }
            } else {
              $skill = $(`
                <tr id="${ID_PREFIX}-list-${intervalIndex}-skill-${skillIndex}">
                  <th class="text-left" scope="row"><img class="skill-icon-xxs" src="assets/media/skills/${skill.toLowerCase()}/${skill.toLowerCase()}.svg" alt="${skill}" /></th>
                  <td class="text-right text-nowrap"><small class="actual">${xpFormatted}</small></td>
                  <td class="text-right text-nowrap"><small class="period">${periodFormatted}</small></td>
                  ${
                    isSession ? '' : `<td class="text-right text-nowrap"><small class="projected">${projectedXPFormatted}</small></td>`
                  }
                </tr>
              `);
              $list.find('tbody').append($skill);
            }
          }
          $skill.show();
        } else {
          $skill.hide();
        }
      })
    })
  }

  function xpTrackerSelectTab(tab) {
    if (tab === xpTrackerSelectedTab) {
      return;
    }
    let previousTab = xpTrackerSelectedTab;
    if (tab >= 0 && tab < xpTrackerTabs.length) {
      xpTrackerSelectedTab = tab;
    } else {
      return;
    }
    let $xpUI = $(`#${ID_PREFIX}-dropdown-ui`);
    // style the correct tab
    $xpUI.find(`.btn-success`).removeClass('btn-success').addClass('btn-secondary');
    $xpUI.find(`.btn:nth-child(${tab + 1})`).removeClass('btn-secondary').addClass('btn-success');
    // show the correct block of stats
    $xpUI.find(`#${ID_PREFIX}-list-${previousTab}`).addClass('d-none');
    $xpUI.find(`#${ID_PREFIX}-list-${tab}`).removeClass('d-none');
  }
})();
