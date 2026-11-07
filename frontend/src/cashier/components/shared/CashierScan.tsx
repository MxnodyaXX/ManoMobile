"use client";

import { useState } from "react";
import JobScanFab from "./JobScanFab";
import BarcodeLabelModal from "./BarcodeLabelModal";
import QuickSaleModal from "@/cashier/components/sales/QuickSaleModal";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useParts, type SparePart } from "@/cashier/contexts/PartsContext";
import { accessoryBarcodeOptions, matchScannedAccessory, matchScannedPart, partBarcodeOptions, pickBarcode } from "@/lib/inventory/accessoryScan";
import { partLabelTokens } from "@/lib/repair/partLabel";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

type LabelTarget = ({ product: AccessoryProduct } | { part: SparePart }) & { scanned: string };

/**
 * The cashier shell's scan button: JobScanFab for jobs, plus accessories, repair
 * parts, Quick Sale and label reprints. Separate from JobScanFab because that one
 * is also mounted in the technician shell, which has no AccessoriesProvider and
 * nothing to sell — useAccessories() there would throw.
 */
export default function CashierScan({ onOpenJob, onIssueJob }: {
  onOpenJob?: (job: RepairJob) => void;
  onIssueJob?: (job: RepairJob) => void;
}) {
  const { products } = useAccessories();
  const { parts } = useParts();
  const [quickSale, setQuickSale] = useState<AccessoryProduct | null>(null);
  const [label, setLabel] = useState<LabelTarget | null>(null);

  return (
    <>
      <JobScanFab
        onOpenJob={onOpenJob}
        onIssueJob={onIssueJob}
        findProducts={code => matchScannedAccessory(products, code)}
        findParts={code => matchScannedPart(parts, code)}
        onPrintLabel={(item, scanned) => setLabel({ ...item, scanned })}
        onQuickSale={setQuickSale}
        // While Quick Sale or a label is open, a scan belongs to that, not to
        // the job panel popping up over it.
        paused={quickSale !== null || label !== null}
      />
      {quickSale && <QuickSaleModal initial={[quickSale]} onClose={() => setQuickSale(null)} />}
      {label && "product" in label && (
        <BarcodeLabelModal
          variant="accessory"
          code={pickBarcode(accessoryBarcodeOptions(label.product), label.scanned)}
          barcodeOptions={accessoryBarcodeOptions(label.product)}
          title={label.product.name}
          subtitle={`${label.product.brand} · ${label.product.model}`}
          price={`Rs. ${label.product.sellingPrice.toLocaleString()}`}
          accessory={{ itemCode: label.product.code, brand: label.product.brand, model: label.product.model, category: label.product.category }}
          onClose={() => setLabel(null)}
        />
      )}
      {label && "part" in label && (
        <BarcodeLabelModal
          variant="part"
          code={pickBarcode(partBarcodeOptions(label.part), label.scanned)}
          barcodeOptions={partBarcodeOptions(label.part)}
          displayCode={label.part.sku}
          title={label.part.name}
          subtitle={label.part.category}
          part={partLabelTokens(label.part)}
          onClose={() => setLabel(null)}
        />
      )}
    </>
  );
}
