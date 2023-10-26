import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ChatBox() {
  return (
    <div className="flex border p-2 rounded-md flex-col justify-between grow h-full">
      <div></div>
      <form
        className="flex gap-4 w-full"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Input placeholder="Send a chat message..." />
        <Button>Send</Button>
      </form>
    </div>
  );
}
