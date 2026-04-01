import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'

const WEEK_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const MINI_WEEK_DAYS = ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

const monthTitleFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
})

const MAX_VISIBLE_EVENTS_IN_MONTH_DAY = 1
const monthDayFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'short', day: 'numeric' })
const upcomingWeekdayFormatter = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' })
const upcomingDayMonthFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const selectedDayPanelFormatter = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})
const eventDetailDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const weekTitleFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const dayTitleFormatter = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const TOOLBAR_DROPDOWN_WIDTH = 188
const TOOLBAR_DROPDOWN_OFFSET_Y = 8
const TOOLBAR_DROPDOWN_MARGIN = 8

const INITIAL_DATE = clearTime(new Date())
const INITIAL_MONTH = startOfMonth(INITIAL_DATE)

const OFFICIAL_HOLIDAYS = {
  '2026-01-01': 'Yılbaşı',
  '2026-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': 'Emek ve Dayanışma Günü',
  '2026-05-19': "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  '2026-07-15': 'Demokrasi ve Milli Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-29': 'Cumhuriyet Bayramı',
}

const BUNGALOV_SHARP_COLORS = [
  '#0057ff', // mavi
  '#ffd600', // sari
  '#ff1f1f', // kirmizi
  '#00c853', // yesil
  '#ff2d96', // pembe
  '#ff6d00', // turuncu
  '#7c4dff', // mor
  '#00bcd4', // turkuaz
  '#00e5ff', // camgobegi
  '#9c27b0', // fuşya-mor
]

const INITIAL_BUNGALOWS = [
  {
    id: 'seed-bungalov-1',
    name: 'Aden Garden Suit No.1',
    price: '5475',
    status: 'aktif',
    color: '#00c853',
  },
  {
    id: 'seed-bungalov-2',
    name: 'Aden Garden Suit No.2',
    price: '6120',
    status: 'aktif',
    color: '#ff1f1f',
  },
  {
    id: 'seed-bungalov-3',
    name: 'Aden Garden Suit No.3',
    price: '5880',
    status: 'aktif',
    color: '#0057ff',
  },
  {
    id: 'seed-bungalov-4',
    name: 'Aden Family Suit No.4',
    price: '7340',
    status: 'aktif',
    color: '#ff2d96',
  },
  {
    id: 'seed-bungalov-5',
    name: 'Aden Family Suit No.5',
    price: '7015',
    status: 'aktif',
    color: '#ffd600',
  },
  {
    id: 'seed-bungalov-6',
    name: 'Aden Family Suit No.6',
    price: '7680',
    status: 'aktif',
    color: '#00bcd4',
  },
  {
    id: 'seed-bungalov-7',
    name: 'Aden Blue Suit No.7',
    price: '6290',
    status: 'aktif',
    color: '#7c4dff',
  },
  {
    id: 'seed-bungalov-8',
    name: 'Aden Blue Suit No.8',
    price: '6535',
    status: 'aktif',
    color: '#ff6d00',
  },
  {
    id: 'seed-bungalov-9',
    name: 'Aden White Suit No.9',
    price: '5725',
    status: 'aktif',
    color: '#9c27b0',
  },
  {
    id: 'seed-bungalov-10',
    name: 'Aden White Suit No.10',
    price: '5960',
    status: 'aktif',
    color: '#00e5ff',
  },
]

function canUseLocalDemoData() {
  if (typeof window === 'undefined') {
    return false
  }

  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

async function requestApi(path, options = {}) {
  const { method = 'GET', body, allowStatuses = [] } = options
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const error = new Error('API yanıtı JSON formatında değil.')
    error.status = response.status
    error.payload = {}
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok && !allowStatuses.includes(response.status)) {
    const error = new Error(payload.message || 'Sunucu hatası')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return {
    ...payload,
    __status: response.status,
  }
}

function getApiErrorMessage(error, fallbackMessage) {
  const apiErrorCode = error?.payload?.error

  if (apiErrorCode === 'UNAUTHORIZED') {
    return 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
  }

  if (apiErrorCode === 'BUNGALOW_HAS_RESERVATIONS') {
    return 'Bu bungalova bağlı rezervasyonlar olduğu için silinemez.'
  }

  if (apiErrorCode === 'RESERVATION_OVERLAP') {
    return 'Seçilen tarih aralığında aynı bungalov için başka rezervasyon var.'
  }

  return error?.payload?.message || error?.message || fallbackMessage
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function addDays(date, count) {
  const copy = clearTime(date)
  copy.setDate(copy.getDate() + count)
  return copy
}

function clearTime(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfWeekSunday(date) {
  const copy = clearTime(date)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

function buildMonthGrid(date) {
  const firstDay = startOfMonth(date)
  const firstCell = startOfWeekSunday(firstDay)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell)
    day.setDate(firstCell.getDate() + index)
    return day
  })
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toInputDate(date) {
  return toDateKey(clearTime(date))
}

function toDayNumber(date) {
  const normalized = clearTime(date)
  return Date.UTC(normalized.getFullYear(), normalized.getMonth(), normalized.getDate()) / 86400000
}

function diffInDays(startDate, endDate) {
  return toDayNumber(endDate) - toDayNumber(startDate)
}

function fromInputDate(value) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function nextInputDate(value) {
  const parsedDate = fromInputDate(value)
  if (!parsedDate) {
    return ''
  }

  parsedDate.setDate(parsedDate.getDate() + 1)
  return toDateKey(parsedDate)
}

function getReservationRangeBounds(event) {
  const start = clearTime(new Date(event.checkIn))
  const endExclusive = clearTime(new Date(event.checkOut))

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime()) || endExclusive <= start) {
    return null
  }

  return { start, endExclusive }
}

function toSoftEventBackground(colorValue) {
  if (!colorValue) {
    return 'rgba(26, 115, 232, 0.22)'
  }

  if (colorValue.startsWith('#')) {
    const hex = colorValue.slice(1)
    const normalized = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex
    const colorInt = Number.parseInt(normalized, 16)
    if (Number.isNaN(colorInt)) {
      return 'rgba(26, 115, 232, 0.22)'
    }

    const red = (colorInt >> 16) & 255
    const green = (colorInt >> 8) & 255
    const blue = colorInt & 255
    return `rgba(${red}, ${green}, ${blue}, 0.22)`
  }

  if (colorValue.startsWith('hsl(') && colorValue.endsWith(')')) {
    const content = colorValue.slice(4, -1).trim()
    return `hsl(${content} / 0.22)`
  }

  return 'rgba(26, 115, 232, 0.22)'
}

function toUpcomingGroupTitle(date, today) {
  const daysFromToday = diffInDays(today, date)
  if (daysFromToday === 0) {
    return 'Bugün'
  }
  if (daysFromToday === 1) {
    return 'Yarın'
  }
  return `${upcomingWeekdayFormatter.format(date)}, ${upcomingDayMonthFormatter.format(date)}`
}

function toReservationDateText(inputDateValue) {
  const parsedDate = fromInputDate(inputDateValue)
  return parsedDate ? eventDetailDateFormatter.format(parsedDate) : '-'
}

function compareReservations(left, right) {
  const leftCheckIn = fromInputDate(left.checkIn)
  const rightCheckIn = fromInputDate(right.checkIn)
  if (leftCheckIn && rightCheckIn && leftCheckIn.getTime() !== rightCheckIn.getTime()) {
    return leftCheckIn - rightCheckIn
  }

  const leftCheckOut = fromInputDate(left.checkOut)
  const rightCheckOut = fromInputDate(right.checkOut)
  if (leftCheckOut && rightCheckOut && leftCheckOut.getTime() !== rightCheckOut.getTime()) {
    return leftCheckOut - rightCheckOut
  }

  return (left.title ?? '').localeCompare(right.title ?? '', 'tr')
}

function createReservationGroupsByDate(events, getDateValue, todayDate) {
  const groupedByDate = new Map()

  events.forEach((event) => {
    const dateValue = getDateValue(event)
    const parsedDate = fromInputDate(dateValue)
    if (!parsedDate) {
      return
    }

    const dateKey = toDateKey(parsedDate)
    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, { date: parsedDate, events: [] })
    }
    groupedByDate.get(dateKey).events.push(event)
  })

  return Array.from(groupedByDate.entries())
    .sort((left, right) => left[1].date - right[1].date)
    .map(([dateKey, group]) => ({
      dateKey,
      title: toUpcomingGroupTitle(group.date, todayDate),
      events: [...group.events].sort(compareReservations),
    }))
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function capitalize(text) {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function createUniqueRandomBungalovColor(existingBungalows) {
  const usedColors = new Set(
    existingBungalows
      .map((bungalov) => bungalov.color)
      .filter(Boolean)
      .map((color) => color.toLowerCase()),
  )

  const availableSharpColors = BUNGALOV_SHARP_COLORS.filter((color) => !usedColors.has(color))
  if (availableSharpColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableSharpColors.length)
    return availableSharpColors[randomIndex]
  }

  const seedHue = (existingBungalows.length * 137) % 360
  for (let offset = 0; offset < 360; offset += 1) {
    const hue = (seedHue + offset) % 360
    const candidate = `hsl(${hue} 100% 50%)`
    if (!usedColors.has(candidate)) {
      return candidate
    }
  }

  return BUNGALOV_SHARP_COLORS[0]
}

function SidebarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="M16.25 3.625c1.174 0 2.125.951 2.125 2.125v8.5a2.125 2.125 0 0 1-2.125 2.125H3.75a2.125 2.125 0 0 1-2.125-2.125v-8.5c0-1.174.951-2.125 2.125-2.125h12.5Zm-12.5 1.25a.875.875 0 0 0-.875.875v8.5c0 .483.392.875.875.875h2.7V4.875h-2.7Zm3.8 10.25h8.7a.875.875 0 0 0 .875-.875v-8.5a.875.875 0 0 0-.875-.875h-8.7v10.25Z"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="M8.875 2.625a6.25 6.25 0 1 0 3.955 11.09l3.983 3.982a.625.625 0 1 0 .884-.884l-3.983-3.982a6.25 6.25 0 0 0-4.84-10.206Zm-5 6.25a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="m16.774 4.341-.59.589-1.109-1.11.596-.594a.784.784 0 0 1 1.103 0c.302.302.302.8 0 1.102v.013ZM8.65 12.462l6.816-6.813-1.11-1.11-6.822 6.808a1.081 1.081 0 0 0-.236.393l-.289.932c-.052.196.131.38.315.314l.932-.288a.882.882 0 0 0 .394-.236Z"
      />
      <path
        fill="currentColor"
        d="M4.375 6.25c0-1.036.84-1.875 1.875-1.875H11a.625.625 0 1 0 0-1.25H6.25A3.125 3.125 0 0 0 3.125 6.25v7.5c0 1.726 1.4 3.125 3.125 3.125h7.5c1.726 0 3.125-1.4 3.125-3.125V9a.625.625 0 1 0-1.25 0v4.75c0 1.036-.84 1.875-1.875 1.875h-7.5a1.875 1.875 0 0 1-1.875-1.875v-7.5Z"
      />
    </svg>
  )
}

function DockRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="M16.25 3.625c1.174 0 2.125.951 2.125 2.125v8.5a2.125 2.125 0 0 1-2.125 2.125H3.75a2.125 2.125 0 0 1-2.125-2.125v-8.5c0-1.174.951-2.125 2.125-2.125h12.5Zm-12.5 1.25a.875.875 0 0 0-.875.875v8.5c0 .483.392.875.875.875h8.7V4.875h-8.7Zm9.8 10.25h2.7a.875.875 0 0 0 .875-.875v-8.5a.875.875 0 0 0-.875-.875h-2.7v10.25Z"
      />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="M10.589 6.077a.833.833 0 0 0-1.178 0L5.62 9.869a.833.833 0 0 0 1.178 1.178L10 7.845l3.202 3.202a.833.833 0 0 0 1.179-1.178l-3.792-3.792Z"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        d="M9.41 13.256a.833.833 0 0 0 1.18 0l3.791-3.792a.833.833 0 0 0-1.178-1.178L10 11.488 6.798 8.286A.833.833 0 0 0 5.62 9.464l3.792 3.792Z"
      />
    </svg>
  )
}

function Tooltip({ label, align = 'center', children }) {
  const anchorRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePosition = () => {
      if (!anchorRef.current) {
        return
      }

      const rect = anchorRef.current.getBoundingClientRect()
      const left =
        align === 'start' ? rect.left : align === 'end' ? rect.right : rect.left + rect.width / 2
      const top = rect.bottom + 8
      setPosition({ top, left })
    }

    handlePosition()
    window.addEventListener('resize', handlePosition)
    window.addEventListener('scroll', handlePosition, true)

    return () => {
      window.removeEventListener('resize', handlePosition)
      window.removeEventListener('scroll', handlePosition, true)
    }
  }, [isOpen, align])

  const openTooltip = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      const left =
        align === 'start' ? rect.left : align === 'end' ? rect.right : rect.left + rect.width / 2
      const top = rect.bottom + 8
      setPosition({ top, left })
    }
    setIsOpen(true)
  }

  const closeTooltip = () => {
    setIsOpen(false)
  }

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeTooltip()
    }
  }

  return (
    <span
      ref={anchorRef}
      className="tooltip-anchor"
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onFocus={openTooltip}
      onBlur={handleBlur}
    >
      {children}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            className={`app-tooltip app-tooltip-portal tooltip-align-${align}`}
            role="tooltip"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}

