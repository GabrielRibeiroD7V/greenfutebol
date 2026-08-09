export interface IdentifiedSelection {
  selection_id: string;
}

export function toggleSelection<T extends IdentifiedSelection>(
  selections: T[],
  candidate: T,
  limit = 20,
): T[] {
  if (selections.some((selection) => selection.selection_id === candidate.selection_id)) {
    return selections.filter((selection) => selection.selection_id !== candidate.selection_id);
  }

  return selections.length >= limit ? selections : [...selections, candidate];
}
