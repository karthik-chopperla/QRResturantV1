"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTables, createTable, deleteTable, updateTableStatus, regenerateTableQrCode } from "@/actions/tables";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableStatus } from "@prisma/client";
import { toast } from "sonner";
import { Plus, Trash2, Download, QrCode } from "lucide-react";
import Image from "next/image";

export default function TablesPage() {
  const queryClient = useQueryClient();
  const [tableNumber, setTableNumber] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: () => getTables(), refetchInterval: 10000 });

  const handleCreate = async () => {
    const result = await createTable({ number: tableNumber });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Table created with QR code");
      setTableNumber("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    const result = await deleteTable(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Table deleted");
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    }
  };

  const handleStatusChange = async (id: string, status: TableStatus) => {
    await updateTableStatus(id, status);
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  };

  const handleRegenerateQR = async (id: string) => {
    const result = await regenerateTableQrCode(id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("QR code updated. Download and replace any previously printed code.");
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  };

  const downloadQR = (qrUrl: string | null, number: string) => {
    if (!qrUrl?.startsWith("data:")) {
      toast.error("QR code not available");
      return;
    }
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `table-${number}-qr.png`;
    link.click();
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-800",
    OCCUPIED: "bg-red-100 text-red-800",
    RESERVED: "bg-amber-100 text-amber-800",
  };

  return (
    <div>
      <StaffHeader title="Tables" subtitle="Manage tables and QR codes" />
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 size-4" />Add Table</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Table</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input placeholder="e.g. 9" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
              </div>
              <Button onClick={handleCreate} disabled={!tableNumber}>Create & Generate QR</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <Card key={table.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Table {table.number}</h3>
                  <Badge className={statusColors[table.status]} variant="secondary">{table.status}</Badge>
                </div>
                {table.qrCodeUrl?.startsWith("data:") ? (
                  <div className="relative mx-auto my-4 size-32">
                    <Image src={table.qrCodeUrl} alt={`QR Table ${table.number}`} fill className="object-contain" />
                  </div>
                ) : (
                  <div className="my-4 flex h-32 items-center justify-center rounded-lg bg-muted">
                    <QrCode className="size-12 text-muted-foreground" />
                  </div>
                )}
                <Select value={table.status} onValueChange={(v) => v && handleStatusChange(table.id, v as TableStatus)}>
                  <SelectTrigger className="mb-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TableStatus).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadQR(table.qrCodeUrl, table.number)}>
                    <Download className="mr-1 size-3" />QR
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleRegenerateQR(table.id)}>
                    <QrCode className="mr-1 size-3" />Regenerate
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(table.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
