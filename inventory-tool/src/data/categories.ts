import type { Category, TenantInfo } from '../types/inventory'

// NOTE: Catalog is tuned for the Australian residential removals market
// (room names, appliances, and outdoor items reflect typical AU households —
// e.g. separate laundry, Hills Hoist clothesline, chest freezer, King Single bed).
// Per-item volumes used for the m³ estimate live in `dimensions.ts` and are keyed
// by the exact item name strings below — keep the two files in sync.

export const categories: Category[] = [
  {
    id: 'bedrooms',
    name: 'Bedrooms',
    emoji: '🛏️',
    items: ['King Bed (frame + mattress)', 'Queen Bed (frame + mattress)', 'Double Bed (frame + mattress)', 'King Single Bed (frame + mattress)', 'Single Bed (frame + mattress)', 'Bunk Bed', 'Mattress (spare)', 'Bedside Table', 'Tallboy / Dresser', 'Wardrobe (freestanding)', 'Mirror (large)', 'Blanket Box', 'Cot / Baby Bed', 'Change Table', 'TV (bedroom)', 'TV Stand (bedroom)'],
  },
  {
    id: 'lounge',
    name: 'Lounge & Living',
    emoji: '🛋️',
    items: ['3-Seater Sofa', '2-Seater Sofa', 'Armchair / Recliner', 'Sofa Bed', 'Ottoman / Footstool', 'Coffee Table', 'TV Unit / Entertainment Unit', 'TV (main)', 'Bookcase / Shelving Unit', 'Display Cabinet', 'Side Table', 'Rug (large)', 'Floor Lamp', 'Pedestal / Standing Fan', 'Portable Air Conditioner', 'Bar Fridge'],
  },
  {
    id: 'dining',
    name: 'Dining',
    emoji: '🍽️',
    items: ['Dining Table (6+ seater)', 'Dining Table (4 seater)', 'Dining Chairs', 'Bar Stools', 'High Chair', 'Buffet / Sideboard', 'China Cabinet / Hutch'],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    emoji: '🍳',
    items: ['Fridge (large, French door)', 'Fridge (medium)', 'Chest Freezer', 'Upright Freezer', 'Dishwasher', 'Microwave', 'Small Appliances (box)', 'Bar Fridge / Wine Fridge'],
  },
  {
    id: 'laundry',
    name: 'Laundry',
    emoji: '🧺',
    items: ['Washing Machine', 'Dryer', 'Laundry Trough (freestanding)', 'Ironing Board', 'Clothes Airer / Horse', 'Laundry Hamper / Basket', 'Vacuum Cleaner'],
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
    items: ['Workbench', 'Tool Cabinet', 'Garage Shelving Unit', 'Ride-on Lawnmower', 'Petrol Lawnmower', 'Whipper Snipper / Line Trimmer', 'Garden Tools (bundle)', 'Wheelbarrow', 'Ladder (extension)', 'Garden Shed (flatpack)', 'Clothesline (Hills Hoist / folding)', 'Outdoor Table + Chairs (6-seater)', 'Outdoor Lounge Setting', 'BBQ (large)', 'Pot Plants (large)', 'Esky / Camping Gear', 'Bikes', 'Surfboard / Paddleboard', 'Kayak / Canoe', 'Pram / Stroller', 'Kids Play Equipment (swing set / cubby)', 'Trailer (if on property)'],
  },
  {
    id: 'special',
    name: 'Special Items',
    emoji: '⚠️',
    items: ['Upright Piano', 'Grand Piano', 'Pool Table', 'Spa / Hot Tub', 'Treadmill', 'Exercise Bike', 'Antique / High-value Furniture', 'Safe (large)', 'Gym Equipment (per piece)', 'Large Aquarium', 'Trampoline'],
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
