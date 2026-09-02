import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseBooleanEnv,
  getKillSwitches,
  isManualSyncDisabled,
  isAiWritesDisabled,
  isMeliWritesDisabled,
  isWhatsappAgentDisabled,
} from "../../src/lib/safety/killSwitches";

describe("Kill Switches Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.KLYVO_DISABLE_MANUAL_SYNCS;
    delete process.env.KLYVO_DISABLE_AI_WRITES;
    delete process.env.KLYVO_DISABLE_MELI_WRITES;
    delete process.env.KLYVO_DISABLE_WHATSAPP_AGENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("parseBooleanEnv", () => {
    test("handles truthy inputs", () => {
      assert.equal(parseBooleanEnv("true"), true);
      assert.equal(parseBooleanEnv("TRUE"), true);
      assert.equal(parseBooleanEnv("1"), true);
      assert.equal(parseBooleanEnv("yes"), true);
      assert.equal(parseBooleanEnv("on"), true);
      assert.equal(parseBooleanEnv(" true "), true);
    });

    test("handles falsy and empty inputs", () => {
      assert.equal(parseBooleanEnv("false"), false);
      assert.equal(parseBooleanEnv("FALSE"), false);
      assert.equal(parseBooleanEnv("0"), false);
      assert.equal(parseBooleanEnv("no"), false);
      assert.equal(parseBooleanEnv("off"), false);
      assert.equal(parseBooleanEnv(""), false);
      assert.equal(parseBooleanEnv(undefined), false);
      assert.equal(parseBooleanEnv(null), false);
    });
  });

  describe("Kill Switch getters", () => {
    test("defaults all kill switches to false when env vars are absent", () => {
      const state = getKillSwitches();
      assert.equal(state.disableManualSyncs, false);
      assert.equal(state.disableAiWrites, false);
      assert.equal(state.disableMeliWrites, false);
      assert.equal(state.disableWhatsappAgent, false);

      assert.equal(isManualSyncDisabled(), false);
      assert.equal(isAiWritesDisabled(), false);
      assert.equal(isMeliWritesDisabled(), false);
      assert.equal(isWhatsappAgentDisabled(), false);
    });

    test("activates kill switch when variable is set to true or 1", () => {
      process.env.KLYVO_DISABLE_MANUAL_SYNCS = "1";
      process.env.KLYVO_DISABLE_WHATSAPP_AGENT = "true";

      const state = getKillSwitches();
      assert.equal(state.disableManualSyncs, true);
      assert.equal(state.disableAiWrites, false);
      assert.equal(state.disableMeliWrites, false);
      assert.equal(state.disableWhatsappAgent, true);

      assert.equal(isManualSyncDisabled(), true);
      assert.equal(isWhatsappAgentDisabled(), true);
    });
  });
});
