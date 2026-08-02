import type { Metadata } from "next";
import AddFlow from "./AddFlow";

export const metadata: Metadata = {
  title: "Add a game",
};

export default function AddPage() {
  return (
    <div className="mx-auto flex max-w-[660px] flex-col gap-5">
      <h1 className="pixel-heading text-[18px]">ADD A GAME</h1>
      <AddFlow />
    </div>
  );
}
