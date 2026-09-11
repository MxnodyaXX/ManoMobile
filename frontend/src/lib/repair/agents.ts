"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * External repair agents — the outside workshops a device is sent to when it
 * cannot be fixed in-house.
 *
 * Admin maintains the agent list; technicians raise the transfers. Both live
 * here so the two screens share one definition of an agent.
 */

export interface RepairAgent {
  id: number;
  name: string;
  contact: string;
  address: string;
  speciality: string | null;
  active: boolean;
  joinedAt: string;
  remarks: string | null;
}

export type TransferStatus = "Sent" | "Returned" | "Cancelled";

export interface AgentTransfer {
  id: number;
  jobId: string;
  agentId: number;
  agentName: string | null;
  status: TransferStatus;
  reason: string | null;
  expectedReturn: string | null;
  /** What the agent quoted before the device left. Never overwritten. */
  agreedCost: number | null;
  /**
   * What the agent actually charged, taken when the device is received back.
   *
   * Separate from the quote on purpose: "agreed 3,500, charged 5,000" is a
   * fact about that agent worth being able to see, and one that is gone for
   * good if the receipt writes over the quote.
   */
  actualCost: number | null;
  sentAt: string;
  sentBy: string | null;
  returnedAt: string | null;
  returnNotes: string | null;
  receivedBy: string | null;
}

/** What this transfer cost, as best as it is known. */
export const transferCost = (t: AgentTransfer) => t.actualCost ?? t.agreedCost ?? 0;

interface AgentRow {
  id: number; name: string; contact: string; address: string;
  speciality: string | null; active: boolean; joined_at: string; remarks: string | null;
}

const rowToAgent = (r: AgentRow): RepairAgent => ({
  id: r.id,
  name: r.name,
  contact: r.contact ?? "",
  address: r.address ?? "",
  speciality: r.speciality,
  active: r.active,
  joinedAt: r.joined_at,
  remarks: r.remarks,
});

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<RepairAgent[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agents")
    .select("*")
    .order("active", { ascending: false })
    .order("name");

  if (error) throw new Error(`Could not load repair agents: ${error.message}`);
  return (data as AgentRow[]).map(rowToAgent);
}

export async function saveAgent(agent: Partial<RepairAgent> & { name: string }): Promise<RepairAgent> {
  const payload: Record<string, unknown> = {
    name: agent.name,
    contact: agent.contact ?? "",
    address: agent.address ?? "",
    speciality: agent.speciality ?? null,
    active: agent.active ?? true,
    joined_at: agent.joinedAt ?? new Date().toISOString().slice(0, 10),
    remarks: agent.remarks ?? null,
  };
  if (agent.id && agent.id > 0) payload.id = agent.id;

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agents").upsert(payload).select("*").single();

  if (error) throw new Error(`Could not save the agent: ${error.message}`);
  return rowToAgent(data as AgentRow);
}

export async function deleteAgent(id: number): Promise<void> {
  // .select(), because a delete the row-level policy refuses is not an error —
  // it matches nothing and reports success. Asking for the deleted rows back is
  // the only way to tell "removed" from "not allowed to remove".
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agents").delete().eq("id", id).select("id");

  // An agent with transfers against it is protected by the FK — say why.
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This agent has repair transfers recorded against it. Mark them inactive instead of deleting."
        : `Could not delete the agent: ${error.message}`,
    );
  }
  if (!data || data.length === 0) {
    throw new Error("The agent was not removed — your account may not have permission to change the agent registry.");
  }
}

