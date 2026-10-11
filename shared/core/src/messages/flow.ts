// Flows: errors, run logs and stop reasons (see index.ts).
export const FLOW_MESSAGES = {
  // errors
  nameLength: ['max'],
  actionCount: ['min', 'max'],
  invalidAction: [],
  chooseArmy: [],
  targetsOwnCities: [],
  chooseCities: [],
  notFound: [],
  /** a running flow's actions may change settings, not order */
  runningLocked: [],
  tooMany: ['count'],
  noMayorHero: [],
  /** `missing`: a list of req.* messages */
  cannotTrain: ['troop', 'missing'],
  'req.level': ['name', 'level'],
  'req.item': ['name', 'amount'],
  alreadyQueued: [],
  alreadyRunning: [],
  /** "all cities" has no city to run on; also a stop reason */
  noHeroCities: [],
  chooseCity: [],
  /** the flow's chosen cities were all lost; also a stop reason */
  noOwnCities: [],
  /** a city's part failed on something other than a game rule */
  cityFailed: [],

  // stop reasons (Flow.stopReason), besides noHeroCities / noOwnCities
  /** `cities`: a list of failedCity messages */
  runFailed: ['cities'],
  failedCity: ['city', 'error'],

  // pushed to the player
  stopped: ['name', 'reason'],
  healDone: ['city', 'result'],
  healFailed: ['city', 'error'],

  // actions, as the run log and the editor list them
  'action.setMayor': ['stat'],
  'action.healResources': [],
  'action.healHonour': [],
  'action.healResourcesHome': [],
  'action.healHonourHome': [],
  'action.waitArmiesHome': [],
  'action.wait': ['time'],
  'action.attack': ['count'],
  /** targets listed under several cities; `cities` is a cityCount message */
  'action.attackFrom': ['count', 'cities'],
  'action.train': ['amount', 'troop'],
  'action.trainMax': ['troop'],
  cityCount: ['count'],
  resourceAmount: ['amount', 'resource'],

  // what a step did (FlowStepResult.detail)
  'step.noTargets': [],
  'step.armyGone': [],
  'step.noArmy': [],
  'step.sent': ['sent', 'total', 'army'],
  'step.noInjured': [],
  'step.healed': ['count', 'cost'],
  'step.healedHonour': ['count', 'honour'],
  /** `time`: about when the armies are home */
  'step.healScheduled': ['count', 'time'],
  'step.alreadyMayor': ['hero', 'stat', 'value'],
  'step.mayor': ['hero', 'stat', 'value'],
  'step.noBarracksRoom': [],
  'step.cannotAfford': ['troop'],
  /** `count`: barracks used */
  'step.training': ['amount', 'troop', 'count', 'time'],
  'step.trainingDone': ['amount', 'troop', 'count'],
  /** fewer than asked for were affordable */
  'step.trainingPartial': ['amount', 'requested', 'troop', 'count', 'time'],
  'step.trainingPartialDone': ['amount', 'requested', 'troop', 'count'],
  'step.noArmiesOut': [],
  /** `time`: about how long */
  'step.waiting': ['time'],
  /** a preview's last step: `count` actions after the first wait were not previewed */
  'step.moreActions': ['count'],
  'step.runEnds': [],

  // one target of an attack step (items[].detail)
  'target.sent': ['hero'],
  'target.noIdleHero': [],
  'target.notEnoughTroops': ['army'],
  /** `reason`: why sending the army was refused */
  'target.refused': ['reason'],

  /** a city "all cities" leaves out (FlowSkippedCity.reason) */
  skipNoHero: [],
} as const;
