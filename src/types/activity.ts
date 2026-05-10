export type ActivityLogEntry = {
  id: string
  restaurantId: string
  actorPin: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string | null
  details: unknown
  createdAt: string
}

export type ActivityLogPayload = {
  actorPin: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string | null
  details: unknown
}
