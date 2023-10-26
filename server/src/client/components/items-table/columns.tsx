import type { AppRouter } from "$/trpc";
import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "../ui/button";
import { useAtom } from "jotai";
import {
  selectedItemAtom,
  sortingDirectionAtom,
  sortingVariableAtom,
} from "@/atoms";
import {
  abbreviateNumber,
  formatNumber,
  getRelativeTimeString,
  trpc,
} from "@/lib/utils";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpDownIcon,
  ArrowUpWideNarrowIcon,
} from "lucide-react";

export type ItemColumn =
  inferRouterOutputs<AppRouter>["storedItems"]["data"][number];

export const columns: ColumnDef<ItemColumn>[] = [
  {
    accessorKey: "displayName",
    header: "Item Name",
    cell: ({ row }) => {
      return (
        <div>
          <p>{row.getValue("displayName")}</p>
          <p className="text-muted-foreground font-semibold">
            {row.original.itemId}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "mod",
    header: () => <div className="text-center">Mod</div>,
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground text-center">
          {row.original.mod.displayName}
        </div>
      );
    },
  },
  {
    accessorKey: "limits.min",
    header: () => <div className="text-center">Min</div>,
    cell: ({ row }) => {
      return (
        <div className="text-center">
          {formatNumber(row.original.limits?.min) ?? "Not Set"}
        </div>
      );
    },
  },
  {
    accessorKey: "limits.max",
    header: () => <div className="text-center">Max</div>,
    cell: ({ row }) => {
      return (
        <div className="text-center">
          {formatNumber(row.original.limits?.max) ?? "Not Set"}
        </div>
      );
    },
  },
  {
    accessorKey: "fingerprint",
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => {
      const { data } = trpc.individualItemData.useQuery({
        itemId: row.original.itemId,
        modId: row.original.mod.id,
      });

      if (!data) return <div>Loading...</div>;

      return (
        <div className="flex gap-4 items-center justify-center">
          <LimitsButton
            modId={row.original.mod.id}
            id={row.original.itemId}
            fingerprint={row.original.fingerprint}
          />
          <Button disabled={!data.isCraftable}>
            {data.isCraftable ? "Craft" : "Can't Craft"}
          </Button>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center">Status</div>,
    cell: ({ row }) => {
      const amount = row.original.amount;
      const maxLimit = row.original?.limits?.max;
      const minLimit = row.original?.limits?.min;

      if (amount < (minLimit ?? 0)) {
        return <div className="text-center text-red-500">Under Limit</div>;
      } else if (amount > (maxLimit ?? Infinity)) {
        return <div className="text-center text-red-500">Over Limit</div>;
      } else {
        return <div className="text-center text-sky-500">Idle</div>;
      }
    },
  },
  {
    accessorKey: "lastModified",
    header: () => {
      const [sortingDirection, setSortingDirection] =
        useAtom(sortingDirectionAtom);
      const [sortingVariable, setSortingVariable] =
        useAtom(sortingVariableAtom);

      function handleClick() {
        if (sortingVariable !== "lastModified") {
          setSortingVariable("lastModified");
          setSortingDirection("desc");
        } else if (sortingDirection === "asc") {
          setSortingDirection("desc");
        } else {
          setSortingDirection("asc");
        }
      }

      const icon =
        sortingVariable === "lastModified" ? (
          sortingDirection === "desc" ? (
            <ArrowDownWideNarrowIcon className="w-6 h-6" />
          ) : (
            <ArrowUpWideNarrowIcon className="w-6 h-6" />
          )
        ) : (
          <ArrowUpDownIcon className="w-6 h-6" />
        );

      return (
        <div className="flex justify-center">
          <Button
            onClick={handleClick}
            size="sm"
            variant="ghost"
            className="flex gap-2 justify-center items-center"
          >
            {icon}
            Last Modified
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-center">
          {getRelativeTimeString(row.original.lastModified)}
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => {
      const [sortingDirection, setSortingDirection] =
        useAtom(sortingDirectionAtom);
      const [sortingVariable, setSortingVariable] =
        useAtom(sortingVariableAtom);

      function handleClick() {
        if (sortingVariable !== "amount") {
          setSortingVariable("amount");
          setSortingDirection("desc");
        } else if (sortingDirection === "asc") {
          setSortingDirection("desc");
        } else {
          setSortingDirection("asc");
        }
      }

      const icon =
        sortingVariable === "amount" ? (
          sortingDirection === "desc" ? (
            <ArrowDownWideNarrowIcon className="w-6 h-6" />
          ) : (
            <ArrowUpWideNarrowIcon className="w-6 h-6" />
          )
        ) : (
          <ArrowUpDownIcon className="w-6 h-6" />
        );

      return (
        <div className="flex justify-center">
          <Button
            onClick={handleClick}
            size="sm"
            variant="ghost"
            className="flex gap-2 justify-center items-center"
          >
            {icon}
            Amount
          </Button>
        </div>
      );
    },
    cell: ({ row }) => (
      <div className="text-center">{abbreviateNumber(row.original.amount)}</div>
    ),
  },
];

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
