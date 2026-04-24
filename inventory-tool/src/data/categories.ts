import type { Category, TenantInfo } from '../types/inventory'

export const categories: Category[] = [
  {
    id: 'bedrooms',
    name: 'Bedrooms',
    emoji: '🛏️',
    items: ['King Bed (frame + mattress)', 'Queen Bed (frame + mattress)', 'Double Bed (frame + mattress)', 'Single Bed (frame + mattress)', 'Bedside Table', 'Tallboy / Dresser', 'Wardrobe (freestanding)', 'Mirror (large)', 'Blanket Box', 'Cot / Baby Bed', 'TV (bedroom)', 'TV Stand (bedroom)'],
  },
  {
    id: 'lounge',
    name: 'Lounge & Living',
    emoji: '🛋️',
    items: ['3-Seater Sofa', '2-Seater Sofa', 'Armchair / Recliner', 'Sofa Bed', 'Coffee Table', 'TV Unit / Entertainment Unit', 'TV (main)', 'Bookcase / Shelving Unit', 'Display Cabinet', 'Side Table', 'Rug (large)', 'Floor Lamp', 'Bar Fridge'],
  },
  {
    id: 'dining',
    name: 'Dining',
    emoji: '🍽️',
    items: ['Dining Table (6+ seater)', 'Dining Table (4 seater)', 'Dining Chairs', 'Bar Stools', 'Buffet / Sideboard', 'China Cabinet / Hutch'],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    emoji: '🍳',
    items: ['Fridge (large, French door)', 'Fridge (medium)', 'Washing Machine', 'Dryer', 'Dishwasher', 'Microwave', 'Small Appliances (box)', 'Bar Fridge / Wine Fridge'],
  },
  {
    id: 'office',
    name: 'Home Office',
    emoji: '💼',
    items: ['Desk (large)', 'Desk (small)', 'Office Chair', 'Filing Cabinet (2-drawer)', 'Filing Cabinet (4-drawer)', 'Bookcase', 'Desktop Computer + Monitor', 'Printer', 'Safe (small)'],
  },
  {
    id: 'garage',
    name: 'Garage & Outdoor',
    emoji: '🏡',
    items: ['Workbench', 'Tool Cabinet', 'Ride-on Lawnmower', 'Petrol Lawnmower', 'Garden Shed (flatpack)', 'Outdoor Table + Chairs (6-seater)', 'BBQ (large)', 'Bikes', 'Surfboard / Paddleboard', 'Kayak / Canoe', 'Trailer (if on property)'],
  },
  {
    id: 'special',
    name: 'Special Items',
    emoji: '⚠️',
    items: ['Upright Piano', 'Grand Piano', 'Pool Table', 'Spa / Hot Tub', 'Antique / High-value Furniture', 'Safe (large)', 'Gym Equipment (per piece)', 'Large Aquarium', 'Trampoline'],
  },
  {
    id: 'boxes',
    name: 'Boxes & Packing',
    emoji: '📦',
    items: ['Small Box (books, heavy items)', 'Medium Box', 'Large Box', 'Wardrobe Box (hanging clothes)', 'Picture / Mirror Box', 'Plastic Storage Tub'],
  },
]

export const mockTenant: TenantInfo = {
  name: 'MoverHero Removals',
  primaryColor: '#1a56db',
  phone: '1300 123 456',
  email: 'hello@moverhero.com.au',
}
