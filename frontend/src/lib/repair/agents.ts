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
  agreedCost: number | null;
  sentAt: string;
  sentBy: string | null;
  returnedAt: string | null;
  returnNotes: string | null;
}

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
  const { error } = await getSupabaseBrowserClient().from("repair_agents").delete().eq("id", id);
  // An agent with transfers against it is protected by the FK — say why.
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This agent has repair transfers recorded against it. Mark them inactive instead of deleting."
        : `Could not delete the agent: ${error.message}`,
    );
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
  reason: string | null; expected_return: string | null; agreed_cost: number | string | null;
  sent_at: string; sent_by: string | null; returned_at: string | null; return_notes: string | null;
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
    sentAt: r.sent_at,
    sentBy: r.sent_by,
    returnedAt: r.returned_at,
    returnNotes: r.return_notes,
  };
};

const TRANSFER_SELECT = "id, job_id, agent_id, status, reason, expected_return, agreed_cost, sent_at, sent_by, returned_at, return_notes, repair_agents (name)";

/** Every transfer still out at an agent, newest first. */
export async function fetchOpenTransfers(): Promise<AgentTransfer[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .select(TRANSFER_SELECT)
    .eq("status", "Sent")
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`Could not load agent transfers: ${error.message}`);
  return (data as unknown as TransferRow[]).map(rowToTransfer);
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

export async function markTransferReturned(transferId: number, notes?: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_agent_transfers")
    .update({ status: "Returned", returned_at: new Date().toISOString(), return_notes: notes ?? null })
    .eq("id", transferId);

  if (error) throw new Error(`Could not mark the transfer returned: ${error.message}`);
}
