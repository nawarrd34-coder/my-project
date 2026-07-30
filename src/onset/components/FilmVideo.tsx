interface FilmVideoProps {
  src: string
  className?: string
  loop?: boolean
}

function FilmVideo({ src, className = '', loop = true }: FilmVideoProps) {
  return (
    <video
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
      src={src}
      autoPlay
      muted
      loop={loop}
      playsInline
    />
  )
}

export default FilmVideo
