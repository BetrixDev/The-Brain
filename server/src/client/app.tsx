import { ChatBox } from "@/components/chat-box";
import { ItemsTable } from "@/components/items-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BoxIcon, BoxesIcon, BrainCircuitIcon } from "lucide-react";
import { formatNumber, trpc } from "./lib/utils";
import { useEffect, useMemo, useState } from "react";
import { socket } from "./socket";
import { LimitsDialogue } from "./components/limits-dialogue";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { ThemeToggle } from "./components/theme-toggle";
import { useAtom } from "jotai";
import { selectedItemAtom, storedItemsSearchQueryAtom } from "./atoms";
import { Label } from "./components/ui/label";

export function App() {
  const [tempSearchQuery, setTempSearchQuery] = useState<string | undefined>();

  const [_, setStoredItemSearchQuery] = useAtom(storedItemsSearchQueryAtom);

  const { data: totalStoredItems } = trpc.totalStoredItems.useQuery();
  const { data: totalUniqueStoredItems } =
    trpc.totalUniqueStoredItems.useQuery();

  const formattedTotalStoredItems = useMemo(() => {
    if (totalStoredItems === undefined || totalStoredItems === null)
      return <span className="text-muted-foreground">Loading...</span>;

    return formatNumber(totalStoredItems);
  }, [totalStoredItems]);

  const formattedTotalUniqueStoredItems = useMemo(() => {
    if (totalUniqueStoredItems === undefined || totalUniqueStoredItems === null)
      return <span className="text-muted-foreground">Loading...</span>;

    return formatNumber(totalUniqueStoredItems);
  }, [totalUniqueStoredItems]);

  const [selectedItem] = useAtom(selectedItemAtom);

  useEffect(() => {
    function onConnect() {
      // setSocketConnected(true);
    }

    function onDisconnect() {
      // setSocketConnected(false);
    }

    // function updateItems() {
    //   refetchStoredItems();
    // }

    function updateTurtleStatus(isConnected: boolean) {
      // setTurtleConnected(isConnected);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    // socket.on("updateItems", updateItems);
    socket.on("updateTurtleStatus", updateTurtleStatus);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      // socket.off("updateItems", updateItems);
      socket.off("updateTurtleStatus", updateTurtleStatus);
    };
  }, []);

  return (
    <div className="min-h-screen font-normal main-grid p-4">
      {selectedItem !== undefined && <LimitsDialogue />}

      <header className="[grid-area:header] border rounded-md items-center p-3 gap-4 flex justify-between">
        <h1 className="text-4xl font-bold flex gap-2">
          <BrainCircuitIcon className="h-10 w-10" /> The Brain
        </h1>
        <div>
          <ThemeToggle />
        </div>
      </header>

      <Card className="[grid-area:global-limits] w-full">
        <CardHeader>
          <CardDescription>
            Setting a global limit will ensure no item amount will ever exceed
            this threshold
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-1.5">
            <Label htmlFor="global-limit">Max Global Limit</Label>
            <Input id="global-limit" type="number" />
          </div>
          <div className="h-16 flex justify-end items-end">
            <Button>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <div className="[grid-area:chat-window]">
        <ChatBox />
      </div>

      <div className="[grid-area:cards] flex items-center gap-4">
        <Card className="w-64 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <BoxesIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formattedTotalStoredItems}
            </div>
          </CardContent>
        </Card>
        <Card className="w-64 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Items</CardTitle>
            <BoxIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formattedTotalUniqueStoredItems}
            </div>
          </CardContent>
        </Card>
      </div>

      <form
        className="[grid-area:search-bar] flex gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setStoredItemSearchQuery(tempSearchQuery);
        }}
      >
        <Input
          placeholder="Search for an item in your storage system..."
          value={tempSearchQuery}
          onChange={(e) => {
            const value = e.currentTarget.value;

            setTempSearchQuery(value);

            if (value.length === 0) {
              setTempSearchQuery(undefined);
              setStoredItemSearchQuery(undefined);
            }
          }}
        />
        <Button>Search</Button>
      </form>

      <div className="[grid-area:data-table]">
        <ItemsTable />
      </div>
    </div>
  );
}
