import TranslationCard from "@/components/translation-card"
import ConversationUI from "@/components/conversation-ui"
import ConferenceUI from "@/components/conference-ui"
import LanguageSelector from "@/components/language-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="container mx-auto py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            VaaniVerse
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Real-Time Multilingual Translator</p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <LanguageSelector />

          <Tabs defaultValue="translate" className="mt-8">
            <div className="max-w-md mx-auto mb-8">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="translate">
                  <span className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 8 6 6" />
                      <path d="m4 14 6-6 2-3" />
                      <path d="M2 5h12" />
                      <path d="M7 2h1" />
                      <path d="m22 22-5-10-5 10" />
                      <path d="M14 18h6" />
                    </svg>
                    Single
                  </span>
                </TabsTrigger>
                <TabsTrigger value="conversation">
                  <span className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M8 9h8" />
                      <path d="M8 13h6" />
                    </svg>
                    Conversation
                  </span>
                </TabsTrigger>
                <TabsTrigger value="conference">
                  <span className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <path d="M3 10h18" />
                      <path d="M12 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      <path d="M17 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      <path d="M7 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      <rect width="18" height="16" x="3" y="6" rx="2" />
                    </svg>
                    Conference
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="translate" className="focus-visible:outline-none focus-visible:ring-0">
              <TranslationCard />
            </TabsContent>

            <TabsContent value="conversation" className="focus-visible:outline-none focus-visible:ring-0">
              <div className="h-[600px]">
                <ConversationUI />
              </div>
            </TabsContent>

            <TabsContent value="conference" className="focus-visible:outline-none focus-visible:ring-0">
              <div className="h-[600px]">
                <ConferenceUI />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="container mx-auto py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>VaaniVerse &copy; {new Date().getFullYear()} - Powered by Whisper, IndicTrans2 & Coqui TTS</p>
      </footer>

      <Toaster />
    </div>
  )
}
