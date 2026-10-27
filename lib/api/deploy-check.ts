import { missingDeployConfig } from "./config";

/**
 * A live production server missing its gateway address dies here with a readable message instead
 * of starting and failing every request — see `missingDeployConfig`. `next build` never runs the
 * instrumentation hook, so building an image needs no runtime env. `process.exit`, not `throw`:
 * Next logs a thrown instrumentation error and keeps listening, the quiet failure this prevents.
 */
export function refuseToStartWhenMisconfigured(env: NodeJS.ProcessEnv = process.env): void {
  const problem = missingDeployConfig(env);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}
