import type { ReactNode } from 'react'
import { useReveal } from '../hooks/useReveal'

interface SceneProps {
  children: ReactNode
  className?: string
  delay?: number
}

function Scene({ children, className = '', delay = 0 }: SceneProps) {
  const { ref, inView } = useReveal()

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'scale(1) translateY(0)' : 'scale(1.06) translateY(40px)',
        filter: inView ? 'blur(0)' : 'blur(6px)',
        transition: `opacity 1.4s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 1.4s cubic-bezier(0.16,1,0.3,1) ${delay}s, filter 1.4s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

export default Scene
