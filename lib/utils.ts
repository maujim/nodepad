import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TextBlock } from '@/components/tile-card'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the set of block IDs that are "connected" to the hovered block,
 * based on shared category or influencedBy relationships.
 * Used by tiling-area and kanban-area for the connection-hover dimming effect.
 */
export function getRelatedIds(hoveredId: string, blocks: TextBlock[]): Set<string> {
  const hovered = blocks.find(b => b.id === hoveredId)
  if (!hovered) return new Set()

  const related = new Set<string>([hoveredId])
  blocks.forEach(b => {
    if (b.id === hoveredId) return

    // Primary: exact ID-based relationships (stable, rename-proof)
    const hoveredPointsToB = hovered.influencedBy?.includes(b.id) ?? false
    const bPointsToHovered = b.influencedBy?.includes(hoveredId) ?? false

    // Secondary: same category — catches blocks not yet enriched
    const sameCategory =
      !!b.category && !!hovered.category &&
      b.category.toLowerCase() === hovered.category.toLowerCase()

    if (hoveredPointsToB || bPointsToHovered || sameCategory) related.add(b.id)
  })
  return related
}
