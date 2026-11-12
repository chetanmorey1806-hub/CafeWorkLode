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
    { id: 'm17', name: 'Butter Croissant', category: 'Desserts', price: 110, veg: true, available: true },
  ];

  // Recipes (inventory used per serving) → auto stock deduction & "sold out" detection
  const R = {
    m1: [['i1', 0.018], ['i7', 1]], m2: [['i1', 0.018], ['i2', 0.15], ['i7', 1]], m3: [['i1', 0.018], ['i2', 0.2], ['i7', 1]],
    m4: [['i1', 0.02], ['i2', 0.25], ['i3', 0.02], ['i7', 1]], m5: [['i4', 0.005], ['i2', 0.1], ['i3', 0.015], ['i7', 1]],
    m6: [['i4', 0.003], ['i7', 1]], m7: [['i4', 0.004], ['i3', 0.02]], m8: [['i5', 0.25], ['i6', 0.02]],
    m9: [['i5', 0.25], ['i6', 0.02]], m12: [['i6', 0.08]], m16: [['i2', 0.2], ['i3', 0.02]], m17: [['i8', 1]],
  };
  // Hand-picked "goes well with" pairings for smart upselling
  const P = { m1: ['m17', 'm13'], m2: ['m17', 'm13'], m3: ['m17', 'm14'], m4: ['m13', 'm10'], m5: ['m11', 'm8'], m6: ['m17'] };
  menu.forEach((m) => {
    m.recipe = (R[m.id] || []).map(([inventoryId, qty]) => ({ inventoryId, qty }));
    m.pairs = P[m.id] || [];
  });

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
      dailyTarget: 5000,
      upiId: 'soffitycafe@upi',
      upiName: 'Soffity Cafe',
      publicUrl: '',
      desktopAlerts: false,
      loyalty: {
        pointsPer: 100,
        stampEvery: 5,
        stampCategories: ['Coffee'],
        tierDiscountAuto: true,
        tiers: [
          { name: 'Silver', min: 2000, discount: 5 },
          { name: 'Gold', min: 5000, discount: 10 },
          { name: 'Platinum', min: 10000, discount: 15 },
        ],
        plans: [{ id: 'p1', name: 'Daily Coffee Pass', price: 999, days: 30, maxPrice: 160, category: 'Coffee' }],
      },
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
      { id: 'i8', name: 'Croissants', unit: 'pcs', qty: 12, minQty: 5, cost: 45 },
    ],
    staff: [
      { id: 's1', name: 'Rahul Patil', role: 'Manager', phone: '9800000001', salary: 25000, active: true, attendance: {} },
      { id: 's2', name: 'Sneha Joshi', role: 'Cashier', phone: '9800000002', salary: 15000, active: true, attendance: {} },
      { id: 's3', name: 'Amit Shinde', role: 'Chef', phone: '9800000003', salary: 20000, active: true, attendance: {} },
      { id: 's4', name: 'Kiran More', role: 'Waiter', phone: '9800000004', salary: 12000, active: true, attendance: {} },
    ],
    customers: [
      { id: 'c1', name: 'Priya Kulkarni', phone: '9900000001', email: '', visits: 5, totalSpent: 2400, points: 24, stamps: 4, wallet: 500, subscription: null },
      { id: 'c2', name: 'Sagar Deshmukh', phone: '9900000002', email: '', visits: 2, totalSpent: 780, points: 7, stamps: 2, wallet: 0, subscription: null },
    ],
    ledger: [],
    expenses: [
      { id: 'e1', date: ago(5).slice(0, 10), category: 'Rent', amount: 15000, note: 'Monthly rent' },
      { id: 'e2', date: ago(3).slice(0, 10), category: 'Supplies', amount: 3200, note: 'Milk & beans' },
      { id: 'e3', date: ago(1).slice(0, 10), category: 'Utilities', amount: 1800, note: 'Electricity' },
    ],
  };
};
