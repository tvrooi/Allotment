/** Marks an expense the budget can't plan for yet because it has no category. */
export default function NeedsCategoryBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-caution-subtle px-2 py-0.5 text-xs font-medium text-caution">
      Needs category
    </span>
  );
}
