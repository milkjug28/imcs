'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import ConnectWallet from '@/components/ConnectWallet'

type Task = {
  id: string
  name: string
  description: string
  points: string
  route: string
  icon: string
  completed: boolean
  completedScore?: number
  completionCount?: number
  maxAttempts?: number
}

const MAX_ATTEMPTS = 5

const TASKS: Task[] = [
  {
    id: 'circle',
    name: 'cirkul drawing',
    description: 'drahw a perfekt cirkul (5x max 4 points)',
    points: '100-300',
    route: '/site/games/circle',
    icon: '⭕',
    completed: false,
    maxAttempts: MAX_ATTEMPTS,
  },
  {
    id: 'typing',
    name: 'tyepp test',
    description: 'tyepp da savaantt copipastah fast (5x max 4 points)',
    points: '100-200',
    route: '/site/games/typing',
    icon: '⌨️',
    completed: false,
    maxAttempts: MAX_ATTEMPTS,
  },
  {
    id: 'bubble',
    name: 'bubble pahp',
    description: 'pahp bubbles en 30 sec (5x max 4 points)',
    points: '1-500+',
    route: '/site/games/bubble-pop',
    icon: '🫧',
    completed: false,
    maxAttempts: MAX_ATTEMPTS,
  },
  {
    id: 'paint',
    name: 'paint savaantt',
    description: 'drahw ur own savaantt mastuhpeece (1x pts ownlee)',
    points: '200',
    route: '/site/games/draw-savant',
    icon: '🎨',
    completed: false,
  },
  {
    id: 'submit',
    name: 'submit info',
    description: 'tel us bout urself',
    points: '150',
    route: '/site/submit',
    icon: '📝',
    completed: false,
  },
  {
    id: 'vote',
    name: 'voht x10',
    description: 'voht en 10 submishuns (repeatable 4 evr!)',
    points: '100 per 10 vohts',
    route: '/site/vote',
    icon: '👍',
    completed: false,
  },
]

export default function TasksPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const [tasks, setTasks] = useState<Task[]>(TASKS)
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchAllData()
    } else {
      setLoading(false)
    }
  }, [isConnected, address])

  // Refetch when page gains focus (user navigates back from a game)
  useEffect(() => {
    const handleFocus = () => {
      if (isConnected && address) {
        fetchAllData()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isConnected, address])

  const fetchAllData = async () => {
    if (!address) return

    try {
      // Fetch both profile and tasks in parallel with no caching
      const [profileRes, tasksRes] = await Promise.all([
        fetch(`/api/profile/${address}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch(`/api/tasks/${address}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ])

      // Process profile data - use API's pre-calculated total_points
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setTotalPoints(profileData.total_points || 0)
      }

      // Process tasks data for completion status display
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasksList = tasksData.tasks || []

        // Update task completion status with score and completion count
        const completedMap = new Map<string, { score: number; count: number }>(
          tasksList.map((t: any) => [t.task_type, { score: t.score, count: t.completion_count || 1 }])
        )

        setTasks(prevTasks => prevTasks.map(task => {
          const taskData = completedMap.get(task.id)
          return {
            ...task,
            completed: completedMap.has(task.id),
            completedScore: taskData?.score,
            completionCount: taskData?.count,
          }
        }))
      }
    } catch (e) {
      console.error('Failed to fetch data:', e)
    }
    setLoading(false)
  }

  const handleTaskClick = (route: string) => {
    router.push(route)
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">savant tasks</h2>
          <p style={{ fontSize: '24px', marginBottom: '30px' }}>
            connect ur wallut 2 start earnin points
          </p>
          <ConnectWallet label="connect wallut" />
        </div>
      </div>
    )
  }

  return (
    <div className="page active" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px',
      }}>
        <h1 style={{
          fontSize: 'clamp(28px, 8vw, 48px)',
          color: '#000',
          textShadow: '3px 3px 0 #ff00ff',
          marginBottom: '10px',
        }}>
          savant tasks
        </h1>

        {/* Total points display */}
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #00ff00, #00bfff)',
          padding: '15px 40px',
          border: '4px solid #000',
          boxShadow: '5px 5px 0 #000',
          transform: 'rotate(-1deg)',
        }}>
          <span style={{
            fontSize: 'clamp(32px, 10vw, 56px)',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '3px 3px 0 #000',
          }}>
            {totalPoints}
          </span>
          <p style={{ fontSize: '18px', marginTop: '5px' }}>total points</p>
        </div>
      </div>

      {/* Tasks grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        {tasks.map((task, index) => (
          <div
            key={task.id}
            onClick={() => handleTaskClick(task.route)}
            style={{
              background: task.completed
                ? 'linear-gradient(135deg, #00ff00, #00bfff)'
                : 'linear-gradient(135deg, #ff6b9d, #ffd700)',
              border: '4px solid #000',
              padding: '20px',
              boxShadow: '5px 5px 0 #000',
              cursor: 'pointer',
              transform: `rotate(${index % 2 === 0 ? '-1' : '1'}deg)`,
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = `rotate(${index % 2 === 0 ? '1' : '-1'}deg) scale(1.02)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = `rotate(${index % 2 === 0 ? '-1' : '1'}deg)`
            }}
          >
            {/* Completed badge */}
            {task.completed && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#fff',
                border: '3px solid #000',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}>
                ✅
              </div>
            )}

            {/* Task icon */}
            <div style={{
              fontSize: '48px',
              marginBottom: '10px',
            }}>
              {task.icon}
            </div>

            {/* Task name */}
            <h3 style={{
              fontSize: '24px',
              color: '#fff',
              textShadow: '2px 2px 0 #000',
              marginBottom: '8px',
            }}>
              {task.name}
            </h3>

            {/* Task description */}
            <p style={{
              fontSize: '16px',
              color: '#000',
              marginBottom: '15px',
            }}>
              {task.description}
            </p>

            {/* Points */}
            <div style={{
              background: '#fff',
              display: 'inline-block',
              padding: '8px 16px',
              border: '3px solid #000',
              fontSize: '18px',
              fontWeight: 'bold',
            }}>
              {task.completed && task.completedScore !== undefined ? (
                <span style={{ color: '#00aa00' }}>+{task.completedScore} pts earned!</span>
              ) : (
                <span>{task.points} pts</span>
              )}
            </div>

            {/* Attempts info for limited tasks */}
            {task.maxAttempts && task.completed && (
              <div style={{
                marginTop: '8px',
                fontSize: '14px',
                color: (task.completionCount || 0) >= task.maxAttempts ? '#cc0000' : '#006600',
              }}>
                {(task.completionCount || 0) >= task.maxAttempts
                  ? 'max attempts reached'
                  : `${task.maxAttempts - (task.completionCount || 0)} attempts left`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info text */}
      <p style={{
        textAlign: 'center',
        marginTop: '30px',
        fontSize: '18px',
        color: '#fff',
        textShadow: '2px 2px 0 #000',
      }}>
        complete tasks 2 earn points n climb da leaderboard!
      </p>
    </div>
  )
}
