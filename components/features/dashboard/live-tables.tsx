"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table } from "@prisma/client";

interface LiveTablesProps {
  tables: Table[];
  orders: any[];
}

export function LiveTables({ tables, orders }: LiveTablesProps) {
  // If no tables are configured, use 8 mock tables all AVAILABLE
  const displayTables = tables.length > 0 
    ? tables 
    : [
        { id: "mock-1", number: "1", status: "AVAILABLE" },
        { id: "mock-2", number: "2", status: "AVAILABLE" },
        { id: "mock-3", number: "3", status: "AVAILABLE" },
        { id: "mock-4", number: "4", status: "AVAILABLE" },
        { id: "mock-5", number: "5", status: "AVAILABLE" },
        { id: "mock-6", number: "6", status: "AVAILABLE" },
        { id: "mock-7", number: "7", status: "AVAILABLE" },
        { id: "mock-8", number: "8", status: "AVAILABLE" },
      ];

  const getTableStatus = (tableId: string, status: string, number: string) => {
    if (tableId.startsWith("mock-")) {
      return { label: "Available", color: "bg-emerald-500 text-emerald-500" };
    }

    // Real table logic: check active orders for this table
    const activeOrders = orders.filter(
      (order) => order.tableId === tableId && order.status !== "COMPLETED" && order.status !== "CANCELLED"
    );

    if (status === "OCCUPIED") {
      if (activeOrders.length > 0) {
        const orderStatuses = activeOrders.map((o) => o.status);
        if (orderStatuses.some((s) => s === "PLACED" || s === "CONFIRMED")) {
          return { label: "Waiting", color: "bg-amber-500 text-amber-500" };
        }
        if (orderStatuses.some((s) => s === "PREPARING" || s === "PREPARED" || s === "READY")) {
          return { label: "Preparing", color: "bg-orange-500 text-orange-500" };
        }
      }
      return { label: "Occupied", color: "bg-rose-500 text-rose-500" };
    }

    if (status === "RESERVED") {
      return { label: "Reserved", color: "bg-slate-400 text-slate-400" };
    }

    return { label: "Available", color: "bg-emerald-500 text-emerald-500" };
  };

  return (
    <Card className="border-border/60 h-full flex flex-col justify-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">Live Tables</CardTitle>
        <p className="text-sm text-slate-400 font-normal">Current layout statuses</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pb-6">
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayTables.map((table) => {
              const { label, color } = getTableStatus(table.id, table.status, table.number);
              return (
                <div 
                  key={table.id} 
                  className="flex flex-col items-center justify-center p-2.5 border border-slate-100 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-sm font-bold text-slate-800 tracking-tight">T{table.number}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`size-1.5 rounded-full ${color.split(" ")[0]}`} />
                    <span className="text-[10px] font-medium text-slate-500 tracking-wide sm:text-[10px]">{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
