import notification from "./utils/notification-kit";
const JuejinHelper = require("juejin-helper");
const utils = require("./utils/utils");
const env = require("./utils/env");

class Task {
  constructor(juejin) {
    this.juejin = juejin;
  }

  taskName = "";

  async run() {}

  toString() {
    return `[${this.taskName}]`;
  }
}

class GrowthTask extends Task {
  taskName = "成长任务";

  todayStatus = 0; // 未签到
  incrPoint = 0;
  sumPoint = 0; // 当前矿石数
  contCount = 0; // 连续签到天数
  sumCount = 0; // 累计签到天数

  async run() {
    const growth = this.juejin.growth();

    const todayStatus = await growth.getTodayStatus();
    if (!todayStatus) {
      const checkInResult = await growth.checkIn();

      this.incrPoint = checkInResult.incr_point;
      this.sumPoint = checkInResult.sum_point;
      this.todayStatus = 1; // 本次签到
    } else {
      this.todayStatus = 2; // 已签到
    }

    const counts = await growth.getCounts();
    this.contCount = counts.cont_count;
    this.sumCount = counts.sum_count;
  }
}

class BugfixTask extends Task {
  taskName = "Bugfix";

  bugStatus = 0;
  collectBugCount = 0;
  userOwnBug = 0;

  async run() {
    const bugfix = this.juejin.bugfix();

    const competition = await bugfix.getCompetition();
    const bugfixInfo = await bugfix.getUser(competition);
    this.userOwnBug = bugfixInfo.user_own_bug;

    try {
      const notCollectBugList = await bugfix.getNotCollectBugList();
      await bugfix.collectBugBatch(notCollectBugList);
      this.bugStatus = 1;
      this.collectBugCount = notCollectBugList.length;
      this.userOwnBug += this.collectBugCount;
    } catch (e) {
      this.bugStatus = 2;
    }
  }
}

class LotteriesTask extends Task {
  taskName = "抽奖";

  lottery = []; // 奖池
  pointCost = 0; // 一次抽奖消耗
  freeCount = 0; // 免费抽奖次数
  drawLotteryHistory = {};
  lotteryCount = 0;
  luckyValueProbability = 0;

  async run(growthTask) {
    const growth = this.juejin.growth();

    const lotteryConfig = await growth.getLotteryConfig();
    this.lottery = lotteryConfig.lottery;
    this.pointCost = lotteryConfig.point_cost;
    this.freeCount = lotteryConfig.free_count;
    this.lotteryCount = 0;

    let freeCount = this.freeCount;
    while (freeCount > 0) {
      const result = await growth.drawLottery();
      this.drawLotteryHistory[result.lottery_id] = (this.drawLotteryHistory[result.lottery_id] || 0) + 1;
      freeCount--;
      this.lotteryCount++;
      await utils.wait(utils.randomRangeNumber(300, 1000));
    }

    growthTask.sumPoint = await growth.getCurrentPoint();

    const getProbabilityOfWinning = sumPoint => {
      const pointCost = this.pointCost;
      const luckyValueCost = 10;
      const totalDrawsNumber = sumPoint / pointCost;
      let supplyPoint = 0;
      for (let i = 0, length = Math.floor(totalDrawsNumber * 0.65); i < length; i++) {
        supplyPoint += Math.ceil(Math.random() * 100);
      }
      const luckyValue = ((sumPoint + supplyPoint) / pointCost) * luckyValueCost;
      return luckyValue / 6000;
    };

    this.luckyValueProbability = getProbabilityOfWinning(growthTask.sumPoint);
  }
}

class SdkTask extends Task {
  taskName = "埋点";

  calledSdkSetting = false;
  calledTrackGrowthEvent = false;
  calledTrackOnloadEvent = false;

  async run() {
    console.log("------事件埋点追踪-------");

    const sdk = this.juejin.sdk();

    try {
      await sdk.slardarSDKSetting();
      this.calledSdkSetting = true;
    } catch {
      this.calledSdkSetting = false;
    }
    console.log(`SDK状态: ${this.calledSdkSetting ? "加载成功" : "加载失败"}`);

    try {
      const result = await sdk.mockTrackGrowthEvent();
      if (result && result.e === 0) {
        this.calledTrackGrowthEvent = true;
      } else {
        throw result;
      }
    } catch {
      this.calledTrackGrowthEvent = false;
    }
    console.log(`成长API事件埋点: ${this.calledTrackGrowthEvent ? "调用成功" : "调用失败"}`);

    try {
      const result = await sdk.mockTrackOnloadEvent();
      if (result && result.e === 0) {
        this.calledTrackOnloadEvent = true;
      } else {
        throw result;
      }
    } catch {
      this.calledTrackOnloadEvent = false;
    }
    console.log(`OnLoad事件埋点: ${this.calledTrackOnloadEvent ? "调用成功" : "调用失败"}`);

    console.log("-------------------------");
  }
}

class MockVisitTask extends Task {
  taskName = "模拟访问";
