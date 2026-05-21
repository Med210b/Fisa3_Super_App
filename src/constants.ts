export const SUPER_ADMIN_EMAILS = [
  'mohamedbentaher66@gmail.com',
  'contact@mapstonegroup.com',
  'hammami.fathi@gmail.co.com'
];

export const RIDER_EMAILS = [
  'mohamedbentaher750@gmail.com'
];

export const MERCHANT_EMAILS = [
  'mohamedbentaher250@gmail.com'
];

export const BRAND = {
  name: 'FISA3',
  logo: 'https://i.postimg.cc/dVRk1LMd/2d77e515-97aa-465c-b2b6-b3619bcb7913.png',
  colors: {
    primary: '#E60023',
    secondary: '#000000',
    white: '#FFFFFF',
    gray: '#F3F4F6'
  }
};

export const TUNISIA_REGIONS = [
  { name: 'Tunis', coords: { lat: 36.8065, lng: 10.1815 } },
  { name: 'Sousse', coords: { lat: 35.8256, lng: 10.6369 } },
  { name: 'Sfax', coords: { lat: 34.7478, lng: 10.7661 } },
  { name: 'Ariana', coords: { lat: 36.8665, lng: 10.1930 } },
  { name: 'Ben Arous', coords: { lat: 36.7531, lng: 10.2222 } }
];

export const CATEGORIES = [
  { id: 'food', name: 'Cuisine', icon: 'Utensils', color: '#E60023' },
  { id: 'grocery', name: 'Épicerie', icon: 'ShoppingBag', color: '#10B981' },
  { id: 'mart', name: 'Supérette', icon: 'Zap', color: '#F59E0B' },
  { id: 'pharmacy', name: 'Pharmacie', icon: 'PlusCircle', color: '#3B82F6' },
  { id: 'electronics', name: 'Électronique', icon: 'Monitor', color: '#8B5CF6' },
  { id: 'fashion', name: 'Mode', icon: 'Shirt', color: '#EC4899' }
];

export const MOCK_STORES = [
  {
    id: 's1',
    name: 'Burger King Tunis',
    type: 'FOOD',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80',
    address: 'Lac 2, Tunis',
    location: { lat: 36.8450, lng: 10.2700 },
    merchantId: 'm1',
    status: 'OPEN',
    deliveryTime: '20-30 min',
    deliveryFee: 3.5
  },
  {
    id: 's2',
    name: 'Carrefour Market',
    type: 'GROCERY',
    rating: 4.2,
    image: 'https://i.postimg.cc/qRy5jpqp/4323573f-4f33-400e-b7e7-b7a6dd9de4b4.png',
    address: 'Sidi Daoud, Marsa',
    location: { lat: 36.8580, lng: 10.3100 },
    merchantId: 'm2',
    status: 'OPEN',
    deliveryTime: '15-25 min',
    deliveryFee: 5.0
  },
  {
    id: 's3',
    name: 'Samsung Official Store',
    type: 'ELECTRONICS',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80',
    address: 'Manar 2, Tunis',
    location: { lat: 36.8280, lng: 10.1550 },
    merchantId: 'm3',
    status: 'OPEN',
    deliveryTime: 'Same Day',
    deliveryFee: 15.0
  },
  {
    id: 's4',
    name: 'Pizza Hut Sousse',
    type: 'FOOD',
    rating: 4.3,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
    address: 'Kantaoui, Sousse',
    location: { lat: 35.8940, lng: 10.5980 },
    merchantId: 'm4',
    status: 'OPEN',
    deliveryTime: '25-35 min',
    deliveryFee: 4.0
  }
];

export const MOCK_PRODUCTS_LIST = [
  {
    id: 'p1',
    name: 'Whopper Meal',
    price: 18.5,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    storeId: 's1',
    status: 'AVAILABLE'
  },
  {
    id: 'p2',
    name: 'Steakhouse Burger',
    price: 22.0,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3ecc50f1?w=400',
    storeId: 's1',
    status: 'AVAILABLE'
  },
  {
    id: 'p3',
    name: 'Coca Cola 1.5L',
    price: 3.2,
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
    storeId: 's2',
    status: 'AVAILABLE'
  },
  {
    id: 'p4',
    name: 'Galaxy S24 Ultra',
    price: 4500.0,
    category: 'Phones',
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400',
    storeId: 's3',
    status: 'AVAILABLE'
  }
];
