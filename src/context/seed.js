const ago = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();

export const seedData = () => {
  const menu = [
    { id: 'm1', name: 'Espresso', category: 'Coffee', price: 90, veg: true, available: true },
    { id: 'm2', name: 'Cappuccino', category: 'Coffee', price: 140, veg: true, available: true },
    { id: 'm3', name: 'Cafe Latte', category: 'Coffee', price: 150, veg: true, available: true },
    { id: 'm4', name: 'Cold Coffee', category: 'Coffee', price: 160, veg: true, available: true },
    { id: 'm5', name: 'Masala Chai', category: 'Tea', price: 40, veg: true, available: true },
    { id: 'm6', name: 'Green Tea', category: 'Tea', price: 70, veg: true, available: true },
    { id: 'm7', name: 'Lemon Ice Tea', category: 'Tea', price: 110, veg: true, available: true },
    { id: 'm8', name: 'Veg Sandwich', category: 'Snacks', price: 120, veg: true, available: true },
    { id: 'm9', name: 'Chicken Sandwich', category: 'Snacks', price: 170, veg: false, available: true },
    { id: 'm10', name: 'French Fries', category: 'Snacks', price: 110, veg: true, available: true },
    { id: 'm11', name: 'Vada Pav', category: 'Snacks', price: 30, veg: true, available: true },
    { id: 'm12', name: 'Margherita Pizza', category: 'Snacks', price: 240, veg: true, available: true },
    { id: 'm13', name: 'Chocolate Brownie', category: 'Desserts', price: 130, veg: true, available: true },
    { id: 'm14', name: 'Cheesecake', category: 'Desserts', price: 190, veg: true, available: true },
    { id: 'm15', name: 'Fresh Lime Soda', category: 'Beverages', price: 80, veg: true, available: true },
    { id: 'm16', name: 'Mango Shake', category: 'Beverages', price: 140, veg: true, available: true },
  ];

  const mk = (no, daysAgo, items, method = 'cash', type = 'dine-in', tableId = null) => ({
    id: 'o' + no,
    no,
    type,
    tableId,
    customerId: null,
    customerName: '',
    items: items.map(([mid, qty]) => {
      const m = menu.find((x) => x.id === mid);
      return { menuId: mid, name: m.name, price: m.price, qty, note: '' };
    }),
    status: 'paid',
    discount: 0,
    taxPercent: 5,
    paymentMethod: method,
    createdAt: ago(daysAgo, 2),
    paidAt: ago(daysAgo, 1),
  });

  const orders = [
    mk(1001, 6, [['m2', 2], ['m8', 1]], 'upi'),
    mk(1002, 5, [['m4', 1], ['m10', 2]], 'cash', 'takeaway'),
    mk(1003, 4, [['m12', 1], ['m15', 2]], 'card'),
    mk(1004, 3, [['m5', 4], ['m11', 4]], 'cash'),
    mk(1005, 2, [['m3', 2], ['m13', 2]], 'upi'),
    mk(1006, 1, [['m9', 2], ['m16', 2]], 'upi', 'delivery'),
    mk(1007, 0, [['m2', 1], ['m14', 1]], 'card'),
    mk(1008, 0, [['m1', 2], ['m10', 1]], 'cash', 'takeaway'),
  ];

  return {
    settings: {
      cafeName: 'Soffity Cafe',
      address: 'MG Road, Pune',
      phone: '9876543210',
      gstin: '',
      taxPercent: 5,
      currency: '₹',
      footer: 'Thank you! Visit again',
      pin: '1234',
      lockEnabled: false,
      sound: true,
    },
    categories: ['Coffee', 'Tea', 'Snacks', 'Desserts', 'Beverages'],
    menu,
    tables: Array.from({ length: 8 }, (_, i) => ({ id: 't' + (i + 1), name: 'T' + (i + 1), seats: i < 4 ? 2 : 4 })),
    orders,
    nextOrderNo: 1009,
    inventory: [
      { id: 'i1', name: 'Coffee Beans', unit: 'kg', qty: 4, minQty: 2, cost: 900 },
      { id: 'i2', name: 'Milk', unit: 'L', qty: 12, minQty: 10, cost: 60 },
      { id: 'i3', name: 'Sugar', unit: 'kg', qty: 8, minQty: 3, cost: 45 },
      { id: 'i4', name: 'Tea Leaves', unit: 'kg', qty: 1, minQty: 2, cost: 400 },
      { id: 'i5', name: 'Bread', unit: 'pkt', qty: 6, minQty: 5, cost: 40 },
      { id: 'i6', name: 'Cheese', unit: 'kg', qty: 2, minQty: 1, cost: 450 },
      { id: 'i7', name: 'Paper Cups', unit: 'pcs', qty: 300, minQty: 100, cost: 2 },
    ],
    staff: [
      { id: 's1', name: 'Rahul Patil', role: 'Manager', phone: '9800000001', salary: 25000, active: true, attendance: {} },
      { id: 's2', name: 'Sneha Joshi', role: 'Cashier', phone: '9800000002', salary: 15000, active: true, attendance: {} },
      { id: 's3', name: 'Amit Shinde', role: 'Chef', phone: '9800000003', salary: 20000, active: true, attendance: {} },
      { id: 's4', name: 'Kiran More', role: 'Waiter', phone: '9800000004', salary: 12000, active: true, attendance: {} },
    ],
    customers: [
      { id: 'c1', name: 'Priya Kulkarni', phone: '9900000001', email: '', visits: 5, totalSpent: 2400, points: 24 },
      { id: 'c2', name: 'Sagar Deshmukh', phone: '9900000002', email: '', visits: 2, totalSpent: 780, points: 7 },
    ],
    expenses: [
      { id: 'e1', date: ago(5).slice(0, 10), category: 'Rent', amount: 15000, note: 'Monthly rent' },
      { id: 'e2', date: ago(3).slice(0, 10), category: 'Supplies', amount: 3200, note: 'Milk & beans' },
      { id: 'e3', date: ago(1).slice(0, 10), category: 'Utilities', amount: 1800, note: 'Electricity' },
    ],
  };
};
