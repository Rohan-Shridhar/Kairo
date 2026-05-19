// shared/messaging.js — Typed message bus constants + timeout-safe sender

export const MSG = {
  SAVE_CAPSULE:    'SAVE_CAPSULE',
  GET_CAPSULES:    'GET_CAPSULES',
  DELETE_CAPSULE:  'DELETE_CAPSULE',
  UPDATE_CAPSULE:  'UPDATE_CAPSULE',
  INJECT_CONTEXT:  'INJECT_CONTEXT',    // inject Capsule text into active tab's input
  ENRICH_CAPSULE:  'ENRICH_CAPSULE',    // trigger Claude API enrichment
  GET_SETTINGS:    'GET_SETTINGS',
  SAVE_SETTINGS:   'SAVE_SETTINGS',
  CLEAR_ALL:       'CLEAR_ALL',
};

/**
 * Send a message with timeout safety.
 * @param {Object} payload - Message payload with `type` and optional data
 * @param {number} timeoutMs - Timeout in milliseconds (default 10s)
 * @returns {Promise<any>}
 */
export function sendMessage(payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('[Kairo] Message timeout')), timeoutMs);

    chrome.runtime.sendMessage(payload, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(response);
    });
  });
}
