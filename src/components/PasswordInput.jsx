import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// A password field with a show / hide button. Takes the same props as <input>.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative flex w-full">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} w-full pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[inherit]"
        style={{ color: 'var(--text-muted)' }}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  )
}
