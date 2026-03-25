"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Trello, Grid, Trash2, Clipboard, Download,
  FolderOpen, FolderPlus, BookOpen, Sparkles,
  FolderDown, FolderInput
} from "lucide-react"
import { Command } from "cmdk"

// ─── Data ────────────────────────────────────────────────────────────────────

const GRID_COLS = 3

const GRID_ITEMS = [
  { id: "tiling",         icon: Grid,       label: "Tiling",      sub: "view"   },
  { id: "kanban",         icon: Trello,     label: "Kanban",      sub: "view"   },
  { id: "open-projects",  icon: FolderOpen, label: "Projects",    sub: "panel"  },
  { id: "new-project",    icon: FolderPlus, label: "New Project", sub: "action" },
  { id: "open-index",     icon: BookOpen,   label: "Index",       sub: "panel"  },
  { id: "open-synthesis", icon: Sparkles,   label: "Synthesis",   sub: "panel"  },
]

const ACTION_ITEMS = [
  { id: "export-nodepad", icon: FolderDown,  label: "Export",  sub: ".nodepad"  },
  { id: "import-nodepad", icon: FolderInput, label: "Import",  sub: ".nodepad"  },
  { id: "export-md",      icon: Download,    label: "Export",  sub: "markdown"  },
  { id: "copy-md",        icon: Clipboard,   label: "Copy",    sub: "markdown"  },
  { id: "clear",          icon: Trash2,      label: "Clear",   sub: "canvas"    },
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface VimInputProps {
  onSubmit: (text: string) => void
  onCommand: (cmd: string, text?: string) => void
  isCommandKOpen: boolean
  setIsCommandKOpen: (open: boolean) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VimInput({ onSubmit, onCommand, isCommandKOpen, setIsCommandKOpen }: VimInputProps) {
  const [value, setValue] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [focusedIdx, setFocusedIdx] = React.useState(0)

  const mainInputRef = React.useRef<HTMLInputElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  // ── Filtered items ──────────────────────────────────────────────────────

  const q = search.toLowerCase()
  const gridItems = q
    ? GRID_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.sub.includes(q))
    : GRID_ITEMS
  const actionItems = q
    ? ACTION_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.sub.includes(q))
    : ACTION_ITEMS

  const gridCount   = gridItems.length
  const totalItems  = gridCount + actionItems.length

  // ── Lifecycle ───────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (isCommandKOpen) {
      setSearch("")
      setFocusedIdx(0)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [isCommandKOpen])

  React.useEffect(() => { setFocusedIdx(0) }, [search])

  // Scroll focused item into view
  React.useEffect(() => {
    itemRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focusedIdx])

  // ── Helpers ─────────────────────────────────────────────────────────────

  const close = React.useCallback(() => {
    setIsCommandKOpen(false)
    requestAnimationFrame(() => mainInputRef.current?.focus())
  }, [setIsCommandKOpen])

  const handleSelect = React.useCallback((cmd: string) => {
    onCommand(cmd, value)
    setSearch("")
    close()
  }, [onCommand, value, close])

  // ── Grid keyboard navigation ─────────────────────────────────────────────

  const ACTION_COLS = actionItems.length // actions are always a single row

  const handlePopupKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (totalItems === 0) return

    const inActions = focusedIdx >= gridCount
    // Column width differs per section
    const cols     = inActions ? ACTION_COLS : GRID_COLS
    // Row boundaries within the current section
    const secStart = inActions ? gridCount : 0
    const localIdx = focusedIdx - secStart
    const rowStart = secStart + Math.floor(localIdx / cols) * cols
    const rowEnd   = Math.min(rowStart + cols - 1, secStart + (inActions ? actionItems.length : gridCount) - 1)

    switch (e.key) {
      case "Escape":
        e.preventDefault()
        close()
        break

      case "Enter":
        e.preventDefault()
        if (focusedIdx < gridCount) handleSelect(gridItems[focusedIdx].id)
        else handleSelect(actionItems[focusedIdx - gridCount].id)
        break

      case "ArrowRight":
        e.preventDefault()
        setFocusedIdx(focusedIdx >= rowEnd ? rowStart : focusedIdx + 1)
        break

      case "ArrowLeft":
        e.preventDefault()
        setFocusedIdx(focusedIdx <= rowStart ? rowEnd : focusedIdx - 1)
        break

      case "ArrowDown": {
        e.preventDefault()
        if (inActions) break // actions are one row — down wraps to navigate
        const below = focusedIdx + GRID_COLS
        if (below < gridCount) {
          setFocusedIdx(below)
        } else if (actionItems.length > 0) {
          setFocusedIdx(gridCount) // jump to first action
        }
        break
      }

      case "ArrowUp": {
        e.preventDefault()
        if (inActions) {
          // Jump back to last row of navigate grid, same column clamped
          const col = (focusedIdx - gridCount) % ACTION_COLS
          const navLastRow = Math.floor((gridCount - 1) / GRID_COLS) * GRID_COLS
          setFocusedIdx(Math.min(navLastRow + col, gridCount - 1))
        } else {
          const above = focusedIdx - GRID_COLS
          if (above >= 0) {
            setFocusedIdx(above)
          } else if (actionItems.length > 0) {
            setFocusedIdx(gridCount) // wrap to actions
          }
        }
        break
      }
    }
  }, [focusedIdx, gridCount, totalItems, ACTION_COLS, gridItems, actionItems, close, handleSelect])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full relative z-[110] flex flex-col items-center">
      <Command
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !isCommandKOpen) {
            onSubmit(value.trim())
            setValue("")
          }
          if (e.key === "Escape") setIsCommandKOpen(false)
        }}
      >
        {/* ── Command Popup ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {isCommandKOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-full left-0 right-0 w-full border-t border-white/10 bg-black/85 backdrop-blur-3xl shadow-[0_-24px_60px_-12px_rgba(0,0,0,0.6)]"
              onKeyDown={handlePopupKeyDown}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 select-none shrink-0">⌘K</span>
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent font-mono text-xs text-white/70 placeholder:text-white/35 outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-white/40 hover:text-white/70 transition-colors text-[10px] font-mono"
                  >
                    clear
                  </button>
                )}
              </div>

              <div className="p-3 max-h-[340px] overflow-y-auto scrollbar-none">

                {/* ── Navigate tiles ─────────────────────────────────────── */}
                {gridItems.length > 0 && (
                  <div className="mb-3">
                    <p className="px-1 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">
                      Navigate
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {gridItems.map((item, i) => {
                        const focused = focusedIdx === i
                        return (
                          <button
                            key={item.id}
                            ref={el => { itemRefs.current[i] = el }}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setFocusedIdx(i)}
                            className={`group flex flex-col items-center justify-center gap-2 rounded-sm border py-4 px-2 transition-all duration-100 outline-none ${
                              focused
                                ? "bg-primary/12 border-primary/35 text-primary shadow-[0_0_0_1px_var(--primary),inset_0_1px_0_rgba(255,255,255,0.05)]"
                                : "bg-white/[0.03] border-white/[0.07] text-white/55 hover:bg-white/[0.06] hover:border-white/20 hover:text-white/80"
                            }`}
                          >
                            <item.icon className={`h-[18px] w-[18px] transition-transform duration-100 ${focused ? "scale-110" : "group-hover:scale-105"}`} />
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[10px] font-bold tracking-tight">{item.label}</div>
                              <div className={`font-mono text-[7px] uppercase tracking-[0.15em] mt-0.5 ${focused ? "text-primary/60" : "text-white/40"}`}>
                                {item.sub}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Action tiles ───────────────────────────────────────── */}
                {actionItems.length > 0 && (
                  <div className={gridItems.length > 0 ? "border-t border-white/10 pt-3" : ""}>
                    <p className="px-1 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">
                      Actions
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {actionItems.map((item, i) => {
                        const idx     = gridCount + i
                        const focused = focusedIdx === idx
                        return (
                          <button
                            key={item.id}
                            ref={el => { itemRefs.current[idx] = el }}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setFocusedIdx(idx)}
                            className={`group flex flex-col items-center justify-center gap-2 rounded-sm border py-4 px-2 transition-all duration-100 outline-none ${
                              focused
                                ? "bg-primary/12 border-primary/35 text-primary shadow-[0_0_0_1px_var(--primary),inset_0_1px_0_rgba(255,255,255,0.05)]"
                                : "bg-white/[0.03] border-white/[0.07] text-white/55 hover:bg-white/[0.06] hover:border-white/20 hover:text-white/80"
                            }`}
                          >
                            <item.icon className={`h-[18px] w-[18px] transition-transform duration-100 ${focused ? "scale-110" : "group-hover:scale-105"}`} />
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[10px] font-bold tracking-tight">{item.label}</div>
                              <div className={`font-mono text-[7px] uppercase tracking-[0.15em] mt-0.5 ${focused ? "text-primary/60" : "text-white/40"}`}>
                                {item.sub}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Empty state ────────────────────────────────────────── */}
                {totalItems === 0 && (
                  <div className="py-10 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                    No commands match
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-end gap-4 px-5 py-2 border-t border-white/10">
                {[
                  ["↑↓", "rows"],
                  ["←→", "tiles"],
                  ["↵",  "select"],
                  ["esc","close"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <kbd className="font-mono text-[9px] text-white/50 bg-white/8 border border-white/15 rounded px-1 py-0.5">{key}</kbd>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-white/40">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Input Bar ─────────────────────────────────────────────── */}
        <div className="w-full border-t border-white/20 bg-black/80 backdrop-blur-3xl px-6 py-5 flex items-center gap-4 transition-all duration-300 focus-within:border-primary/40 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <div className="flex items-center gap-3 flex-1">
            <div className="font-mono text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] select-none">
              Entry
            </div>
            <Command.Input
              ref={mainInputRef}
              value={value}
              onValueChange={setValue}
              placeholder="Capture something..."
              className="flex-1 bg-transparent font-mono text-sm tracking-tight text-white outline-none placeholder:text-white/35"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <kbd className="flex h-5 items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] text-white/40">
                <span className="text-[11px] mr-1">⌘</span>
                <span>Z</span>
              </kbd>
              <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-tighter">Undo</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <kbd className="flex h-5 items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] text-white/40">
                <span className="text-[11px] mr-1">⌘</span>
                <span>K</span>
              </kbd>
              <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-tighter">Commands</span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            <button
              onClick={() => {
                if (value.trim()) {
                  onSubmit(value.trim())
                  setValue("")
                  setIsCommandKOpen(false)
                }
              }}
              className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest hover:brightness-125 transition-all active:scale-95 disabled:opacity-20"
              disabled={!value.trim()}
            >
              Submit
            </button>
          </div>
        </div>
      </Command>
    </div>
  )
}
