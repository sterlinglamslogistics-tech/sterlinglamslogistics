"use client"

import { useState } from "react"
import { Check, Languages } from "lucide-react"
import { cn } from "@/lib/utils"

const options = [
  "English",
  "Yoruba",
  "Hausa",
  "Igbo",
  "French",
]

export default function DriverLanguagePage() {
  const [language, setLanguage] = useState("English")

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <Languages className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Language</h1>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Select your preferred app language.</p>

      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm",
              language === option ? "border-primary bg-primary/5" : "bg-card"
            )}
          >
            <span>{option}</span>
            {language === option && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  )
}
