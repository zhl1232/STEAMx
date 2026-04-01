export interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

export interface SpeciesEntryFormState {
  speciesId: string
  count: string
  behaviorTags: string
  notes: string
}

export const emptySpeciesEntry = (): SpeciesEntryFormState => ({
  speciesId: "",
  count: "",
  behaviorTags: "",
  notes: "",
})
