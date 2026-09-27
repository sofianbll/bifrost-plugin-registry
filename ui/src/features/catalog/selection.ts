export function setVisibleSelection(selected: string[], visible: string[], checked: boolean): string[] {
  const visibleIds = new Set(visible);
  return checked ? [...new Set([...selected, ...visibleIds])] : selected.filter(id => !visibleIds.has(id));
}

export function selectionCounts(selected: string[], visible: string[]) {
  const selectedIds = new Set(selected);
  const visibleIds = new Set(visible);
  const visibleSelected = [...visibleIds].filter(id => selectedIds.has(id)).length;
  return { visibleSelected, visibleTotal: visibleIds.size, hiddenSelected: [...selectedIds].filter(id => !visibleIds.has(id)).length, totalSelected: selectedIds.size };
}
