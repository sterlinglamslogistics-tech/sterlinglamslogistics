"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const options = [
  "English",
  "Yoruba",
  "Hausa",
  "Igbo",
  "French",
]

export default function DriverLanguagePage() {
  const router = useRouter()
  const [language, setLanguage] = useState("English")

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Language</h1>
      </div>

      <div className="space-y-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-colors",
              language === option ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span>{option}</span>
            {language === option && <Check className="h-5 w-5 text-green-600" />}
          </button>
        ))}
      </div>
    </div>
  )
}
