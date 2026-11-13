/**
 * Item customisation (milk type, sugar level, add-ons…). Pure — shared by browser & server.
 *
 * modifier group: { id, name, type: 'single'|'multi', categories: [], exclude: [menuIds],
 *                   options: [{ id, name, price }], defaultId? }
 * a line's mods:  [{ groupId, group, optionId, name, price }]
 */

export const DEFAULT_MODIFIERS = [
  {
    id: 'g-milk', name: 'Milk', type: 'single', categories: ['Coffee'], exclude: ['m1'], defaultId: 'o-reg',
    options: [{ id: 'o-reg', name: 'Regular', price: 0 }, { id: 'o-oat', name: 'Oat milk', price: 30 }, { id: 'o-alm', name: 'Almond milk', price: 40 }, { id: 'o-soy', name: 'Soy milk', price: 25 }],
  },
  {
    id: 'g-sugar', name: 'Sugar level', type: 'single', categories: ['Coffee', 'Tea'], exclude: [], defaultId: 'o-norm',
    options: [{ id: 'o-none', name: 'No sugar', price: 0 }, { id: 'o-less', name: 'Less sugar', price: 0 }, { id: 'o-norm', name: 'Normal', price: 0 }, { id: 'o-extra', name: 'Extra sweet', price: 0 }],
  },
  {
    id: 'g-addon', name: 'Add-ons', type: 'multi', categories: ['Coffee'], exclude: [],
    options: [{ id: 'o-shot', name: 'Extra espresso shot', price: 40 }, { id: 'o-whip', name: 'Whipped cream', price: 30 }, { id: 'o-cara', name: 'Caramel drizzle', price: 25 }, { id: 'o-van', name: 'Vanilla syrup', price: 25 }],
  },
  {
    id: 'g-extra', name: 'Extras', type: 'multi', categories: ['Snacks'], exclude: ['m10', 'm11'],
    options: [{ id: 'o-cheese', name: 'Extra cheese', price: 30 }, { id: 'o-spicy', name: 'Make it spicy', price: 0 }],
  },
];

export const groupsFor = (item, modifiers = []) =>
  item ? modifiers.filter((g) => g.options?.length && g.categories?.includes(item.category) && !(g.exclude || []).includes(item.id)) : [];

/** Default selection: { [groupId]: [optionId…] } */
export const defaultSelection = (groups) =>
  Object.fromEntries(groups.map((g) => [g.id, g.type === 'single' ? [g.defaultId || g.options[0].id] : []]));

/** Turn a selection into a mods array. Throws on an invalid selection (used for server validation). */
export const buildMods = (item, selection = {}, modifiers = []) => {
  const groups = groupsFor(item, modifiers);
  const mods = [];
  groups.forEach((g) => {
    let ids = Array.isArray(selection[g.id]) ? selection[g.id] : [];
    if (g.type === 'single') ids = ids.length ? [ids[0]] : [g.defaultId || g.options[0].id];
    [...new Set(ids)].forEach((oid) => {
      const o = g.options.find((x) => x.id === oid);
      if (!o) throw new Error(`Invalid option for ${item.name}`);
      mods.push({ groupId: g.id, group: g.name, optionId: o.id, name: o.name, price: Number(o.price) || 0 });
    });
  });
  return mods;
};

/** Selection from the client payload format [{groupId, optionIds}] or {groupId: [ids]} */
export const selectionFrom = (raw) => {
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((m) => [m.groupId, m.optionIds || [m.optionId]]));
  return raw || {};
};

export const modsPrice = (mods = []) => mods.reduce((s, m) => s + (Number(m.price) || 0), 0);

/** Identity of a cart line: same item + same options = same line */
export const lineKey = (menuId, mods = []) => [menuId, ...mods.map((m) => m.optionId).sort()].join('|');

/** Human label shown on KDS / receipts; hides "default-looking" choices like Regular/Normal */
export const modsLabel = (mods = []) =>
  mods.filter((m) => !['Regular', 'Normal'].includes(m.name)).map((m) => (m.price > 0 ? `${m.name} +${m.price}` : m.name)).join(', ');
