"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableSkeleton } from "./loading-skeleton"
import { EmptyState } from "./empty-state"
import { TableProperties } from "lucide-react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  toolbar?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  pageSize?: number
  enableRowSelection?: boolean
  onRowSelectionChange?: (rows: TData[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  toolbar,
  emptyTitle = "No results",
  emptyDescription = "No data to display.",
  emptyAction,
  pageSize = 20,
  enableRowSelection = false,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const selectionColumn: ColumnDef<TData, TValue> = {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  }

  const finalColumns = enableRowSelection
    ? [selectionColumn, ...columns]
    : columns

  const table = useReactTable({
    data,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater
      setRowSelection(next)
      if (onRowSelectionChange) {
        const selectedRows = Object.keys(next)
          .filter((key) => next[key])
          .map((key) => data[parseInt(key)])
          .filter(Boolean)
        onRowSelectionChange(selectedRows)
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize },
    },
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {toolbar && <div className="opacity-50 pointer-events-none">{toolbar}</div>}
        <TableSkeleton rows={6} cols={finalColumns.length} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {toolbar && <div>{toolbar}</div>}

      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-zinc-200 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-medium text-zinc-500 bg-zinc-50 h-9 px-3"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-zinc-100 hover:bg-zinc-50/50 data-[state=selected]:bg-zinc-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 text-sm text-zinc-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={finalColumns.length} className="h-48 text-center p-0">
                  <EmptyState
                    icon={<TableProperties className="w-8 h-8" />}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-zinc-500">
          {enableRowSelection && (
            <span className="mr-3">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} selected ·{" "}
            </span>
          )}
          {table.getFilteredRowModel().rows.length} row
          {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
