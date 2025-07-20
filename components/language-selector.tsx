"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslationStore } from "@/lib/store"

const languages = [
  { id: "en", name: "English" },
  { id: "hi", name: "Hindi" },
  { id: "kn", name: "Kannada" },
]

export default function LanguageSelector() {
  const { sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage } = useTranslationStore()

  const handleSourceChange = (value: string) => {
    setSourceLanguage(value)
    // If target is same as new source, swap them
    if (value === targetLanguage) {
      setTargetLanguage(sourceLanguage)
    }
  }

  const handleTargetChange = (value: string) => {
    setTargetLanguage(value)
    // If source is same as new target, swap them
    if (value === sourceLanguage) {
      setSourceLanguage(targetLanguage)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
      <div className="w-full sm:w-auto">
        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Source Language</label>
        <Select value={sourceLanguage} onValueChange={handleSourceChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden sm:flex items-center justify-center h-10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400"
        >
          <path d="M8 3 4 7l4 4" />
          <path d="M4 7h16" />
          <path d="m16 21 4-4-4-4" />
          <path d="M20 17H4" />
        </svg>
      </div>

      <div className="w-full sm:w-auto">
        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Target Language</label>
        <Select value={targetLanguage} onValueChange={handleTargetChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
