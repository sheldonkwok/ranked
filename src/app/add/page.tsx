import AddFlow from "./AddFlow";

export default function AddPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">Add a game</h1>
      <AddFlow />
    </div>
  );
}
