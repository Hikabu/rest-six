'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Filter, X, ShieldCheck, BadgeCheck, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterState = {
  search?: string
  location?: string
  roleType?: string
  remoteType?: string
  salaryMin?: string
  salaryMax?: string
  stack?: string[]
  postedWithin?: string
  seniority?: string
  isWeb3?: boolean
  isDepositPaid?: boolean
  isVerifiedPayer?: boolean
  page?: number
  limit?: number
}

interface FilterBarProps {
  filters: FilterState
  onChange: (f: FilterState) => void
}

// ---------------------------------------------------------------------------
// Toggle chip
// ---------------------------------------------------------------------------

function ToggleChip({
  active,
  onClick,
  children,
  activeClassName,
  id,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  activeClassName?: string
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 select-none whitespace-nowrap',
        active
          ? (activeClassName ?? 'border-primary bg-primary text-primary-foreground')
          : 'border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Stack tag input
// ---------------------------------------------------------------------------

function StackTagInput({
  tags,
  onTagsChange,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
}) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed])
    }
    setInputValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onTagsChange(tags.slice(0, -1))
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val.endsWith(',')) {
      addTag(val.slice(0, -1))
    } else {
      setInputValue(val)
    }
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      className="flex min-w-[7rem] max-w-[14rem] cursor-text flex-wrap items-center gap-1 rounded-lg border border-border bg-transparent px-2 py-1 text-xs transition-colors focus-within:border-primary/60"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="ml-0.5 text-primary/60 hover:text-primary"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'e.g. React' : ''}
        className="min-w-[5rem] flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const stack = filters.stack ?? []

  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial })
  }

  function clearAll() {
    onChange({ page: filters.page, limit: filters.limit })
  }

  // Count active filters (excluding pagination)
  const activeCount = [
    filters.location,
    filters.roleType && filters.roleType !== 'all',
    filters.remoteType && filters.remoteType !== 'all',
    filters.salaryMin,
    filters.salaryMax,
    stack.length > 0,
    filters.postedWithin && filters.postedWithin !== 'any',
    filters.isDepositPaid,
    filters.isVerifiedPayer,
  ].filter(Boolean).length

  const isAnyActive = activeCount > 0

  const filterControls = (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-2 py-3">
        {/* Location */}
        <Input
          id="filter-location"
          value={filters.location ?? ''}
          onChange={(e) => patch({ location: e.target.value || undefined })}
          placeholder="Location"
          className="h-8 w-32 rounded-lg border-border bg-transparent text-xs placeholder:text-muted-foreground focus-visible:ring-primary/40"
        />

        {/* Type: Role type Select */}
        <Select
          value={filters.roleType ?? 'all'}
          onValueChange={(v) => patch({ roleType: v === 'all' ? undefined : v })}
        >
          <SelectTrigger
            id="filter-role-type"
            className="h-8 w-36 rounded-lg border-border bg-transparent text-xs"
          >
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="full-time">Full-time</SelectItem>
            <SelectItem value="part-time">Part-time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
          </SelectContent>
        </Select>

        {/* Remote toggle chips */}
        <div className="flex items-center gap-1">
          {(['Remote', 'Onsite', 'Hybrid'] as const).map((opt) => {
            const val = opt.toLowerCase()
            const active = (filters.remoteType ?? 'all') === val
            return (
              <ToggleChip
                key={opt}
                id={`filter-remote-${val}`}
                active={active}
                onClick={() =>
                  patch({ remoteType: active ? undefined : val })
                }
              >
                {opt}
              </ToggleChip>
            )
          })}
        </div>

        {/* Salary range */}
        <Input
          id="filter-salary-min"
          value={filters.salaryMin ?? ''}
          onChange={(e) => patch({ salaryMin: e.target.value || undefined })}
          placeholder="Min"
          className="h-8 w-24 rounded-lg border-border bg-transparent text-xs placeholder:text-muted-foreground focus-visible:ring-primary/40"
        />
        <Input
          id="filter-salary-max"
          value={filters.salaryMax ?? ''}
          onChange={(e) => patch({ salaryMax: e.target.value || undefined })}
          placeholder="Max"
          className="h-8 w-24 rounded-lg border-border bg-transparent text-xs placeholder:text-muted-foreground focus-visible:ring-primary/40"
        />

        {/* Stack tag input */}
        <StackTagInput
          tags={stack}
          onTagsChange={(tags) => patch({ stack: tags.length ? tags : undefined })}
        />

        {/* Posted within */}
        <Select
          value={filters.postedWithin ?? 'any'}
          onValueChange={(v) => patch({ postedWithin: v === 'any' ? undefined : v })}
        >
          <SelectTrigger
            id="filter-posted-within"
            className="h-8 w-32 rounded-lg border-border bg-transparent text-xs"
          >
            <SelectValue placeholder="Posted" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        {/* Deposit paid chip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleChip
              id="filter-deposit-paid"
              active={!!filters.isDepositPaid}
              onClick={() => patch({ isDepositPaid: filters.isDepositPaid ? undefined : true })}
              activeClassName="border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Deposit paid
            </ToggleChip>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Only show jobs with on-chain escrow locked by employer.
          </TooltipContent>
        </Tooltip>

        {/* Verified payer chip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleChip
              id="filter-verified-payer"
              active={!!filters.isVerifiedPayer}
              onClick={() =>
                patch({ isVerifiedPayer: filters.isVerifiedPayer ? undefined : true })
              }
              activeClassName="border-blue-500/50 bg-blue-500/15 text-blue-400"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified payer
            </ToggleChip>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Employer has a track record of releasing deposits after hiring (not a ghost job).
          </TooltipContent>
        </Tooltip>

        {/* Clear all */}
        {isAnyActive && (
          <Button
            id="filter-clear-all"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>
    </TooltipProvider>
  )

  return (
    <div className="border-b border-border">
      {/* Desktop: inline horizontal filter bar */}
      <div className="hidden overflow-x-auto md:block">
        <div className="flex items-center gap-2 py-3">
          {filterControls}
        </div>
      </div>

      {/* Mobile: collapsed button + dropdown */}
      <div className="flex items-center gap-2 py-3 md:hidden">
        <Button
          id="filter-mobile-toggle"
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen((o) => !o)}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 min-w-4 rounded-full bg-primary px-1 py-0 text-[10px] text-primary-foreground"
            >
              {activeCount}
            </Badge>
          )}
        </Button>

        {isAnyActive && !mobileOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 px-2 text-xs text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Mobile expanded panel */}
      {mobileOpen && (
        <div className="flex flex-wrap gap-2 border-t border-border pb-3 pt-3 md:hidden">
          {filterControls}
        </div>
      )}
    </div>
  )
}
