/**
 * Runs once when the server starts. The check lives in its own module behind the runtime test,
 * the pattern Next documents: `process.exit` has no edge-runtime equivalent, and importing it
 * here directly makes Turbopack bundle it for edge and warn on every build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { refuseToStartWhenMisconfigured } = await import("./lib/api/deploy-check");
    refuseToStartWhenMisconfigured();
  }
}
