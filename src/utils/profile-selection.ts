export type ProfileSelectedEntry = NonNullable<IProfileItem['selected']>[number]

export function renameProfileSelectedPolicyReferences(
  selected: IProfileItem['selected'],
  oldName: string,
  newName: string,
  options: { renameGroupName?: boolean } = {},
) {
  if (!selected?.length || oldName === newName) {
    return { selected, changed: false }
  }

  let changed = false
  const nextSelected = selected.map((entry) => {
    const nextEntry: ProfileSelectedEntry = { ...entry }

    if (options.renameGroupName && nextEntry.name === oldName) {
      nextEntry.name = newName
      changed = true
    }

    if (nextEntry.now === oldName) {
      nextEntry.now = newName
      changed = true
    }

    return nextEntry
  })

  return {
    selected: changed ? nextSelected : selected,
    changed,
  }
}
