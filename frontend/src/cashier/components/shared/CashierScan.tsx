"use client";

import { useState } from "react";
import JobScanFab from "./JobScanFab";
import QuickSaleModal from "@/cashier/components/sales/QuickSaleModal";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { matchScannedAccessory } from "@/lib/inventory/accessoryScan";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * The cashier shell's scan button: JobScanFab for jobs, plus accessories and
 * Quick Sale. Separate from JobScanFab because that one is also mounted in the
 * technician shell, which has no AccessoriesProvider and nothing to sell —
 * useAccessories() there would throw.
 */
export default function CashierScan({ onOpenJob, onIssueJob }: {
  onOpenJob?: (job: RepairJob) => void;
  onIssueJob?: (job: RepairJob) => void;
}) {
  const { products } = useAccessories();
  const [quickSale, setQuickSale] = useState<AccessoryProduct | null>(null);

  return (
    <>
      <JobScanFab
        onOpenJob={onOpenJob}
        onIssueJob={onIssueJob}
        findProducts={code => matchScannedAccessory(products, code)}
        onQuickSale={setQuickSale}
        // While Quick Sale is open, a scan adds to its bill instead of
        // popping the job panel over it.
        paused={quickSale !== null}
      />
      {quickSale && <QuickSaleModal initial={[quickSale]} onClose={() => setQuickSale(null)} />}
    </>
  );
}
