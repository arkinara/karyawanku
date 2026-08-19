import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names, letting later Tailwind utilities win over
 * earlier ones in the same group (so `className` props can always override).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
