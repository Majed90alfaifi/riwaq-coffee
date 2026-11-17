// Demo content for the QR-menu service. Both venues are fictional; prices are sample
// figures for the demo, not a real business's price list. Badges are only the
// owner-style labels below — no nutrition, calorie or allergen facts are claimed.
const img = k => `/menu/img/${k}.svg`;

export const DEMO_VENUES = [
  {
    id: 'venue-bait-alhail',
    slug: 'bait-alhail',
    data: {
      demo: true,
      name_ar: 'بيت الهيل',
      name_en: 'Bait Al-Hail',
      tagline_ar: 'قهوة مختصة وحلويات بيتية',
      tagline_en: 'Specialty coffee & homemade sweets',
      about_ar: 'مقهى حيّ صغير يقدّم القهوة المختصة والقهوة السعودية بالهيل، مع مخبوزات تُخبز كل صباح.',
      about_en: 'A small neighbourhood café serving specialty coffee and cardamom Saudi coffee, with pastries baked every morning.',
      address_ar: 'حي الورود، الرياض — عنوان تجريبي',
      address_en: 'Al Wurud, Riyadh — sample address',
      open: '07:00',
      close: '01:00',
      hours_note_ar: 'يوميًا',
      hours_note_en: 'Daily',
      phone: '',
      whatsapp: '',
      instagram: '',
      map_url: '',
      brand: '#1f4d45',
      logo: '',
    },
    categories: [
      {id: 'bh-hot', name_ar: 'القهوة الساخنة', name_en: 'Hot coffee', items: [
        {id: 'bh-espresso', name_ar: 'إسبريسو', name_en: 'Espresso', desc_ar: 'جرعة مركّزة من محصول اليوم.', desc_en: 'A concentrated shot of today’s roast.', price: 1200, image: img('espresso'), badges: []},
        {id: 'bh-cortado', name_ar: 'كورتادو', name_en: 'Cortado', desc_ar: 'إسبريسو مع كمية متساوية من الحليب المبخّر.', desc_en: 'Espresso cut with an equal amount of steamed milk.', price: 1500, image: '', badges: []},
        {id: 'bh-latte', name_ar: 'لاتيه', name_en: 'Latte', desc_ar: 'إسبريسو وحليب مبخّر بطبقة رغوة ناعمة.', desc_en: 'Espresso and steamed milk with a silky foam.', price: 1800, image: img('latte'), badges: ['popular']},
        {id: 'bh-cardamom-latte', name_ar: 'لاتيه الهيل', name_en: 'Cardamom latte', desc_ar: 'لاتيه بشراب الهيل المحضّر في المقهى.', desc_en: 'Latte with our house-made cardamom syrup.', price: 2100, image: img('latte'), badges: ['signature']},
        {id: 'bh-v60', name_ar: 'قهوة مقطّرة V60', name_en: 'V60 pour-over', desc_ar: 'تُحضّر يدويًا كوبًا بكوب. اسأل عن محصول اليوم.', desc_en: 'Brewed by hand, one cup at a time. Ask about today’s origin.', price: 2200, image: img('filter'), badges: []},
        {id: 'bh-saudi', name_ar: 'دلة قهوة سعودية', name_en: 'Saudi coffee pot', desc_ar: 'قهوة عربية بالهيل والزعفران، تُقدّم مع التمر. تكفي شخصين إلى ثلاثة.', desc_en: 'Arabic coffee with cardamom and saffron, served with dates. Serves two to three.', price: 2500, image: img('dallah'), badges: ['popular', 'signature']},
      ]},
      {id: 'bh-cold', name_ar: 'المشروبات الباردة', name_en: 'Cold drinks', items: [
        {id: 'bh-iced-latte', name_ar: 'آيس لاتيه', name_en: 'Iced latte', desc_ar: 'إسبريسو مزدوج مع حليب بارد وثلج.', desc_en: 'Double espresso over cold milk and ice.', price: 1900, image: img('iced'), badges: []},
        {id: 'bh-spanish', name_ar: 'سبانش لاتيه بارد', name_en: 'Iced Spanish latte', desc_ar: 'لاتيه بارد بالحليب المكثّف المحلّى.', desc_en: 'Iced latte sweetened with condensed milk.', price: 2100, image: img('iced'), badges: ['popular']},
        {id: 'bh-cold-brew', name_ar: 'كولد برو', name_en: 'Cold brew', desc_ar: 'قهوة منقوعة على البارد لمدة ١٨ ساعة.', desc_en: 'Coffee steeped cold for 18 hours.', price: 1900, image: '', badges: ['new']},
        {id: 'bh-hibiscus', name_ar: 'كركديه مثلج', name_en: 'Iced hibiscus', desc_ar: 'منقوع الكركديه مع شرائح البرتقال.', desc_en: 'Hibiscus infusion with orange slices.', price: 1400, image: img('tea'), badges: []},
        {id: 'bh-lemon-mint', name_ar: 'ليمون بالنعناع', name_en: 'Lemon mint', desc_ar: 'ليمون طازج ونعناع، مخفوق مع الثلج.', desc_en: 'Fresh lemon and mint blended with ice.', price: 1600, image: '', badges: [], available: false},
      ]},
      {id: 'bh-bakery', name_ar: 'المخبوزات', name_en: 'Bakery', items: [
        {id: 'bh-croissant', name_ar: 'كرواسون بالزبدة', name_en: 'Butter croissant', desc_ar: 'يُخبز كل صباح في المقهى.', desc_en: 'Baked in-house every morning.', price: 1200, image: img('croissant'), badges: []},
        {id: 'bh-zaatar', name_ar: 'كرواسون زعتر وجبنة', name_en: 'Za’atar & cheese croissant', desc_ar: 'كرواسون بالزعتر وجبنة العكاوي.', desc_en: 'Croissant with za’atar and akkawi cheese.', price: 1500, image: img('croissant'), badges: []},
        {id: 'bh-halloumi', name_ar: 'ساندويتش حلومي', name_en: 'Halloumi sandwich', desc_ar: 'حلومي مشوي مع طماطم وجرجير وصوص الزيتون في خبز الساوردو.', desc_en: 'Grilled halloumi, tomato, rocket and olive sauce on sourdough.', price: 2400, image: img('sandwich'), badges: ['new']},
        {id: 'bh-shakshuka', name_ar: 'ساندويتش شكشوكة حار', name_en: 'Spicy shakshuka sandwich', desc_ar: 'بيض بصلصة الطماطم والفلفل الحار في خبز البريوش.', desc_en: 'Eggs in tomato and chilli sauce in a brioche bun.', price: 2200, image: '', badges: ['spicy', 'new']},
      ]},
      {id: 'bh-sweets', name_ar: 'الحلويات', name_en: 'Desserts', items: [
        {id: 'bh-date-cake', name_ar: 'كيكة التمر', name_en: 'Date cake', desc_ar: 'كيكة التمر الدافئة مع صوص التوفي.', desc_en: 'Warm date cake with toffee sauce.', price: 2200, image: img('cake'), badges: ['popular']},
        {id: 'bh-cheesecake', name_ar: 'تشيز كيك سان سباستيان', name_en: 'San Sebastián cheesecake', desc_ar: 'تشيز كيك محروق الوجه، قوامه كريمي.', desc_en: 'Burnt-top cheesecake with a creamy centre.', price: 2600, image: img('cake'), badges: []},
        {id: 'bh-cookie', name_ar: 'كوكيز الشوكولاتة', name_en: 'Chocolate chip cookie', desc_ar: 'كوكيز طرية بقطع الشوكولاتة الداكنة.', desc_en: 'Soft cookie with dark chocolate chunks.', price: 900, image: img('cookie'), badges: []},
      ]},
      {id: 'bh-seasonal', name_ar: 'أصناف موسمية', name_en: 'Seasonal', items: []},
    ],
  },
  {
    id: 'venue-sunbula',
    slug: 'sunbula',
    data: {
      demo: true,
      name_ar: 'مخبز سنبلة',
      name_en: 'Sunbula Bakery',
      tagline_ar: 'منيو قيد الإعداد',
      tagline_en: 'Menu being set up',
      about_ar: 'نشاط تجريبي ثانٍ لعرض شكل المنيو قبل إضافة أي أصناف.',
      about_en: 'A second demo venue that shows the menu before any items are added.',
      address_ar: '', address_en: '', open: '', close: '', hours_note_ar: '', hours_note_en: '',
      phone: '', whatsapp: '', instagram: '', map_url: '', brand: '#7a3e1d', logo: '',
    },
    categories: [],
  },
];

