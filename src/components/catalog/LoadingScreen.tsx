import { useEffect, useState } from 'react'
import { Database, Loader2 } from 'lucide-react'

const loadingJokes = [
  "Counting all your icebergs... 🧊",
  "Melting through your metadata... ❄️",
  "Swimming through data lakes... 🏊‍♂️",
  "Following the manifest trail... 🗺️",
  "Decoding Parquet hieroglyphics... 📜",
  "Consulting with the table spirits... 👻",
  "Asking nicely for your schemas... 🙏",
  "Herding snapshots like cats... 🐱",
  "Negotiating with your catalog... 🤝",
  "Doing the Iceberg shuffle... 💃",
  "Warming up the cold data... 🔥",
  "Checking if data is still frozen... 🥶",
  "Reading between the partition lines... 📖",
  "Summoning metadata from the depths... 🌊",
  "Playing hide and seek with tables... 🙈",
]

const loadingFacts = [
  "Fun fact: Iceberg tables can time-travel! ⏰",
  "Did you know? Iceberg supports schema evolution without rewriting data!",
  "Pro tip: Iceberg's hidden partitioning means no more partition pruning headaches!",
  "Iceberg stores metadata as JSON. We're basically reading bedtime stories! 📚",
  "Your data is lazier than you - Iceberg only reads what it needs!",
  "Iceberg snapshots are like git commits for your data! 🎯",
  "Apache Iceberg was donated to Apache in 2018 by Netflix!",
  "Iceberg supports ACID transactions on data lakes. Magic! ✨",
]

interface LoadingScreenProps {
  progress: {
    current: number
    total: number
    message: string
  }
}

export function LoadingScreen({ progress }: LoadingScreenProps) {
  const [joke, setJoke] = useState(loadingJokes[0])
  const [fact, setFact] = useState(loadingFacts[0])

  useEffect(() => {
    const jokeInterval = setInterval(() => {
      setJoke(loadingJokes[Math.floor(Math.random() * loadingJokes.length)])
    }, 3000)

    const factInterval = setInterval(() => {
      setFact(loadingFacts[Math.floor(Math.random() * loadingFacts.length)])
    }, 5000)

    return () => {
      clearInterval(jokeInterval)
      clearInterval(factInterval)
    }
  }, [])

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-2xl w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Database className="h-12 w-12 text-primary" />
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-light text-foreground">Exploring Your Catalog</h2>
            <p className="text-muted-foreground">
              This might take a moment depending on catalog size...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progress.message}</span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-2.5 rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${percentage}%`, willChange: 'width' }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {progress.current} of {progress.total} items loaded
            </div>
          </div>

          {/* Fun Message */}
          <div className="border-t pt-6 space-y-4">
            <div className="text-center text-lg text-primary font-light animate-pulse">
              {joke}
            </div>
            <div className="text-center text-sm text-muted-foreground italic">
              {fact}
            </div>
          </div>

          {/* Subtle disclaimer */}
          <div className="text-xs text-center text-muted-foreground pt-4 border-t">
            We're loading all namespaces and tables for a smooth browsing experience.
            <br />
            This only happens once per session.
          </div>
        </div>
      </div>
    </div>
  )
}
