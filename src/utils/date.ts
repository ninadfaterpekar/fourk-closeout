const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const formatDisplayDate = (dateValue: string) => {
  const parsed = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateValue

  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const year = String(parsed.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

export const getDayOfWeek = (dateValue: string) => {
  const parsed = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return DAY_NAMES[parsed.getDay()] ?? ''
}

export const formatDateTimeShort = (isoDateTime: string) => {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return isoDateTime

  const datePart = formatDisplayDate(parsed.toISOString().slice(0, 10))
  const timePart = parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

export const getIsoDateToday = () => new Date().toISOString().slice(0, 10)

export const getCurrentShiftFromLocalTime = (): 'Lunch' | 'Dinner' => {
  const now = new Date()
  return now.getHours() >= 17 ? 'Dinner' : 'Lunch'
}

export const getWeekBounds = (dateValue: string) => {
  const base = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    return { start: dateValue, end: dateValue }
  }

  const start = new Date(base)
  const weekday = start.getDay()
  start.setDate(start.getDate() - weekday)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export const isDateWithinBounds = (dateValue: string, startInclusive: string, endInclusive: string) => {
  return dateValue >= startInclusive && dateValue <= endInclusive
}