/** Agent list for pickers and the admin screen. */
export function useAgents() {
  const configured = isSupabaseConfigured();
  const [agents, setAgents] = useState<RepairAgent[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setAgents(await fetchAgents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      await reload();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [configured, reload]);

  return { agents, loading, error, reload, configured };
}

// ─── Transfers ───────────────────────────────────────────────────────────────

interface TransferRow {
  id: number; job_id: string; agent_id: number; status: TransferStatus;
  reason: string | null; expected_return: string | null;
  agreed_cost: number | string | null; actual_cost: number | string | null;
  sent_at: string; sent_by: string | null; returned_at: string | null;
  return_notes: string | null; received_by: string | null;
  repair_agents: { name: string } | { name: string }[] | null;
}

const rowToTransfer = (r: TransferRow): AgentTransfer => {
  const a = Array.isArray(r.repair_agents) ? r.repair_agents[0] : r.repair_agents;
  return {
    id: r.id,
    jobId: r.job_id,
    agentId: r.agent_id,
    agentName: a?.name ?? null,
    status: r.status,
    reason: r.reason,
    expectedReturn: r.expected_return,
    agreedCost: r.agreed_cost == null ? null : Number(r.agreed_cost),
    actualCost: r.actual_cost == null ? null : Number(r.actual_cost),
    sentAt: r.sent_at,
    sentBy: r.sent_by,
    returnedAt: r.returned_at,
    returnNotes: r.return_notes,
    receivedBy: r.received_by,
  };
};

const TRANSFER_SELECT = "id, job_id, agent_id, status, reason, expected_return, agreed_cost, actual_cost, sent_at, sent_by, returned_at, return_notes, received_by, repair_agents (name)";

/** Every transfer still out at an agent, newest first. */
export async function fetchOpenTransfers(): Promise<AgentTransfer[]> {
  return fetchTransfers(["Sent"]);
}

/**
 * Transfers by status, newest first.
 *
 * The agents screen wants both halves: what is still out, and what came back —
 * because a device is not finished when it returns, it is finished when the
 * technician closes the job, and the charge has to stay visible until then.
 */
export async function fetchTransfers(statuses: TransferStatus[] = ["Sent", "Returned"]): Promise<AgentTransfer[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .select(TRANSFER_SELECT)
    .in("status", statuses)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`Could not load agent transfers: ${error.message}`);
  return (data as unknown as TransferRow[]).map(rowToTransfer);
}

/**
 * Every outside-workshop trip one job has made, oldest first.
 *
 * For the completion form, which has to show the technician what the shop has
 * already paid on this repair before they decide what to charge for it.
 */
export async function fetchJobTransfers(jobId: string): Promise<AgentTransfer[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .select(TRANSFER_SELECT)
    .eq("job_id", jobId)
    .order("sent_at", { ascending: true });

  if (error) throw new Error(`Could not load agent transfers for ${jobId}: ${error.message}`);
  return (data as unknown as TransferRow[]).map(rowToTransfer);
}

/**
 * Outside-workshop cost per job, from v_job_agent_cost.
 *
 * Read as a map rather than a list: every caller wants "what did this job cost
 * outside", and a screen showing forty rows should not scan a list forty times.
 */
export async function fetchAgentCostsByJob(): Promise<Record<string, number>> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("v_job_agent_cost")
    .select("job_id, agent_cost");

  if (error) throw new Error(`Could not load agent costs: ${error.message}`);

  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { job_id: string; agent_cost: number | string }[]) {
    out[r.job_id] = Number(r.agent_cost) || 0;
  }
  return out;
}

export interface NewTransfer {
  jobId: string;
  agentId: number;
  reason?: string;
  expectedReturn?: string;
  agreedCost?: number;
  sentBy?: string;
}

/**
 * Send a job out to an agent.
 *
 * A partial unique index allows only one open ('Sent') transfer per job, so a
 * device cannot be recorded as being at two workshops at once — a second
 * attempt fails on the constraint rather than quietly duplicating.
 */
export async function transferJobToAgent(t: NewTransfer): Promise<AgentTransfer> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .insert({
      job_id: t.jobId,
      agent_id: t.agentId,
      reason: t.reason ?? null,
      expected_return: t.expectedReturn || null,
      agreed_cost: t.agreedCost ?? null,
      sent_by: t.sentBy ?? null,
    })
    .select(TRANSFER_SELECT)
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `${t.jobId} is already out with an agent. Mark it returned before sending it again.`
        : `Could not transfer ${t.jobId}: ${error.message}`,
    );
  }
  return rowToTransfer(data as unknown as TransferRow);
}

export interface TransferReceipt {
  /** What the agent charged. Left null when nobody knows yet. */
  actualCost?: number | null;
  notes?: string;
  receivedBy?: string;
}

/**
 * Take a device back in from an agent.
 *
 * The charge is asked for here rather than at any later point because here is
 * the only moment somebody is holding the agent's slip. A repair whose outside
 * cost is entered a week later is a repair that was priced without it.
 */
export async function markTransferReturned(transferId: number, receipt: TransferReceipt = {}): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .update({
      status: "Returned",
      returned_at: new Date().toISOString(),
      return_notes: receipt.notes?.trim() || null,
      actual_cost: receipt.actualCost ?? null,
      received_by: receipt.receivedBy ?? null,
    })
    .eq("id", transferId);

  if (error) throw new Error(`Could not mark the transfer returned: ${error.message}`);
}
