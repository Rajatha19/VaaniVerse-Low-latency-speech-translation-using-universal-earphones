import { create } from "zustand"

interface TranslationState {
  sourceLanguage: string
  targetLanguage: string
  setSourceLanguage: (language: string) => void
  setTargetLanguage: (language: string) => void
}

export const useTranslationStore = create<TranslationState>((set) => ({
  sourceLanguage: "en",
  targetLanguage: "hi",
  setSourceLanguage: (language) => set({ sourceLanguage: language }),
  setTargetLanguage: (language) => set({ targetLanguage: language }),
}))
