import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import { useAtom } from "jotai";
import {
  selectedItemAtom,
  sortingDirectionAtom,
  sortingVariableAtom,
  storedItemsSearchQueryAtom,
} from "@/atoms";
import { columns } from "./columns";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/utils";
import { useVirtual } from "@tanstack/react-virtual";

export function ItemsTable() {
  const [searchQuery] = useAtom(storedItemsSearchQueryAtom);
  const [sortingDirection] = useAtom(sortingDirectionAtom);
  const [sortingVariable] = useAtom(sortingVariableAtom);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: paginatedStoredItemsData,
    isFetching,
    isLoading,
    fetchNextPage,
  } = trpc.storedItems.useInfiniteQuery(
    {
      searchQuery: searchQuery,
      sortingDirection,
      sortingVariable,
    },
    {
      queryKey: ["storedItems", sortingVariable],
      getNextPageParam: (_, groups) => groups.length,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const storedItemsData = useMemo(
    () => paginatedStoredItemsData?.pages?.flatMap((page) => page.data) ?? [],
    [paginatedStoredItemsData]
  );

  const totalDBRowCount =
    paginatedStoredItemsData?.pages?.[0]?.meta?.totalRowCount ?? 0;
  const totalFetched = storedItemsData.length;

  const fetchMoreOnButtomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isFetching &&
          totalFetched < totalDBRowCount
        ) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, , totalFetched, totalDBRowCount]
  );

  useEffect(() => {
    fetchMoreOnButtomReached(tableContainerRef.current);
  }, [fetchMoreOnButtomReached]);

  const table = useReactTable({
    data: storedItemsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtual({
    parentRef: tableContainerRef,
    size: rows.length,
    overscan: 10,
  });

  const { virtualItems: virtualRows, totalSize } = rowVirtualizer;
  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div
      className="rounded-md max-h-[calc(100vh-19.5rem)] border overflow-auto relative"
      onScroll={(e) => fetchMoreOnButtomReached(e.target as HTMLDivElement)}
      ref={tableContainerRef}
    >
      <Table className="relative">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];

            return (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type LimitsButtonProps = {
  fingerprint: string;
  id: string;
  modId: string;
};

function LimitsButton(props: LimitsButtonProps) {
  const [, setValue] = useAtom(selectedItemAtom);

  return (
    <Button variant="default" onClick={() => setValue(props)}>
      Set Limits
    </Button>
  );
}
