export type ActivityLogEntry = {
  id: string
  restaurantId: string
  actorPin: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  details: string
  createdAt: string
}

export type ActivityLogPayload = {
  actorPin: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  details: string
}
