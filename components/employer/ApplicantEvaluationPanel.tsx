"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { EmployerApplicationEvaluation } from "@/lib/evaluation/employer-read";

function assessmentLabel(value: string | null) {
  if (!value) return "Not evaluated";
  return value.replaceAll("_", " ").toLocaleLowerCase();
}

async function csrfHeaders() {
  const response = await fetch("/api/auth/csrf");
  const token = (await response.json().catch(() => null) as { token?: string } | null)?.token;
  if (!response.ok || !token) throw new Error("Could not establish a secure session.");
  return { "Content-Type": "application/json", "x-csrf-token": token };
}

export function ApplicantEvaluationPanel({ applicationId, evaluation }: { applicationId: string; evaluation: EmployerApplicationEvaluation }) {
  const [decision, setDecision] = useState<"ADVANCE" | "DO_NOT_ADVANCE" | "REQUEST_MORE_INFO">("REQUEST_MORE_INFO");
  const [status, setStatus] = useState("");
  const mandatoryDeficiency = evaluation.findings.find((finding) => finding.disposition === "MANDATORY" && finding.assessment === "NOT_SATISFIED" && finding.findingId);

  async function submitDecision() {
    setStatus("Saving decision…");
    try {
      const headers = await csrfHeaders();
      const body = decision === "DO_NOT_ADVANCE"
        ? {
            evaluationId: evaluation.evaluationId,
            decision,
            reasonCategory: "MANDATORY_CRITERION_NOT_MET",
            findingIds: mandatoryDeficiency?.findingId ? [mandatoryDeficiency.findingId] : [],
          }
        : { evaluationId: evaluation.evaluationId ?? undefined, decision };
      const response = await fetch(`/api/employer/applications/${applicationId}/decisions`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not save the decision.");
      setStatus("Decision saved. Release its explanation when you are ready to share it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the decision.");
    }
  }

  async function releaseExplanation() {
    setStatus("Releasing explanation…");
    try {
      const response = await fetch(`/api/employer/applications/${applicationId}/explanation/release`, {
        method: "POST", headers: await csrfHeaders(),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not release the explanation.");
      setStatus("Explanation released to the applicant.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not release the explanation.");
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border bg-background p-4" aria-label="Evaluation findings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold text-foreground">Criteria findings</h4>
          <p className="text-xs text-muted">Evaluation state: {assessmentLabel(evaluation.evaluationState)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span>Mandatory met: {evaluation.counters.mandatorySatisfied.count}/{evaluation.counters.mandatoryTotal}</span>
          <span>Unresolved: {evaluation.counters.unresolved.count}</span>
          <span>Not evaluated: {evaluation.counters.notEvaluated.count}</span>
        </div>
      </div>
      {evaluation.findings.length ? (
        <ul className="mt-3 space-y-2">
          {evaluation.findings.map((finding) => (
            <li key={finding.criterionId} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-foreground">{finding.label}</span><span className="text-muted">{assessmentLabel(finding.assessment)}</span></div>
              <p className="mt-1 text-muted">{finding.statement}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">This application uses an unstructured criteria set.</p>}
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="text-sm font-medium text-foreground">Decision
          <select className="ml-2 rounded-lg border border-border bg-surface px-2 py-1 text-sm" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
            <option value="REQUEST_MORE_INFO">Request more information</option>
            <option value="ADVANCE">Advance</option>
            <option value="DO_NOT_ADVANCE" disabled={!mandatoryDeficiency}>Do not advance</option>
          </select>
        </label>
        <Button size="sm" onClick={submitDecision} disabled={decision === "DO_NOT_ADVANCE" && !mandatoryDeficiency}>Save decision</Button>
        <Button size="sm" variant="outline" onClick={releaseExplanation}>Release explanation</Button>
      </div>
      <p className="mt-2 min-h-5 text-xs text-muted">{status}</p>
    </section>
  );
}
