/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_evaluateCategories from "../actions/evaluateCategories.js";
import type * as actions_evaluateMilestones from "../actions/evaluateMilestones.js";
import type * as actions_syncLeads from "../actions/syncLeads.js";
import type * as actions_syncNR from "../actions/syncNR.js";
import type * as actions_syncQubits from "../actions/syncQubits.js";
import type * as actions_syncRCB from "../actions/syncRCB.js";
import type * as actions_syncROI from "../actions/syncROI.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as mutations_assessmentChecklists from "../mutations/assessmentChecklists.js";
import type * as mutations_huddleLogs from "../mutations/huddleLogs.js";
import type * as mutations_leads from "../mutations/leads.js";
import type * as mutations_newJoiners from "../mutations/newJoiners.js";
import type * as mutations_nr from "../mutations/nr.js";
import type * as mutations_performanceAlerts from "../mutations/performanceAlerts.js";
import type * as mutations_qubits from "../mutations/qubits.js";
import type * as mutations_rcb from "../mutations/rcb.js";
import type * as mutations_roi from "../mutations/roi.js";
import type * as mutations_syncLogs from "../mutations/syncLogs.js";
import type * as queries_huddleLogs from "../queries/huddleLogs.js";
import type * as queries_leads from "../queries/leads.js";
import type * as queries_newJoiners from "../queries/newJoiners.js";
import type * as queries_nr from "../queries/nr.js";
import type * as queries_performance from "../queries/performance.js";
import type * as queries_qubits from "../queries/qubits.js";
import type * as queries_rcb from "../queries/rcb.js";
import type * as queries_roi from "../queries/roi.js";
import type * as queries_syncLogs from "../queries/syncLogs.js";
import type * as rms_adapter from "../rms/adapter.js";
import type * as rms_index from "../rms/index.js";
import type * as rms_liveClient from "../rms/liveClient.js";
import type * as rms_mockClient from "../rms/mockClient.js";
import type * as seeds_fullSeed from "../seeds/fullSeed.js";
import type * as seeds_users from "../seeds/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/evaluateCategories": typeof actions_evaluateCategories;
  "actions/evaluateMilestones": typeof actions_evaluateMilestones;
  "actions/syncLeads": typeof actions_syncLeads;
  "actions/syncNR": typeof actions_syncNR;
  "actions/syncQubits": typeof actions_syncQubits;
  "actions/syncRCB": typeof actions_syncRCB;
  "actions/syncROI": typeof actions_syncROI;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  "mutations/assessmentChecklists": typeof mutations_assessmentChecklists;
  "mutations/huddleLogs": typeof mutations_huddleLogs;
  "mutations/leads": typeof mutations_leads;
  "mutations/newJoiners": typeof mutations_newJoiners;
  "mutations/nr": typeof mutations_nr;
  "mutations/performanceAlerts": typeof mutations_performanceAlerts;
  "mutations/qubits": typeof mutations_qubits;
  "mutations/rcb": typeof mutations_rcb;
  "mutations/roi": typeof mutations_roi;
  "mutations/syncLogs": typeof mutations_syncLogs;
  "queries/huddleLogs": typeof queries_huddleLogs;
  "queries/leads": typeof queries_leads;
  "queries/newJoiners": typeof queries_newJoiners;
  "queries/nr": typeof queries_nr;
  "queries/performance": typeof queries_performance;
  "queries/qubits": typeof queries_qubits;
  "queries/rcb": typeof queries_rcb;
  "queries/roi": typeof queries_roi;
  "queries/syncLogs": typeof queries_syncLogs;
  "rms/adapter": typeof rms_adapter;
  "rms/index": typeof rms_index;
  "rms/liveClient": typeof rms_liveClient;
  "rms/mockClient": typeof rms_mockClient;
  "seeds/fullSeed": typeof seeds_fullSeed;
  "seeds/users": typeof seeds_users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
