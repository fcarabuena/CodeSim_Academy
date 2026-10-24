import type { Probe, ProbeObservation } from "./types";

/**
 * Script injected at the end of a student's page in the preview iframe.
 * When the parent asks, it inspects the DOM for each probe and replies with
 * plain facts (counts, text, attributes, classes, computed styles). Pass/fail
 * is decided on the server.
 *
 * Plain JavaScript in a string because it runs inside the student's page,
 * not in our bundle. Also evaluated in unit tests (see content.test.ts).
 */
export const PROBE_SCRIPT = String.raw`
(function () {
  function observe(probe) {
    var nodes;
    try {
      nodes = Array.prototype.slice.call(document.querySelectorAll(probe.selector));
    } catch (e) {
      return { count: 0, error: "invalid selector " + probe.selector };
    }
    var first = nodes[0];
    var obs = { count: nodes.length };
    if (probe.kind === "text") obs.text = first ? (first.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20000) : null;
    if (probe.kind === "attr") obs.attr = first ? first.getAttribute(probe.name) : null;
    if (probe.kind === "hasClass") obs.classes = nodes.slice(0, 50).map(function (n) { return Array.prototype.slice.call(n.classList, 0, 100); });
    if (probe.kind === "style") obs.style = first ? getComputedStyle(first).getPropertyValue(probe.property) : null;
    return obs;
  }
  window.__codesimObserve = function (probes) {
    var out = {};
    probes.forEach(function (p) { out[p.id] = observe(p); });
    return out;
  };
  window.addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || e.data.type !== "codesim:probe") return;
    parent.postMessage({ type: "codesim:observations", nonce: e.data.nonce, probes: window.__codesimObserve(e.data.probes) }, "*");
  });
})();
`;

/** Add the probe script to the student's HTML, after their own content. */
export function injectProbe(html: string): string {
  const tag = `<script>${PROBE_SCRIPT}</script>`;
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i === -1 ? html + tag : html.slice(0, i) + tag + html.slice(i);
}

export type ProbeResults = Record<string, ProbeObservation>;
export type { Probe };
