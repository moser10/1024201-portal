import test from "node:test";
import assert from "node:assert/strict";
import { showPortalModal, hidePortalModal } from "./portalModal.js";

test("portal modals move onto document.body so chrome cannot leak through", () => {
  const body = { children: [], appendChild(node) { this.children.push(node); node.parentNode = this; } };
  const nest = {};
  const el = { parentNode: nest, hidden: true };
  globalThis.document = { body };
  showPortalModal(el);
  assert.equal(el.parentNode, body);
  assert.equal(el.hidden, false);
  hidePortalModal(el);
  assert.equal(el.hidden, true);
});
