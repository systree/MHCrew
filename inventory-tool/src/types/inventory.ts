export interface InventoryItem {
  name: string
  quantity: number
}

export interface Category {
  id: string
  name: string
  emoji: string
  items: string[]
}

export interface TenantInfo {
  name: string
  logo?: string
  primaryColor: string
  phone: string
  email: string
}