function App() {
  const [activeMonth, setActiveMonth] = useState(() => INITIAL_MONTH)
  const [selectedDate, setSelectedDate] = useState(() => INITIAL_DATE)
  const [hasDateSelection, setHasDateSelection] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.innerWidth > 980
  })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState('ay')
  const [isBungalowModalOpen, setIsBungalowModalOpen] = useState(false)
  const [isBungalowPinned, setIsBungalowPinned] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [bungalowName, setBungalowName] = useState('')
  const [nightlyPrice, setNightlyPrice] = useState('')
  const [bungalows, setBungalows] = useState(() => (canUseLocalDemoData() ? INITIAL_BUNGALOWS : []))
  const [customEvents, setCustomEvents] = useState([])
  const [eventCustomerName, setEventCustomerName] = useState('')
  const [eventCheckIn, setEventCheckIn] = useState(() => toInputDate(INITIAL_DATE))
  const [eventCheckOut, setEventCheckOut] = useState(() => nextInputDate(toInputDate(INITIAL_DATE)))
  const [eventDescription, setEventDescription] = useState('')
  const [eventBungalowId, setEventBungalowId] = useState('')
  const [selectedBungalowFilterId, setSelectedBungalowFilterId] = useState('')
  const [selectedRightEventId, setSelectedRightEventId] = useState('')
  const [editingBungalowId, setEditingBungalowId] = useState('')
  const [editingEventId, setEditingEventId] = useState('')
  const [isBungalowDeleteConfirmOpen, setIsBungalowDeleteConfirmOpen] = useState(false)
  const [authStatus, setAuthStatus] = useState('loading')
  const [currentUser, setCurrentUser] = useState(null)
  const [loginEmail, setLoginEmail] = useState('admin@adenbungalov.com')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false)
  const [isApiConnected, setIsApiConnected] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef(null)
  const profileMenuRef = useRef(null)
  const viewMenuRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const viewDropdownRef = useRef(null)
  const [profileDropdownPosition, setProfileDropdownPosition] = useState(null)
  const [viewDropdownPosition, setViewDropdownPosition] = useState(null)

  const monthGrid = useMemo(() => {
    const grid = buildMonthGrid(activeMonth)
    return Array.from({ length: 6 }, (_, row) => grid.slice(row * 7, row * 7 + 7))
  }, [activeMonth])

  const monthTitle = monthTitleFormatter.format(activeMonth)
  const todayDate = useMemo(() => clearTime(new Date()), [])
  const weekDays = useMemo(() => {
    const start = startOfWeekSunday(selectedDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [selectedDate])
  const weekTitle = `${weekTitleFormatter.format(weekDays[0])} - ${weekTitleFormatter.format(
    weekDays[6],
  )} ${weekDays[6].getFullYear()}`
  const dayTitle = capitalize(dayTitleFormatter.format(selectedDate))
  const selectedWeekday = selectedDate.getDay()
  const viewLabel = viewMode === 'gün' ? 'Gün' : viewMode === 'hafta' ? 'Hafta' : 'Ay'
  const pageTitle = viewMode === 'ay' ? monthTitle : viewMode === 'hafta' ? weekTitle : dayTitle
  const hasSearch = searchTerm.trim().length > 0
  const searchValue = searchTerm.trim().toLowerCase()
  const calendarEvents = useMemo(
    () =>
      selectedBungalowFilterId
        ? customEvents.filter((event) => event.bungalowId === selectedBungalowFilterId)
        : customEvents,
    [customEvents, selectedBungalowFilterId],
  )

  const allEventsByDate = useMemo(() => {
    const merged = {}

    calendarEvents.forEach((event) => {
      const rangeBounds = getReservationRangeBounds(event)
      if (!rangeBounds) {
        return
      }
      const { start, endExclusive } = rangeBounds

      const durationDays = diffInDays(start, endExclusive)
      for (let cursor = start; cursor < endExclusive; cursor = addDays(cursor, 1)) {
        const dateKey = toDateKey(cursor)
        if (!merged[dateKey]) {
          merged[dateKey] = []
        }
        merged[dateKey].push({
          id: `${event.id}-${dateKey}`,
          sourceEventId: event.id,
          title: event.title,
          color: 'custom',
          customColor: event.color,
          durationDays,
          searchText: `${event.title} ${event.description}`,
        })
      }
    })

    return merged
  }, [calendarEvents])

  const eventsByDate = useMemo(() => {
    if (!hasSearch) {
      return allEventsByDate
    }

    return Object.entries(allEventsByDate).reduce((carry, [dateKey, events]) => {
      const filtered = events.filter((event) =>
        (event.searchText ?? event.title).toLowerCase().includes(searchValue),
      )
      if (filtered.length > 0) {
        carry[dateKey] = filtered
      }
      return carry
    }, {})
  }, [allEventsByDate, hasSearch, searchValue])

  const monthWeekSpans = useMemo(
    () =>
      monthGrid.map((weekDays) => {
        const weekStart = clearTime(weekDays[0])
        const weekEndExclusive = addDays(weekDays[6], 1)
        const weekSegments = []

        calendarEvents.forEach((event) => {
          const rangeBounds = getReservationRangeBounds(event)
          if (!rangeBounds) {
            return
          }
          const { start: eventStart, endExclusive: eventEndExclusive } = rangeBounds
          const eventSearchText = `${event.title} ${event.description}`.toLowerCase()

          if (hasSearch && !eventSearchText.includes(searchValue)) {
            return
          }

          const segmentStart = eventStart > weekStart ? eventStart : weekStart
          const segmentEndExclusive = eventEndExclusive < weekEndExclusive ? eventEndExclusive : weekEndExclusive

          if (segmentEndExclusive <= segmentStart) {
            return
          }

          weekSegments.push({
            id: event.id,
            sourceEventId: event.id,
            title: event.title,
            color: event.color,
            startCol: diffInDays(weekStart, segmentStart),
            endCol: diffInDays(weekStart, segmentEndExclusive),
            startsThisWeek: eventStart >= weekStart,
            endsThisWeek: eventEndExclusive <= weekEndExclusive,
          })
        })

        weekSegments.sort(
          (left, right) =>
            left.startCol - right.startCol ||
            right.endCol - right.startCol - (left.endCol - left.startCol),
        )

        const trackEndColumns = []
        const placedSegments = weekSegments.map((segment) => {
          let trackIndex = trackEndColumns.findIndex((endCol) => segment.startCol >= endCol)
          if (trackIndex === -1) {
            trackIndex = trackEndColumns.length
            trackEndColumns.push(segment.endCol)
          } else {
            trackEndColumns[trackIndex] = segment.endCol
          }

          return {
            ...segment,
            trackIndex,
          }
        })

        return {
          trackCount: trackEndColumns.length,
          segments: placedSegments,
        }
      }),
    [monthGrid, calendarEvents, hasSearch, searchValue],
  )

  const selectedDateKey = toDateKey(selectedDate)
  const selectedDateEvents = eventsByDate[selectedDateKey] ?? []
  const selectedHolidayLabel = OFFICIAL_HOLIDAYS[selectedDateKey] ?? null
  const isPinnedBungalowEditorVisible = isBungalowModalOpen && isBungalowPinned
  const isRightPanelVisible = isRightPanelOpen || isPinnedBungalowEditorVisible
  const sidebarToggleTooltip = isSidebarOpen ? 'Kenar Çubuğunu Gizle' : 'Kenar Çubuğunu Göster'
  const searchToggleTooltip = isSearchOpen ? 'Arama Kutusunu Gizle' : 'Arama Kutusunu Göster'
  const previousPeriodTooltip =
    viewMode === 'ay'
      ? 'Önceki Aya Git'
      : viewMode === 'hafta'
        ? 'Önceki Haftaya Git'
        : 'Önceki Güne Git'
  const nextPeriodTooltip =
    viewMode === 'ay'
      ? 'Sonraki Aya Git'
      : viewMode === 'hafta'
        ? 'Sonraki Haftaya Git'
        : 'Sonraki Güne Git'
  const rightPanelTooltip = isRightPanelVisible
    ? 'Rezervasyon Alanını Gizle'
    : 'Rezervasyon Alanını Göster'
  const isAuthenticated = authStatus === 'authenticated' || authStatus === 'demo'
  const avatarLabel = (currentUser?.email?.charAt(0) ?? 'A').toUpperCase()
  const selectedEventBungalow =
    bungalows.find((bungalov) => bungalov.id === eventBungalowId) ?? null
  const editingBungalow =
    editingBungalowId ? bungalows.find((bungalov) => bungalov.id === editingBungalowId) ?? null : null
  const isEditingBungalow = Boolean(editingBungalow)
  const isEditingBungalowDeleteDisabled =
    isEditingBungalow && customEvents.some((event) => event.bungalowId === editingBungalowId)
  const isEditingEvent = Boolean(editingEventId)
  const selectedPanelDateKey = hasDateSelection ? selectedDateKey : ''
  const selectedPanelDateTitle = hasDateSelection
    ? capitalize(selectedDayPanelFormatter.format(selectedDate))
    : ''
  const selectedPanelDayEvents = selectedPanelDateKey ? eventsByDate[selectedPanelDateKey] ?? [] : []
  const reservationsById = useMemo(
    () => new Map(customEvents.map((event) => [event.id, event])),
    [customEvents],
  )
  const resolveReservation = (eventData) =>
    reservationsById.get(eventData.sourceEventId ?? eventData.id) ?? eventData
  const selectedRightEvent = useMemo(
    () => customEvents.find((event) => event.id === selectedRightEventId) ?? null,
    [customEvents, selectedRightEventId],
  )
  const selectedRightEventCheckIn = selectedRightEvent ? fromInputDate(selectedRightEvent.checkIn) : null
  const selectedRightEventCheckOut = selectedRightEvent ? fromInputDate(selectedRightEvent.checkOut) : null
  const selectedRightEventCheckInText = selectedRightEventCheckIn
    ? eventDetailDateFormatter.format(selectedRightEventCheckIn)
    : '-'
  const selectedRightEventCheckOutText = selectedRightEventCheckOut
    ? eventDetailDateFormatter.format(selectedRightEventCheckOut)
    : '-'
  const upcomingReservationGroups = useMemo(
    () =>
      createReservationGroupsByDate(
        customEvents.filter((event) => {
          const checkInDate = fromInputDate(event.checkIn)
          return Boolean(checkInDate) && checkInDate > todayDate
        }),
        (event) => event.checkIn,
        todayDate,
      ),
    [customEvents, todayDate],
  )
  const checkInReservationGroups = useMemo(
    () =>
      createReservationGroupsByDate(
        customEvents.filter((event) => {
          const checkInDate = fromInputDate(event.checkIn)
          return Boolean(checkInDate) && isSameDate(checkInDate, todayDate)
        }),
        (event) => event.checkIn,
        todayDate,
      ),
    [customEvents, todayDate],
  )
  const checkOutReservationGroups = useMemo(
    () =>
      createReservationGroupsByDate(
        customEvents.filter((event) => {
          const checkOutDate = fromInputDate(event.checkOut)
          return Boolean(checkOutDate) && isSameDate(checkOutDate, todayDate)
        }),
        (event) => event.checkOut,
        todayDate,
      ),
    [customEvents, todayDate],
  )
  const eventCheckInDate = fromInputDate(eventCheckIn)
  const eventCheckOutDate = fromInputDate(eventCheckOut)
  const minimumEventCheckOut = nextInputDate(eventCheckIn)
  const isEventDateValid =
    Boolean(eventCheckInDate) &&
    Boolean(eventCheckOutDate) &&
    eventCheckOutDate > eventCheckInDate
  const isEventFormValid =
    isEventDateValid && Boolean(selectedEventBungalow) && eventCustomerName.trim().length > 0
  const syncRemoteData = async () => {
    const [bungalowResponse, reservationResponse] = await Promise.all([
      requestApi('/api/bungalows'),
      requestApi('/api/reservations'),
    ])

    const nextBungalows = Array.isArray(bungalowResponse.bungalows) ? bungalowResponse.bungalows : []
    const nextReservations = Array.isArray(reservationResponse.reservations)
      ? reservationResponse.reservations
      : []

    setBungalows(nextBungalows)
    setCustomEvents(nextReservations)
    setIsApiConnected(true)

    return {
      bungalows: nextBungalows,
      reservations: nextReservations,
    }
  }

  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      try {
        const authResponse = await requestApi('/api/auth/me', { allowStatuses: [401] })
        if (!isMounted) {
          return
        }

        if (authResponse.__status === 401) {
          setCurrentUser(null)
          setAuthStatus('unauthenticated')
          setLoginError('')
          setBungalows([])
          setCustomEvents([])
          setIsApiConnected(true)
          return
        }

        setCurrentUser(authResponse.user ?? null)
        setAuthStatus('authenticated')
        setLoginError('')

        try {
          const [bungalowResponse, reservationResponse] = await Promise.all([
            requestApi('/api/bungalows'),
            requestApi('/api/reservations'),
          ])

          if (!isMounted) {
            return
          }

          setBungalows(Array.isArray(bungalowResponse.bungalows) ? bungalowResponse.bungalows : [])
          setCustomEvents(Array.isArray(reservationResponse.reservations) ? reservationResponse.reservations : [])
          setIsApiConnected(true)
        } catch (dataError) {
          if (!isMounted) {
            return
          }

          const fallbackAllowed = canUseLocalDemoData()
          if (fallbackAllowed) {
            console.error('Turso verisi yüklenemedi. Lokal demo veri ile devam ediliyor.', dataError)
            setBungalows(INITIAL_BUNGALOWS)
          } else {
            console.error('Turso verisi yüklenemedi. Production ortamında demo veri kapalı.', dataError)
            setBungalows([])
            setCustomEvents([])
          }
          setIsApiConnected(false)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        const fallbackAllowed = canUseLocalDemoData()
        if (fallbackAllowed) {
          console.error('Auth endpoint ulaşılamadı. Lokal demo veri ile devam ediliyor.', error)
          setBungalows(INITIAL_BUNGALOWS)
          setCustomEvents([])
          setCurrentUser({
            id: 'local-demo-user',
            email: 'demo@localhost',
            role: 'admin',
          })
          setAuthStatus('demo')
        } else {
          console.error('Auth endpoint erişimi başarısız.', error)
          setBungalows([])
          setCustomEvents([])
          setCurrentUser(null)
          setAuthStatus('unauthenticated')
          setLoginError('Sunucu bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.')
        }
        setIsApiConnected(false)
      }
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus()
    }
  }, [isSearchOpen])

  useEffect(() => {
    if (!isProfileMenuOpen && !isViewMenuOpen) {
      return undefined
    }

    const updateToolbarDropdownPositions = () => {
      if (typeof window === 'undefined') {
        return
      }

      const minLeft = TOOLBAR_DROPDOWN_MARGIN
      const maxLeft = Math.max(
        TOOLBAR_DROPDOWN_MARGIN,
        window.innerWidth - TOOLBAR_DROPDOWN_MARGIN - TOOLBAR_DROPDOWN_WIDTH,
      )

      if (profileMenuRef.current) {
        const rect = profileMenuRef.current.getBoundingClientRect()
        setProfileDropdownPosition({
          top: rect.bottom + TOOLBAR_DROPDOWN_OFFSET_Y,
          left: clamp(rect.right - TOOLBAR_DROPDOWN_WIDTH, minLeft, maxLeft),
        })
      }

      if (viewMenuRef.current) {
        const rect = viewMenuRef.current.getBoundingClientRect()
        setViewDropdownPosition({
          top: rect.bottom + TOOLBAR_DROPDOWN_OFFSET_Y,
          left: clamp(rect.left, minLeft, maxLeft),
        })
      }
    }

    updateToolbarDropdownPositions()

    const handlePointerDown = (event) => {
      const isInsideProfile =
        profileMenuRef.current && profileMenuRef.current.contains(event.target)
      const isInsideViewTrigger = viewMenuRef.current && viewMenuRef.current.contains(event.target)
      const isInsideProfileDropdown =
        profileDropdownRef.current && profileDropdownRef.current.contains(event.target)
      const isInsideViewDropdown =
        viewDropdownRef.current && viewDropdownRef.current.contains(event.target)

      if (!isInsideProfile && !isInsideViewTrigger && !isInsideProfileDropdown && !isInsideViewDropdown) {
        setIsProfileMenuOpen(false)
        setIsViewMenuOpen(false)
        setProfileDropdownPosition(null)
        setViewDropdownPosition(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
        setIsViewMenuOpen(false)
        setProfileDropdownPosition(null)
        setViewDropdownPosition(null)
      }
    }

    const handleReposition = () => {
      updateToolbarDropdownPositions()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isProfileMenuOpen, isViewMenuOpen])

  useEffect(() => {
    if (!isBungalowModalOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (isBungalowDeleteConfirmOpen) {
          setIsBungalowDeleteConfirmOpen(false)
          return
        }
        setIsBungalowModalOpen(false)
        setIsBungalowPinned(false)
        setEditingBungalowId('')
        setIsBungalowDeleteConfirmOpen(false)
        setBungalowName('')
        setNightlyPrice('')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isBungalowModalOpen, isBungalowDeleteConfirmOpen])

  useEffect(() => {
    if (!isEventModalOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsEventModalOpen(false)
        setEditingEventId('')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isEventModalOpen])

  const openRightPanelForDate = (day) => {
    const dayKey = toDateKey(day)
    const dayEvents = eventsByDate[dayKey] ?? []
    if (dayEvents.length === 0) {
      return
    }

    if (isPinnedBungalowEditorVisible) {
      setIsBungalowPinned(false)
      setIsBungalowModalOpen(false)
      setIsBungalowDeleteConfirmOpen(false)
    }
    setIsRightPanelOpen(true)
  }

  const pickDate = (day, options = {}) => {
    setSelectedDate(day)
    setHasDateSelection(true)
    if (!isSameMonth(day, activeMonth)) {
      setActiveMonth(startOfMonth(day))
    }

    if (options.openPanelOnEvents) {
      openRightPanelForDate(day)
    }
  }

  const toggleSidebar = () => {
    setIsSidebarOpen((open) => !open)
  }

  const toggleSearch = () => {
    setIsSearchOpen((open) => !open)
  }

  const goToday = () => {
    const today = clearTime(new Date())
    setActiveMonth(startOfMonth(today))
    setSelectedDate(today)
  }

  const changeMonth = (direction) => {
    const nextMonth = addMonths(activeMonth, direction)
    setActiveMonth(nextMonth)
    setSelectedDate((current) => {
      if (viewMode === 'ay') {
        return startOfMonth(nextMonth)
      }
      const adjusted = new Date(current)
      adjusted.setMonth(adjusted.getMonth() + direction)
      return clearTime(adjusted)
    })
  }

  const changePeriod = (direction) => {
    if (viewMode === 'ay') {
      changeMonth(direction)
      return
    }

    const delta = viewMode === 'hafta' ? 7 * direction : direction
    const nextDate = addDays(selectedDate, delta)
    setSelectedDate(nextDate)
    setActiveMonth(startOfMonth(nextDate))
  }

  const clearSearch = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
  }

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen((open) => {
      const next = !open
      if (!next) {
        setProfileDropdownPosition(null)
      }
      return next
    })
    setIsViewMenuOpen(false)
    setViewDropdownPosition(null)
  }

  const toggleViewMenu = () => {
    setIsViewMenuOpen((open) => {
      const next = !open
      if (!next) {
        setViewDropdownPosition(null)
      }
      return next
    })
    setIsProfileMenuOpen(false)
    setProfileDropdownPosition(null)
  }

  const selectViewMode = (mode) => {
    setViewMode(mode)
    setIsViewMenuOpen(false)
    setViewDropdownPosition(null)
    if (mode === 'ay') {
      setActiveMonth(startOfMonth(selectedDate))
    }
  }

  const applyUnauthenticatedState = () => {
    setCurrentUser(null)
    setAuthStatus('unauthenticated')
    setIsApiConnected(false)
    setBungalows([])
    setCustomEvents([])
    setIsProfileMenuOpen(false)
    setIsViewMenuOpen(false)
    setProfileDropdownPosition(null)
    setViewDropdownPosition(null)
    setSelectedRightEventId('')
    setSelectedBungalowFilterId('')
  }

  const handleLoginSubmit = async (formEvent) => {
    formEvent.preventDefault()
    const email = loginEmail.trim().toLowerCase()
    const password = loginPassword

    if (!email || !password) {
      setLoginError('E-posta ve şifre zorunludur.')
      return
    }

    setIsLoginSubmitting(true)
    setLoginError('')

    try {
      const response = await requestApi('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      setCurrentUser(response.user ?? null)
      setAuthStatus('authenticated')
      setLoginPassword('')

      await syncRemoteData()
    } catch (error) {
      if (error?.status === 401) {
        setLoginError('E-posta veya şifre hatalı.')
      } else {
        setLoginError(getApiErrorMessage(error, 'Giriş işlemi tamamlanamadı.'))
      }
      applyUnauthenticatedState()
    } finally {
      setIsLoginSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await requestApi('/api/auth/logout', { method: 'POST' })
    } catch {
      // no-op: oturum state'i istemcide yine kapatılacak
    }

    setLoginPassword('')
    setLoginError('')
    applyUnauthenticatedState()
  }

  const openBungalowModal = () => {
    setIsEventModalOpen(false)
    setEditingEventId('')
    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setBungalowName('')
    setNightlyPrice('')
    setIsBungalowPinned(false)
    setIsBungalowModalOpen(true)
  }

  const openBungalowEditModal = (bungalowId) => {
    const bungalow = bungalows.find((item) => item.id === bungalowId)
    if (!bungalow) {
      return
    }

    setIsEventModalOpen(false)
    setEditingEventId('')
    setEditingBungalowId(bungalow.id)
    setIsBungalowDeleteConfirmOpen(false)
    setBungalowName(bungalow.name)
    setNightlyPrice(bungalow.price)
    setIsBungalowPinned(false)
    setIsBungalowModalOpen(true)
  }

  const closeBungalowModal = () => {
    setIsBungalowModalOpen(false)
    setIsBungalowPinned(false)
    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setBungalowName('')
    setNightlyPrice('')
  }

  const toggleBungalowPin = () => {
    setIsBungalowPinned((pinned) => !pinned)
  }

  const toggleRightPanel = () => {
    if (isPinnedBungalowEditorVisible) {
      setIsBungalowPinned(false)
      setIsBungalowModalOpen(false)
      setEditingBungalowId('')
      setIsBungalowDeleteConfirmOpen(false)
      setBungalowName('')
      setNightlyPrice('')
      setIsRightPanelOpen(false)
      return
    }
    setIsRightPanelOpen((open) => !open)
  }

  const toggleBungalowFilter = (bungalovId) => {
    setSelectedBungalowFilterId((current) => (current === bungalovId ? '' : bungalovId))
  }

  const openRightEventDetails = (sourceEventId) => {
    if (!sourceEventId) {
      return
    }

    setSelectedRightEventId(sourceEventId)
    if (isPinnedBungalowEditorVisible) {
      setIsBungalowPinned(false)
      setIsBungalowModalOpen(false)
      setEditingBungalowId('')
      setIsBungalowDeleteConfirmOpen(false)
      setBungalowName('')
      setNightlyPrice('')
    }
    setIsRightPanelOpen(true)
  }

  const handleEventPillClick = (eventData, mouseEvent) => {
    mouseEvent.stopPropagation()
    openRightEventDetails(eventData.sourceEventId ?? eventData.id)
  }

  const handleEventPillKeyDown = (eventData, keyboardEvent) => {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      openRightEventDetails(eventData.sourceEventId ?? eventData.id)
    }
  }

  const openEventModalForDate = (date) => {
    setIsBungalowModalOpen(false)
    setIsBungalowPinned(false)
    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setEditingEventId('')
    setIsEventModalOpen(true)
    const baseDate = toInputDate(date)
    setEventCheckIn(baseDate)
    setEventCheckOut(nextInputDate(baseDate))
    setEventDescription('')
    setEventCustomerName('')
    setEventBungalowId((currentId) => {
      if (currentId && bungalows.some((bungalov) => bungalov.id === currentId)) {
        return currentId
      }
      return bungalows[0]?.id ?? ''
    })
  }

  const openEventEditModal = (eventId) => {
    const event = customEvents.find((item) => item.id === eventId)
    if (!event) {
      return
    }

    setIsBungalowModalOpen(false)
    setIsBungalowPinned(false)
    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setEditingEventId(event.id)
    setIsEventModalOpen(true)
    setEventCustomerName(event.title)
    setEventCheckIn(event.checkIn)
    setEventCheckOut(event.checkOut)
    setEventDescription(event.description ?? '')
    setEventBungalowId((currentId) => {
      if (event.bungalowId && bungalows.some((bungalow) => bungalow.id === event.bungalowId)) {
        return event.bungalowId
      }
      if (currentId && bungalows.some((bungalow) => bungalow.id === currentId)) {
        return currentId
      }
      return bungalows[0]?.id ?? ''
    })
  }

  const openEventModal = () => {
    openEventModalForDate(selectedDate)
  }

  const handleCalendarCellDoubleClick = (day, mouseEvent) => {
    mouseEvent.preventDefault()
    mouseEvent.stopPropagation()
    pickDate(day)
    openEventModalForDate(day)
  }

  const closeEventModal = () => {
    setIsEventModalOpen(false)
    setEditingEventId('')
  }

  const isBungalowFormValid =
    bungalowName.trim().length > 0 && String(nightlyPrice).trim().length > 0

  const eventPillStyle = (event) =>
    event.color === 'custom'
      ? { '--event-bg': event.customColor, '--event-text': '#ffffff' }
      : undefined

  const monthSpanStyle = (segment) => ({
    '--month-span-bg': toSoftEventBackground(segment.color),
    '--month-span-color': segment.color,
    gridColumn: `${segment.startCol + 1} / ${segment.endCol + 1}`,
    gridRow: `${segment.trackIndex + 1}`,
  })

  const renderRightReservationItem = (eventData, keyPrefix = '') => {
    const reservation = resolveReservation(eventData)
    const sourceEventId = eventData.sourceEventId ?? reservation.id ?? eventData.id
    const accentColor = eventData.customColor ?? eventData.color ?? reservation.color

    return (
      <article
        key={`${keyPrefix}${eventData.id}`}
        className={`right-event-item is-clickable ${
          selectedRightEventId === sourceEventId ? 'is-selected' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={() => openRightEventDetails(sourceEventId)}
        onKeyDown={(keyboardEvent) =>
          handleEventPillKeyDown({ sourceEventId, id: sourceEventId }, keyboardEvent)
        }
      >
        <span
          className="right-event-accent"
          style={{ '--event-color': accentColor }}
          aria-hidden="true"
        />
        <div className="right-event-body">
          <p className="right-event-title">Müşteri: {reservation.title ?? '-'}</p>
          <p className="right-event-meta">Bungalov: {reservation.bungalowName ?? '-'}</p>
          <p className="right-event-meta">Giriş: {toReservationDateText(reservation.checkIn)}</p>
          <p className="right-event-meta">Çıkış: {toReservationDateText(reservation.checkOut)}</p>
        </div>
      </article>
    )
  }

  const saveBungalow = async () => {
    if (!isBungalowFormValid) {
      return
    }

    const trimmedName = bungalowName.trim()
    if (isApiConnected) {
      try {
        if (isEditingBungalow && editingBungalow) {
          await requestApi(`/api/bungalows/${editingBungalow.id}`, {
            method: 'PUT',
            body: {
              name: trimmedName,
              price: nightlyPrice,
              status: editingBungalow.status ?? 'aktif',
            },
          })
        } else {
          await requestApi('/api/bungalows', {
            method: 'POST',
            body: {
              name: trimmedName,
              price: nightlyPrice,
              status: 'aktif',
            },
          })
        }

        await syncRemoteData()
        setEditingBungalowId('')
        setIsBungalowDeleteConfirmOpen(false)
        setIsBungalowModalOpen(false)
        setIsBungalowPinned(false)
        setBungalowName('')
        setNightlyPrice('')
      } catch (error) {
        if (error?.status === 401) {
          applyUnauthenticatedState()
        }
        window.alert(getApiErrorMessage(error, 'Bungalov kaydedilemedi.'))
      }
      return
    }

    if (!canUseLocalDemoData()) {
      window.alert('Sunucu bağlantısı kurulamadı. İşlem için API erişimi gerekli.')
      return
    }

    if (isEditingBungalow && editingBungalow) {
      setBungalows((current) =>
        current.map((bungalow) =>
          bungalow.id === editingBungalow.id
            ? {
                ...bungalow,
                name: trimmedName,
                price: nightlyPrice,
              }
            : bungalow,
        ),
      )
      setCustomEvents((current) =>
        current.map((event) =>
          event.bungalowId === editingBungalow.id
            ? {
                ...event,
                bungalowName: trimmedName,
              }
            : event,
        ),
      )
    } else {
      setBungalows((current) => [
        ...current,
        {
          id: `bungalov-${Date.now()}`,
          name: trimmedName,
          price: nightlyPrice,
          status: 'aktif',
          color: createUniqueRandomBungalovColor(current),
        },
      ])
    }

    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setIsBungalowModalOpen(false)
    setIsBungalowPinned(false)
    setBungalowName('')
    setNightlyPrice('')
  }

  const openBungalowDeleteConfirm = () => {
    if (!isEditingBungalow || !editingBungalow || isEditingBungalowDeleteDisabled) {
      return
    }
    setIsBungalowDeleteConfirmOpen(true)
  }

  const closeBungalowDeleteConfirm = () => {
    setIsBungalowDeleteConfirmOpen(false)
  }

  const deleteBungalow = async () => {
    if (!isEditingBungalow || !editingBungalow || isEditingBungalowDeleteDisabled) {
      return
    }

    if (isApiConnected) {
      try {
        await requestApi(`/api/bungalows/${editingBungalow.id}`, {
          method: 'DELETE',
        })
        await syncRemoteData()
        setEditingBungalowId('')
        setIsBungalowDeleteConfirmOpen(false)
        setIsBungalowModalOpen(false)
        setIsBungalowPinned(false)
        setBungalowName('')
        setNightlyPrice('')
      } catch (error) {
        if (error?.status === 401) {
          applyUnauthenticatedState()
        }
        window.alert(getApiErrorMessage(error, 'Bungalov silinemedi.'))
      }
      return
    }

    if (!canUseLocalDemoData()) {
      window.alert('Sunucu bağlantısı kurulamadı. İşlem için API erişimi gerekli.')
      return
    }

    setBungalows((current) => current.filter((bungalow) => bungalow.id !== editingBungalow.id))
    setSelectedBungalowFilterId((current) => (current === editingBungalow.id ? '' : current))
    setEventBungalowId((current) => (current === editingBungalow.id ? '' : current))
    setEditingBungalowId('')
    setIsBungalowDeleteConfirmOpen(false)
    setIsBungalowModalOpen(false)
    setIsBungalowPinned(false)
    setBungalowName('')
    setNightlyPrice('')
  }

  const saveEvent = async () => {
    if (!isEventFormValid || !selectedEventBungalow) {
      return
    }
    const trimmedCustomerName = eventCustomerName.trim()
    const nextDescription = eventDescription.trim()

    if (isApiConnected) {
      try {
        let reservationId = ''
        if (isEditingEvent) {
          const response = await requestApi(`/api/reservations/${editingEventId}`, {
            method: 'PUT',
            body: {
              customerName: trimmedCustomerName,
              bungalowId: selectedEventBungalow.id,
              checkIn: eventCheckIn,
              checkOut: eventCheckOut,
              description: nextDescription,
            },
          })
          reservationId = response.reservation?.id ?? editingEventId
        } else {
          const response = await requestApi('/api/reservations', {
            method: 'POST',
            body: {
              customerName: trimmedCustomerName,
              bungalowId: selectedEventBungalow.id,
              checkIn: eventCheckIn,
              checkOut: eventCheckOut,
              description: nextDescription,
            },
          })
          reservationId = response.reservation?.id ?? ''
        }

        await syncRemoteData()
        if (reservationId) {
          setSelectedRightEventId(reservationId)
        }
        setIsEventModalOpen(false)
        setEditingEventId('')
        setEventCustomerName('')
        setEventDescription('')
      } catch (error) {
        if (error?.status === 401) {
          applyUnauthenticatedState()
        }
        window.alert(getApiErrorMessage(error, 'Rezervasyon kaydedilemedi.'))
      }
      return
    }

    if (!canUseLocalDemoData()) {
      window.alert('Sunucu bağlantısı kurulamadı. İşlem için API erişimi gerekli.')
      return
    }

    if (isEditingEvent) {
      setCustomEvents((current) =>
        current.map((event) =>
          event.id === editingEventId
            ? {
                ...event,
                title: trimmedCustomerName,
                color: selectedEventBungalow.color,
                bungalowId: selectedEventBungalow.id,
                bungalowName: selectedEventBungalow.name,
                checkIn: eventCheckIn,
                checkOut: eventCheckOut,
                description: nextDescription,
              }
            : event,
        ),
      )
      setSelectedRightEventId(editingEventId)
    } else {
      setCustomEvents((current) => [
        ...current,
        {
          id: `etkinlik-${Date.now()}`,
          title: trimmedCustomerName,
          color: selectedEventBungalow.color,
          bungalowId: selectedEventBungalow.id,
          bungalowName: selectedEventBungalow.name,
          checkIn: eventCheckIn,
          checkOut: eventCheckOut,
          description: nextDescription,
        },
      ])
    }

    setIsEventModalOpen(false)
    setEditingEventId('')
    setEventCustomerName('')
    setEventDescription('')
  }

  const bungalowEditor = (
    <>
      <header className="bungalov-modal-header">
        <h2>{isEditingBungalow ? 'Bungalov Düzenle' : 'Yeni Bungalov'}</h2>
        <div className="bungalov-modal-actions">
          <button
            type="button"
            className={`bungalov-icon-button ${isBungalowPinned ? 'active' : ''}`}
            onClick={toggleBungalowPin}
            aria-label="Sağa sabitle"
          >
            <DockRightIcon />
          </button>
          <button
            type="button"
            className="bungalov-icon-button"
            onClick={closeBungalowModal}
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
      </header>
      <div className="bungalov-modal-content">
        <label className="bungalov-field">
          <span>Bungalov Adı</span>
          <input
            type="text"
            value={bungalowName}
            onChange={(event) => setBungalowName(event.target.value)}
            placeholder="Bungalov adını girin"
          />
        </label>
        <label className="bungalov-field">
          <span>Gecelik Fiyat</span>
          <input
            type="number"
            min="0"
            value={nightlyPrice}
            onChange={(event) => setNightlyPrice(event.target.value)}
            placeholder="₺"
          />
        </label>
        <div className="bungalov-field">
          <span>Renk</span>
          <p className="bungalov-color-note">
            {isEditingBungalow
              ? 'Bungalov rengi, mevcut rezervasyonların tutarlılığı için düzenlemede sabit tutulur.'
              : 'Her bungalova otomatik ve benzersiz renk atanır.'}
          </p>
        </div>
        {isEditingBungalow && isEditingBungalowDeleteDisabled && (
          <p className="bungalov-delete-note">
            Bu bungalova bağlı rezervasyon olduğu için silme işlemi pasif.
          </p>
        )}
      </div>
      <footer className="bungalov-modal-footer">
        {isEditingBungalow && (
          <button
            type="button"
            className="bungalov-danger-button"
            onClick={openBungalowDeleteConfirm}
            disabled={isEditingBungalowDeleteDisabled}
          >
            Sil
          </button>
        )}
        <button type="button" className="bungalov-secondary-button" onClick={closeBungalowModal}>
          Vazgeç
        </button>
        <button
          type="button"
          className="bungalov-primary-button"
          disabled={!isBungalowFormValid}
          onClick={saveBungalow}
        >
          Kaydet
        </button>
      </footer>
    </>
  )

  const eventCreatorModal = (
    <>
      <header className="event-modal-header">
        <h2>{isEditingEvent ? 'Rezervasyon Düzenle' : 'Rezervasyon Oluştur'}</h2>
        <button
          type="button"
          className="event-icon-button"
          onClick={closeEventModal}
          aria-label="Kapat"
        >
          ×
        </button>
      </header>
      <div className="event-modal-content">
        <label className="event-field">
          <span>Müşteri Adı</span>
          <input
            type="text"
            value={eventCustomerName}
            onChange={(event) => setEventCustomerName(event.target.value)}
            placeholder="Müşteri adını girin"
          />
        </label>

        <div className="event-field-grid">
          <label className="event-field">
            <span>Giriş Tarihi</span>
            <input
              type="date"
              value={eventCheckIn}
              onChange={(event) => {
                const nextValue = event.target.value
                setEventCheckIn(nextValue)
                if (eventCheckOut && eventCheckOut <= nextValue) {
                  setEventCheckOut(nextInputDate(nextValue))
                }
              }}
            />
          </label>
          <label className="event-field">
            <span>Çıkış Tarihi</span>
            <input
              type="date"
              min={minimumEventCheckOut}
              value={eventCheckOut}
              onChange={(event) => setEventCheckOut(event.target.value)}
            />
          </label>
        </div>

        <label className="event-field">
          <span>Bungalov</span>
          <select
            value={eventBungalowId}
            onChange={(event) => setEventBungalowId(event.target.value)}
            disabled={bungalows.length === 0}
          >
            {bungalows.length === 0 ? (
              <option value="">Bungalov bulunamadı</option>
            ) : (
              <>
                <option value="" disabled>
                  Bungalov seçin
                </option>
                {bungalows.map((bungalov) => (
                  <option key={bungalov.id} value={bungalov.id}>
                    {bungalov.name}
                  </option>
                ))}
              </>
            )}
          </select>
          {bungalows.length === 0 && (
            <p className="event-field-note">
              Rezervasyon oluşturmak için önce sol alandan en az bir bungalov ekleyin.
            </p>
          )}
        </label>

        <label className="event-field">
          <span>Açıklama</span>
          <textarea
            value={eventDescription}
            onChange={(event) => setEventDescription(event.target.value)}
            placeholder="Rezervasyon açıklaması yazın"
            rows={4}
          />
        </label>
      </div>
      <footer className="event-modal-footer">
        <button type="button" className="event-secondary-button" onClick={closeEventModal}>
          Vazgeç
        </button>
        <button
          type="button"
          className="event-primary-button"
          onClick={saveEvent}
          disabled={!isEventFormValid}
        >
          Kaydet
        </button>
      </footer>
    </>
  )

  if (authStatus === 'loading') {
    return (
      <div className="auth-screen">
        <section className="auth-card" role="status" aria-live="polite">
          <h1>Aden | Rezervasyon Takvimi</h1>
          <p>Sistem yükleniyor...</p>
        </section>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <section className="auth-card" aria-label="Giriş Formu">
          <h1>Aden | Rezervasyon Takvimi</h1>
          <p>Devam etmek için giriş yapın.</p>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label className="auth-field">
              <span>E-posta</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="username"
                placeholder="admin@adenbungalov.com"
              />
            </label>
            <label className="auth-field">
              <span>Şifre</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            {loginError && <p className="auth-error">{loginError}</p>}
            <button type="submit" className="auth-submit" disabled={isLoginSubmitting}>
              {isLoginSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className={`calendar-shell ${isSidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={toggleSidebar}
          aria-label="Kenar çubuğunu kapat"
        />
      )}
      <aside className={`left-sidebar ${isSidebarOpen ? '' : 'hidden'}`}>
        <div className="sidebar-top">
          <Tooltip label={sidebarToggleTooltip} align="start">
            <button
              type="button"
              className="icon-button"
              onClick={toggleSidebar}
              aria-label={sidebarToggleTooltip}
            >
              <SidebarIcon />
            </button>
          </Tooltip>
          <div className="sidebar-actions">
            <Tooltip label={searchToggleTooltip} align="end">
              <button
                type="button"
                className={`icon-button ${isSearchOpen ? 'active' : ''}`}
                onClick={toggleSearch}
                aria-label={searchToggleTooltip}
                aria-expanded={isSearchOpen}
              >
                <SearchIcon />
              </button>
            </Tooltip>
            <Tooltip label="Rezervasyon Oluştur" align="end">
              <button
                type="button"
                className={`icon-button ${isEventModalOpen ? 'active' : ''}`}
                aria-label="Rezervasyon Oluştur"
                aria-expanded={isEventModalOpen}
                onClick={openEventModal}
              >
                <EditIcon />
              </button>
            </Tooltip>
          </div>
        </div>

        {isSearchOpen && (
          <div className="sidebar-search-wrap">
            <input
              ref={searchInputRef}
              className="sidebar-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rezervasyon ara"
              type="search"
            />
            {searchTerm && (
              <button className="search-clear" type="button" onClick={clearSearch}>
                ×
              </button>
            )}
          </div>
        )}

        <section className="mini-calendar">
          <div className="mini-nav">
            <button
              type="button"
              className="icon-button mini-nav-button"
              onClick={() => changeMonth(-1)}
              aria-label="Önceki ay"
            >
              <ChevronUpIcon />
            </button>
            <button
              type="button"
              className="icon-button mini-nav-button"
              onClick={() => changeMonth(1)}
              aria-label="Sonraki ay"
            >
              <ChevronDownIcon />
            </button>
          </div>
          <div className="mini-week-row">
            {MINI_WEEK_DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mini-grid">
            {monthGrid.flat().map((day) => {
              const dayKey = toDateKey(day)
              const outside = !isSameMonth(day, activeMonth)
              const selected = hasDateSelection && isSameDate(day, selectedDate)
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => pickDate(day)}
                  className={`mini-day ${outside ? 'outside' : ''} ${selected ? 'selected' : ''}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </section>

        <button
          type="button"
          className="task-row task-row-button"
          onClick={openBungalowModal}
          aria-label="Yeni Bungalov Ekle"
        >
          <span className="task-plus">＋</span>
          <span>Yeni Bungalov Ekle</span>
        </button>

        {bungalows.length > 0 && (
          <div className="bungalov-list" aria-label="Bungalov listesi">
            {bungalows.map((bungalov) => (
              <div key={bungalov.id} className="bungalov-list-row">
                <button
                  type="button"
                  className={`bungalov-list-item ${selectedBungalowFilterId === bungalov.id ? 'is-active' : ''}`}
                  onClick={() => toggleBungalowFilter(bungalov.id)}
                  aria-pressed={selectedBungalowFilterId === bungalov.id}
                  title={
                    selectedBungalowFilterId === bungalov.id
                      ? 'Filtreyi kaldır'
                      : `${bungalov.name} rezervasyonlarını filtrele`
                  }
                >
                  <span
                    className="bungalov-list-color"
                    style={{ '--bungalov-color': bungalov.color }}
                    aria-hidden="true"
                  />
                  <span className="bungalov-list-name">{bungalov.name}</span>
                </button>
                <Tooltip label="Bungalovu Düzenle" align="end">
                  <button
                    type="button"
                    className="bungalov-list-edit"
                    onClick={() => openBungalowEditModal(bungalov.id)}
                    aria-label={`${bungalov.name} düzenle`}
                  >
                    <EditIcon />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="main-calendar">
        <header className="main-toolbar">
          <div className="main-toolbar-left">
            {!isSidebarOpen && (
              <Tooltip label={sidebarToggleTooltip} align="start">
                <button
                  type="button"
                  className="icon-button icon-button-visible"
                  onClick={toggleSidebar}
                  aria-label={sidebarToggleTooltip}
                >
                  <SidebarIcon />
                </button>
              </Tooltip>
            )}
          </div>
          <div className="main-toolbar-right">
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="avatar-button"
                onClick={toggleProfileMenu}
                aria-label="Profil menüsü"
                aria-expanded={isProfileMenuOpen}
              >
                {avatarLabel}
              </button>
              {isProfileMenuOpen &&
                profileDropdownPosition &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={profileDropdownRef}
                    className="profile-dropdown profile-dropdown-portal"
                    role="menu"
                    aria-label="Profil menüsü"
                    style={profileDropdownPosition}
                  >
                    <button type="button" className="profile-item" role="menuitem">
                      Hesabım
                    </button>
                    <button type="button" className="profile-item" role="menuitem">
                      Ayarlar
                    </button>
                    <button
                      type="button"
                      className="profile-item profile-item-danger"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      Çıkış
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <div className="view-menu" ref={viewMenuRef}>
              <button
                type="button"
                className="toolbar-pill toolbar-pill-view"
                onClick={toggleViewMenu}
                aria-label="Görünüm seçimi"
                aria-expanded={isViewMenuOpen}
              >
                {viewLabel} <ChevronDownIcon />
              </button>
              {isViewMenuOpen &&
                viewDropdownPosition &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={viewDropdownRef}
                    className="view-dropdown view-dropdown-portal"
                    role="menu"
                    aria-label="Görünüm menüsü"
                    style={viewDropdownPosition}
                  >
                    <button
                      type="button"
                      className={`view-item ${viewMode === 'gün' ? 'selected' : ''}`}
                      role="menuitemradio"
                      aria-checked={viewMode === 'gün'}
                      onClick={() => selectViewMode('gün')}
                    >
                      <span className="view-checkmark">{viewMode === 'gün' ? '✓' : ''}</span>
                      <span className="view-item-main">Gün</span>
                    </button>
                    <button
                      type="button"
                      className={`view-item ${viewMode === 'hafta' ? 'selected' : ''}`}
                      role="menuitemradio"
                      aria-checked={viewMode === 'hafta'}
                      onClick={() => selectViewMode('hafta')}
                    >
                      <span className="view-checkmark">{viewMode === 'hafta' ? '✓' : ''}</span>
                      <span className="view-item-main">Hafta</span>
                    </button>
                    <button
                      type="button"
                      className={`view-item ${viewMode === 'ay' ? 'selected' : ''}`}
                      role="menuitemradio"
                      aria-checked={viewMode === 'ay'}
                      onClick={() => selectViewMode('ay')}
                    >
                      <span className="view-checkmark">{viewMode === 'ay' ? '✓' : ''}</span>
                      <span className="view-item-main">Ay</span>
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <Tooltip label="Bugüne Git">
              <button type="button" className="toolbar-pill" onClick={goToday} aria-label="Bugüne Git">
                Bugün
              </button>
            </Tooltip>
            <Tooltip label={previousPeriodTooltip}>
              <button
                type="button"
                className="toolbar-nav"
                onClick={() => changePeriod(-1)}
                aria-label={previousPeriodTooltip}
              >
                <ChevronUpIcon />
              </button>
            </Tooltip>
            <Tooltip label={nextPeriodTooltip}>
              <button
                type="button"
                className="toolbar-nav"
                onClick={() => changePeriod(1)}
                aria-label={nextPeriodTooltip}
              >
                <ChevronDownIcon />
              </button>
            </Tooltip>
            <Tooltip label={rightPanelTooltip} align="end">
              <button
                type="button"
                className={`toolbar-nav ${isRightPanelVisible ? 'active' : ''}`}
                onClick={toggleRightPanel}
                aria-label={rightPanelTooltip}
              >
                <DockRightIcon />
              </button>
            </Tooltip>
          </div>
        </header>

        <div
          className={`calendar-content-shell ${
            isRightPanelVisible ? 'with-right-editor' : ''
          }`}
        >
          <section className="calendar-section">
            <h1 className="calendar-title">{pageTitle}</h1>

            {viewMode === 'ay' && (
              <div className="calendar-scroll">
                <div className="calendar-grid-wrap">
                  <div className="week-header">
                    {WEEK_DAYS.map((weekDay, index) => (
                      <span
                        key={weekDay}
                        className={hasDateSelection && index === selectedWeekday ? 'active' : ''}
                      >
                        {weekDay}
                      </span>
                    ))}
                  </div>

                  <div className="month-grid">
                    {monthGrid.map((weekDays, weekIndex) => {
                      const weekSpanData = monthWeekSpans[weekIndex] ?? { trackCount: 0, segments: [] }
                      const visibleSegments = weekSpanData.segments.filter(
                        (segment) => segment.trackIndex < MAX_VISIBLE_EVENTS_IN_MONTH_DAY,
                      )
                      const hiddenSegments = weekSpanData.segments.filter(
                        (segment) => segment.trackIndex >= MAX_VISIBLE_EVENTS_IN_MONTH_DAY,
                      )

                      return (
                        <div
                          key={toDateKey(weekDays[0])}
                          className={`month-week-row ${visibleSegments.length > 0 ? 'has-span-events' : ''}`}
                        >
                          {weekDays.map((day, dayIndex) => {
                            const dayKey = toDateKey(day)
                            const outside = !isSameMonth(day, activeMonth)
                            const isSelected = hasDateSelection && isSameDate(day, selectedDate)
                            const isToday = isSameDate(day, todayDate)
                            const holidayLabel = OFFICIAL_HOLIDAYS[dayKey] ?? null
                            const isHoliday = Boolean(holidayLabel) && !outside
                            const singleDayEvents = (eventsByDate[dayKey] ?? []).filter(
                              (event) => event.durationDays <= 1,
                            )
                            const visibleSpanCount = visibleSegments.filter(
                              (segment) => segment.startCol <= dayIndex && segment.endCol > dayIndex,
                            ).length
                            const hiddenSpanCount = hiddenSegments.filter(
                              (segment) => segment.startCol <= dayIndex && segment.endCol > dayIndex,
                            ).length
                            const remainingSlots = Math.max(
                              0,
                              MAX_VISIBLE_EVENTS_IN_MONTH_DAY - visibleSpanCount,
                            )
                            const visibleSingleDayEvents = singleDayEvents.slice(0, remainingSlots)
                            const hiddenSingleDayCount = Math.max(
                              0,
                              singleDayEvents.length - visibleSingleDayEvents.length,
                            )
                            const hiddenEventsCount = hiddenSpanCount + hiddenSingleDayCount
                            const dayLabel =
                              day.getDate() === 1 && outside
                                ? monthDayFormatter.format(day)
                                : day.getDate()

                            return (
                              <article
                                key={dayKey}
                                className={`month-cell ${outside ? 'outside' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => pickDate(day, { openPanelOnEvents: true })}
                                onDoubleClick={(mouseEvent) => handleCalendarCellDoubleClick(day, mouseEvent)}
                              >
                                {isHoliday ? (
                                  <Tooltip label={holidayLabel}>
                                    <span className={`cell-day ${isToday ? 'today' : ''} holiday`}>
                                      {dayLabel}
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className={`cell-day ${isToday ? 'today' : ''}`}>{dayLabel}</span>
                                )}
                                <div className="month-cell-events">
                                  {visibleSingleDayEvents.map((event) => (
                                    <span
                                      key={event.id}
                                      className={`event-pill ${event.color} is-clickable`}
                                      style={eventPillStyle(event)}
                                      role="button"
                                      tabIndex={0}
                                      onClick={(mouseEvent) => handleEventPillClick(event, mouseEvent)}
                                      onKeyDown={(keyboardEvent) => handleEventPillKeyDown(event, keyboardEvent)}
                                    >
                                      {event.title}
                                    </span>
                                  ))}
                                  {hiddenEventsCount > 0 && (
                                    <span className="event-pill more-events-pill">+{hiddenEventsCount} rezervasyon</span>
                                  )}
                                </div>
                              </article>
                            )
                          })}

                          {visibleSegments.length > 0 && (
                            <div className="month-span-layer">
                              {visibleSegments.map((segment) => (
                                <span
                                  key={`${segment.id}-${segment.trackIndex}-${segment.startCol}`}
                                  className={`month-span-event ${
                                    segment.startsThisWeek ? '' : 'trim-left'
                                  } ${segment.endsThisWeek ? '' : 'trim-right'}`}
                                  style={monthSpanStyle(segment)}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(mouseEvent) => handleEventPillClick(segment, mouseEvent)}
                                  onKeyDown={(keyboardEvent) => handleEventPillKeyDown(segment, keyboardEvent)}
                                >
                                  {segment.startsThisWeek ? segment.title : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'hafta' && (
              <div className="calendar-scroll">
                <div className="week-view">
                  {weekDays.map((day) => {
                    const dayEvents = eventsByDate[toDateKey(day)] ?? []
                    const isToday = isSameDate(day, todayDate)
                    const dayHolidayLabel = OFFICIAL_HOLIDAYS[toDateKey(day)] ?? null
                    const isHoliday = Boolean(dayHolidayLabel)
                    return (
                      <article
                        key={toDateKey(day)}
                        className={`week-day ${hasDateSelection && isSameDate(day, selectedDate) ? 'selected' : ''}`}
                        onClick={() => pickDate(day, { openPanelOnEvents: true })}
                        onDoubleClick={(mouseEvent) => handleCalendarCellDoubleClick(day, mouseEvent)}
                      >
                        <div className="week-day-head">
                          <span className="week-day-name">{WEEK_DAYS[day.getDay()]}</span>
                          {isHoliday ? (
                            <Tooltip label={dayHolidayLabel}>
                              <span className={`week-day-number ${isToday ? 'today' : ''} holiday`}>
                                {day.getDate()}
                              </span>
                            </Tooltip>
                          ) : (
                            <span className={`week-day-number ${isToday ? 'today' : ''}`}>
                              {day.getDate()}
                            </span>
                          )}
                        </div>
                        <div className="week-day-events">
                          {dayEvents.length > 0 ? (
                            dayEvents.map((event) => (
                              <span
                                key={event.id}
                                className={`event-pill ${event.color} is-clickable`}
                                style={eventPillStyle(event)}
                                role="button"
                                tabIndex={0}
                                onClick={(mouseEvent) => handleEventPillClick(event, mouseEvent)}
                                onKeyDown={(keyboardEvent) => handleEventPillKeyDown(event, keyboardEvent)}
                              >
                                {event.title}
                              </span>
                            ))
                          ) : (
                            <span className="week-day-empty">Boş</span>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            )}

            {viewMode === 'gün' && (
              <div className="calendar-scroll">
                <div
                  className="day-view"
                  onDoubleClick={(mouseEvent) => handleCalendarCellDoubleClick(selectedDate, mouseEvent)}
                >
                  <div className="day-view-head">
                    <span className="day-view-weekday">{WEEK_DAYS[selectedDate.getDay()]}</span>
                    {selectedHolidayLabel ? (
                      <Tooltip label={selectedHolidayLabel}>
                        <span
                          className={`day-view-number ${isSameDate(selectedDate, todayDate) ? 'today' : ''} holiday`}
                        >
                          {selectedDate.getDate()}
                        </span>
                      </Tooltip>
                    ) : (
                      <span className={`day-view-number ${isSameDate(selectedDate, todayDate) ? 'today' : ''}`}>
                        {selectedDate.getDate()}
                      </span>
                    )}
                  </div>
                  <div className="day-view-events">
                    {selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((event) => (
                        <div key={event.id} className="day-view-item">
                          <span
                            className={`event-pill ${event.color} is-clickable`}
                            style={eventPillStyle(event)}
                            role="button"
                            tabIndex={0}
                            onClick={(mouseEvent) => handleEventPillClick(event, mouseEvent)}
                            onKeyDown={(keyboardEvent) => handleEventPillKeyDown(event, keyboardEvent)}
                          >
                            {event.title}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="day-view-empty">Bu gün için rezervasyon yok.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {isPinnedBungalowEditorVisible && (
            <aside
              className="bungalov-side-editor"
              role="dialog"
              aria-label={isEditingBungalow ? 'Bungalov Düzenle' : 'Yeni Bungalov'}
            >
              {bungalowEditor}
            </aside>
          )}
          {!isPinnedBungalowEditorVisible && isRightPanelOpen && (
            <aside className="right-events-panel" aria-label="Yaklaşan Rezervasyonlar">
              <div className="right-events-content">
                {selectedRightEvent && (
                  <section className="right-event-detail" aria-label="Rezervasyon Detayı">
                    <header className="right-event-detail-header">
                      <h3>Rezervasyon Detayı</h3>
                      <div className="right-event-detail-actions">
                        <Tooltip label="Rezervasyonu Düzenle" align="end">
                          <button
                            type="button"
                            className="right-event-detail-edit"
                            onClick={() => openEventEditModal(selectedRightEvent.id)}
                            aria-label="Rezervasyonu düzenle"
                          >
                            <EditIcon />
                          </button>
                        </Tooltip>
                        <button
                          type="button"
                          className="right-event-detail-close"
                          onClick={() => setSelectedRightEventId('')}
                          aria-label="Rezervasyon detayını kapat"
                        >
                          ×
                        </button>
                      </div>
                    </header>
                    <div className="right-event-detail-content">
                      <div className="right-event-detail-row">
                        <span className="right-event-detail-label">Müşteri Adı</span>
                        <p>{selectedRightEvent.title}</p>
                      </div>
                      <div className="right-event-detail-row">
                        <span className="right-event-detail-label">Bungalov Adı</span>
                        <p>{selectedRightEvent.bungalowName || '-'}</p>
                      </div>
                      <div className="right-event-detail-row">
                        <span className="right-event-detail-label">Giriş Tarihi</span>
                        <p>{selectedRightEventCheckInText}</p>
                      </div>
                      <div className="right-event-detail-row">
                        <span className="right-event-detail-label">Çıkış Tarihi</span>
                        <p>{selectedRightEventCheckOutText}</p>
                      </div>
                      <div className="right-event-detail-row">
                        <span className="right-event-detail-label">Açıklama</span>
                        <p>{selectedRightEvent.description || '-'}</p>
                      </div>
                    </div>
                  </section>
                )}
                {hasDateSelection && (
                  <section className="right-events-group" aria-label="Seçili Gün Rezervasyonları">
                    <h3 className="right-events-group-title">{selectedPanelDateTitle}</h3>
                    {selectedPanelDayEvents.length > 0 ? (
                      <div className="right-events-list">
                        {selectedPanelDayEvents.map((event) => renderRightReservationItem(event, 'selected-day-'))}
                      </div>
                    ) : (
                      <p className="right-events-empty">Bu gün için rezervasyon bulunamadı.</p>
                    )}
                  </section>
                )}
                <section className="right-events-group" aria-label="Yaklaşan Rezervasyonlar">
                  <h3 className="right-events-group-title">Yaklaşan Rezervasyonlar</h3>
                  {upcomingReservationGroups.length > 0 ? (
                    upcomingReservationGroups.map((group) => (
                      <section key={`upcoming-${group.dateKey}`} className="right-events-subgroup">
                        <h4 className="right-events-subgroup-title">{group.title}</h4>
                        <div className="right-events-list">
                          {group.events.map((event) => renderRightReservationItem(event, 'upcoming-'))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <p className="right-events-empty">Yaklaşan rezervasyon bulunamadı.</p>
                  )}
                </section>
                <section className="right-events-group" aria-label="Giriş Yapacaklar">
                  <h3 className="right-events-group-title">Giriş Yapacaklar</h3>
                  {checkInReservationGroups.length > 0 ? (
                    checkInReservationGroups.map((group) => (
                      <section key={`checkin-${group.dateKey}`} className="right-events-subgroup">
                        <h4 className="right-events-subgroup-title">{group.title}</h4>
                        <div className="right-events-list">
                          {group.events.map((event) => renderRightReservationItem(event, 'checkin-'))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <p className="right-events-empty">Planlanan giriş rezervasyonu bulunamadı.</p>
                  )}
                </section>
                <section className="right-events-group" aria-label="Çıkış Yapacaklar">
                  <h3 className="right-events-group-title">Çıkış Yapacaklar</h3>
                  {checkOutReservationGroups.length > 0 ? (
                    checkOutReservationGroups.map((group) => (
                      <section key={`checkout-${group.dateKey}`} className="right-events-subgroup">
                        <h4 className="right-events-subgroup-title">{group.title}</h4>
                        <div className="right-events-list">
                          {group.events.map((event) => renderRightReservationItem(event, 'checkout-'))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <p className="right-events-empty">Planlanan çıkış rezervasyonu bulunamadı.</p>
                  )}
                </section>
              </div>
            </aside>
          )}
        </div>

        {isBungalowModalOpen && !isBungalowPinned && (
          <>
            <button
              type="button"
              className="bungalov-backdrop"
              onClick={closeBungalowModal}
              aria-label="Modalı kapat"
            />
            <section
              className="bungalov-floating-modal"
              role="dialog"
              aria-label={isEditingBungalow ? 'Bungalov Düzenle' : 'Yeni Bungalov'}
            >
              {bungalowEditor}
            </section>
          </>
        )}
        {isEventModalOpen && (
          <>
            <button
              type="button"
              className="event-backdrop"
              onClick={closeEventModal}
              aria-label="Rezervasyon modalını kapat"
            />
            <section
              className="event-floating-modal"
              role="dialog"
              aria-label={isEditingEvent ? 'Rezervasyon Düzenle' : 'Rezervasyon Oluştur'}
            >
              {eventCreatorModal}
            </section>
          </>
        )}
        {isBungalowDeleteConfirmOpen && (
          <>
            <button
              type="button"
              className="confirm-backdrop"
              onClick={closeBungalowDeleteConfirm}
              aria-label="Silme onay penceresini kapat"
            />
            <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-label="Bungalov Sil">
              <h3 className="confirm-modal-title">Bungalov silinsin mi?</h3>
              <p className="confirm-modal-text">
                <strong>{editingBungalow?.name ?? 'Seçili bungalov'}</strong> kaydı silinecek. Bu
                işlem geri alınamaz.
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="confirm-secondary-button"
                  onClick={closeBungalowDeleteConfirm}
                >
                  Vazgeç
                </button>
                <button type="button" className="confirm-danger-button" onClick={deleteBungalow}>
                  Sil
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