export function venueStatements(db, v, t) {
  const stmts = [db.prepare('INSERT INTO menu_venues (id,slug,data,version,created_at,updated_at) VALUES (?,?,?,1,?,?)').bind(v.id, v.slug, JSON.stringify(v.data), t, t)];
  v.categories.forEach((c, ci) => {
    stmts.push(db.prepare('INSERT INTO menu_categories (id,venue_id,data,position,version) VALUES (?,?,?,?,1)').bind(c.id, v.id, JSON.stringify({name_ar: c.name_ar, name_en: c.name_en}), ci));
    c.items.forEach((it, ii) => {
      const {id, price, available = true, ...data} = it;
      stmts.push(db.prepare('INSERT INTO menu_items (id,venue_id,category_id,data,price,available,position,version,updated_at) VALUES (?,?,?,?,?,?,?,1,?)').bind(id, v.id, c.id, JSON.stringify(data), price, available ? 1 : 0, ii, t));
    });
  });
  return stmts;
}

// Seeds once: an owner who deletes demo content won't see it come back on the next request.
export async function seedMenuDemo(db) {
  if ((await db.prepare('SELECT COUNT(*) AS n FROM menu_venues').first()).n) return;
  const t = Math.floor(Date.now() / 1000);
  await db.batch(DEMO_VENUES.flatMap(v => venueStatements(db, v, t)));
}

// Restores one demo venue to its original content (demo venues only).
export async function resetDemoVenue(db, slug) {
  const v = DEMO_VENUES.find(x => x.slug === slug);
  if (!v) return false;
  const t = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare('DELETE FROM menu_items WHERE venue_id=?').bind(v.id),
    db.prepare('DELETE FROM menu_categories WHERE venue_id=?').bind(v.id),
    db.prepare('DELETE FROM menu_venues WHERE id=?').bind(v.id),
    ...venueStatements(db, v, t),
  ]);
  return true;
}
