"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PipelineRow } from "@/hooks/use-budget-pipeline";

interface Props {
  transactions: PipelineRow[];
}

export function TransactionsTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Transactions will appear here once extraction finishes.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Account</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx, index) => (
            <TableRow key={index}>
              <TableCell>{tx.date}</TableCell>
              <TableCell className="max-w-64 truncate">{tx.description}</TableCell>
              <TableCell className={tx.amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                {tx.amount.toFixed(2)}
              </TableCell>
              <TableCell>
                {tx.category === null ? <Skeleton className="h-5 w-20" /> : <Badge variant="secondary">{tx.category}</Badge>}
              </TableCell>
              <TableCell>{tx.account ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
