import type { Metadata } from "next";
import AddFlow from "./AddFlow";

export const metadata: Metadata = {
  title: "Add a game",
};

export default function AddPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">Add a game</h1>
      <AddFlow />
    </div>
  );
}
