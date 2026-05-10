export type AppRole = 'super_admin' | 'manager'

export type AppUser = {
  id: string
  pin: string
  name: string
  role: AppRole
}
