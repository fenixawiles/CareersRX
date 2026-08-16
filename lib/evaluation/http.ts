import "server-only";

import { NextResponse } from "next/server";
import { assertCsrf, CsrfConfigurationError, CsrfError } from "@/lib/http/csrf";
import { CriteriaAuthoringError } from "@/lib/criteria/authoring";
import { EvaluationPersistenceError, type EmployerActor } from "@/lib/evaluation/persistence";
import { requireEvaluationActor } from "@/lib/evaluation/route-auth";

export function evaluationErrorResponse(error: unknown) {
  if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof CsrfConfigurationError) {
    console.error("[careersrx/evaluation] CSRF configuration error", error);
    return NextResponse.json({ error: "Server security configuration is unavailable" }, { status: 503 });
  }
  if (error instanceof EvaluationPersistenceError) {
    const status =
      error.code === "ACCESS_DENIED" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "UNGROUNDED_DECISION" ? 422 : error.code === "INVALID_STATE" || error.code === "NOT_EVALUABLE" ? 409 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof CriteriaAuthoringError) {
    const status = error.code === "ACCESS_DENIED" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "INVALID_STATE" ? 409 : 422;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("[careersrx/evaluation] request failed", error);
  return NextResponse.json({ error: "Unable to process the evaluation request" }, { status: 500 });
}

/**
 * Mandatory entry point for evaluation and decision mutations. It keeps authentication, active
 * organization membership, CSRF validation, and safe error mapping out of individual routes.
 */
export async function withApiHandler<TContext>(
  request: Request,
  context: TContext,
  handler: (input: { actor: EmployerActor; context: TContext }) => Promise<NextResponse> | NextResponse,
) {
  const auth = await requireEvaluationActor();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) await assertCsrf(request);
    return await handler({ actor: auth.actor, context });
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
