/**
 * Whether this build ships the on-device pose model.
 *
 * The normal build bundles MediaPipe's model and WASM runtime and sets this
 * true. The single-file Artifact build cannot carry 27MB of assets, so it
 * compiles this to false and the app says plainly that live guidance is off in
 * that preview rather than attempting a load that cannot succeed (§115).
 */
declare const __VISION_AVAILABLE__: boolean | undefined;

export const VISION_AVAILABLE: boolean =
  typeof __VISION_AVAILABLE__ === 'undefined' ? true : __VISION_AVAILABLE__;
