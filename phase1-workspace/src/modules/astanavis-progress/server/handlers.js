// CloudCode source. Deploy to the DEV title before using the client flow.
var AV = {
  games: ["orb-merge", "color-flow", "cake-sort"],
  reward: {
    currencyId: "VIS",
    maxScore: Number.MAX_SAFE_INTEGER,
    minDurationMs: 2000,
    maxDurationMs: 3600000
  },
  sessions: "astanavis-sessions",
  results: "astanavis-results"
};

function avOk(result) {
  if (!result || !result.Success) throw new Error(result && result.Error || "SERVER_OPERATION_FAILED");
  return result.Data;
}

function avReward(score) {
  var bonus = Math.min(Math.floor(score / AV_BALANCE.scorePerVisStep) * AV_BALANCE.visPerStep, AV_BALANCE.maxScoreBonusVis);
  return Math.min(AV_BALANCE.maxSessionVis, AV_BALANCE.baseVisReward + bonus);
}

function avGrant(item, user) {
  if (item.OwnerUserID !== user || item.Data.userId !== user) throw new Error("SESSION_NOT_OWNED");
  if (item.Data.status === "settled") return false;
  // ApplyResourceOperation's stable Reason is the platform idempotency key.
  avOk(server.ApplyResourceOperation({
    Reason: "astanavis:round:" + user + ":" + item.ItemID,
    Operation: { Grant: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: AV.reward.currencyId, Amount: item.Data.visReward }] } } }
  }));
  avOk(server.UpdateDataItem(AV.results, item.ItemID, { Set: { status: "settled" } }));
  return true;
}

handlers.astanavisBeginSession = function(args, context) {
  if (!args || AV.games.indexOf(args.gameId) < 0 || Object.keys(args).some(function(key) { return key !== "gameId"; })) throw new Error("INVALID_GAME");
  var startedAt = Date.now();
  var item = avOk(server.CreateDataItem(AV.sessions, { userId: context.UserID, gameId: args.gameId, startedAt: startedAt }, null, context.UserID)).Item;
  return { sessionId: item.ItemID, gameId: args.gameId, startedAt: startedAt, minDurationMs: AV.reward.minDurationMs };
};

handlers.astanavisCompleteSession = function(args, context) {
  if (!args || AV.games.indexOf(args.gameId) < 0 || !Number.isSafeInteger(args.score) || args.score < 0 || args.score > AV.reward.maxScore || typeof args.sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(args.sessionId)) throw new Error("INVALID_RESULT");
  if (Object.keys(args).some(function(key) { return ["gameId", "score", "sessionId", "duration"].indexOf(key) < 0; })) throw new Error("CLIENT_REWARD_FIELDS_NOT_ALLOWED");

  var existing = server.GetDataItem(AV.results, args.sessionId), item;
  if (existing.Success) {
    item = existing.Data.Item;
    if (item.OwnerUserID !== context.UserID || item.Data.gameId !== args.gameId || item.Data.score !== args.score) throw new Error("RESULT_MISMATCH");
  } else {
    if (String(existing.Error).indexOf("NOT_FOUND") < 0) throw new Error(existing.Error);
    var session = avOk(server.GetDataItem(AV.sessions, args.sessionId)).Item;
    if (session.OwnerUserID !== context.UserID || session.Data.userId !== context.UserID || session.Data.gameId !== args.gameId) throw new Error("SESSION_NOT_OWNED");
    var duration = Date.now() - session.Data.startedAt;
    if (duration < AV.reward.minDurationMs || duration > AV.reward.maxDurationMs) throw new Error("INVALID_SESSION_DURATION");
    var visReward = avReward(args.score);
    item = avOk(server.CreateDataItem(AV.results, {
      userId: context.UserID,
      gameId: args.gameId,
      score: args.score,
      visReward: visReward,
      duration: duration,
      completedAt: new Date().toISOString(),
      status: "pending"
    }, args.sessionId, context.UserID)).Item;
    if (item.OwnerUserID !== context.UserID || item.Data.gameId !== args.gameId || item.Data.score !== args.score) throw new Error("RESULT_MISMATCH");
  }

  var fresh = avGrant(item, context.UserID);
  return { sessionId: item.ItemID, gameId: item.Data.gameId, score: item.Data.score, rewards: { vis: item.Data.visReward }, alreadyProcessed: !fresh };
};

handlers.astanavisRecoverPendingResults = function(args, context) {
  var query = { Where: [{ Field: "userId", Op: "eq", Value: context.UserID }, { Field: "status", Op: "eq", Value: "pending" }], Limit: 100 };
  var pending = avOk(server.QueryDataItems(AV.results, query));
  var recovered = 0, result = null;
  for (var i = 0; pending.Items && i < pending.Items.length; i++) {
    var item = pending.Items[i];
    if (avGrant(item, context.UserID)) {
      recovered++;
      result = { sessionId: item.ItemID, gameId: item.Data.gameId, score: item.Data.score, rewards: { vis: item.Data.visReward }, alreadyProcessed: true };
    }
  }
  return { recovered: recovered, result: result };
};
