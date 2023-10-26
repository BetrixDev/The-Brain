import { useAtom } from "jotai";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { selectedItemToCraftAtom } from "@/atoms";
import { trpc } from "@/lib/utils";
import { Input } from "./ui/input";

export function LimitsDialogue() {
  const [selectedItem, setSelectedItem] = useAtom(selectedItemToCraftAtom);

  const { data } = trpc.individualItemData.useQuery({
    itemId: selectedItem?.id!,
    modId: selectedItem?.modId!,
  });

  if (!data) return null;

  return (
    <AlertDialog open={selectedItem !== undefined}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Craft {data.displayName}</AlertDialogTitle>
          <AlertDialogDescription>
            <p></p>
            <Input placeholder="Set a minimum limit" />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSelectedItem(undefined)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction>Craft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
