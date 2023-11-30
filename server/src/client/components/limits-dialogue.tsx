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
import { selectedItemAtom } from "@/atoms";
import { trpc } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useEffect, useState } from "react";
import { useToast } from "./ui/use-toast";
import { Button } from "./ui/button";

export function LimitsDialogue() {
  const [selectedItem, setSelectedItem] = useAtom(selectedItemAtom);
  const [minLimit, setMinLimit] = useState<number | undefined>();
  const [maxLimit, setMaxLimit] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const { toast } = useToast();

  const { data } = trpc.individualItemData.useQuery({
    itemId: selectedItem?.id!,
    modId: selectedItem?.modId!,
  });

  const { mutate } = trpc.updateItemLimits.useMutation({
    onError: (e) => {
      toast({
        title: "Error setting limits",
        description: e.message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Successfully set limits",
        description: `Limits set for ${selectedItem?.id} with min: ${
          minLimit ?? "unset"
        } and max: ${maxLimit ?? "unset"}`,
      });
      setSelectedItem(undefined);
    },
  });

  const { mutate: resetLimitMutation } = trpc.resetItemLimit.useMutation({
    onError: (e) => {
      toast({
        title: "Error resetting limits",
        description: e.message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Successfully reset limits",
        description: `Reset the item limits for ${selectedItem?.id}`,
      });
      setSelectedItem(undefined);
    },
  });

  function tryUpdateLimits() {
    mutate({
      fingerprint: data!.fingerprint,
      max: maxLimit,
      min: minLimit,
    });
  }

  function shouldEnableSaveButton() {
    if (errorMessage !== undefined) return false;

    if (maxLimit !== undefined) return true;
    if (minLimit !== undefined) return true;

    return false;
  }

  useEffect(() => {
    if (minLimit === undefined) {
      setErrorMessage(undefined);
      return;
    }
    if (maxLimit === undefined) {
      setErrorMessage(undefined);
      return;
    }
    if (maxLimit !== undefined && minLimit === undefined) {
      setErrorMessage(undefined);
      return;
    }
    if (minLimit !== undefined && maxLimit === undefined) {
      setErrorMessage(undefined);
      return;
    }

    if (maxLimit < minLimit) {
      setErrorMessage("Max limit must not be less than the min limit");
    } else if (maxLimit === minLimit) {
      setErrorMessage("Max limit must not equal the min limit");
    } else {
      setErrorMessage(undefined);
    }
  }, [minLimit, maxLimit]);

  if (!data) return null;

  return (
    <AlertDialog open={selectedItem !== undefined}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Specify custom limits for {data.displayName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <ul className="list-disc flex flex-col gap-2 p-4 pt-1">
              <li>
                Setting a minimum limit will attempt to craft the item
                automatically when the item's amount drop below that number
              </li>
              <li>
                Setting a maximum will automatically dump the item out of the
                storage system until the item amount drop below that threshold
              </li>
            </ul>
            <div className="flex gap-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="min-limit">Minimum Amount</Label>
                <Input
                  id="min-limit"
                  type="number"
                  onChange={(e) => {
                    if (e.currentTarget.value.length === 0) {
                      setMinLimit(undefined);
                    } else {
                      setMinLimit(+e.currentTarget.value);
                    }
                  }}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="min-limit">Maximum Amount</Label>
                <Input
                  id="min-limit"
                  type="number"
                  onChange={(e) => {
                    if (e.currentTarget.value.length === 0) {
                      setMaxLimit(undefined);
                    } else {
                      setMaxLimit(+e.currentTarget.value);
                    }
                  }}
                />
              </div>
            </div>
            {errorMessage !== undefined && (
              <div className="text-red-600">{errorMessage}</div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSelectedItem(undefined)}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={() =>
              resetLimitMutation({
                fingerprint: data.fingerprint!,
              })
            }
            variant="destructive"
          >
            Reset Limits
          </Button>
          <AlertDialogAction
            disabled={!shouldEnableSaveButton()}
            onClick={tryUpdateLimits}
          >
            Save Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
