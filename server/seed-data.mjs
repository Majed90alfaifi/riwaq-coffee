// All products, prices, stock, and brand details are fictional demonstration data.
export const SEED_PRODUCTS=[
['ethiopia','إثيوبيا | سيداما','Ethiopia | Sidama','beans',58,'إثيوبيا','Ethiopia','فاكهية','Fruity','#b77853','توت، ياسمين، حمضيات','Berries, jasmine, citrus','مجففة','Natural','ترشيح','Filter'],
['brazil','البرازيل | سيرادو','Brazil | Cerrado','beans',46,'البرازيل','Brazil','شوكولاتية','Chocolatey','#6b7560','شوكولاتة، مكسرات، كراميل','Chocolate, nuts, caramel','مغسولة','Washed','إسبريسو','Espresso'],
['colombia','كولومبيا | هويلا','Colombia | Huila','beans',54,'كولومبيا','Colombia','متوازنة','Balanced','#a99c6b','تفاح أحمر، كراميل، كاكاو','Red apple, caramel, cocoa','مغسولة','Washed','ترشيح','Filter'],
['blend','خلطة رواق اليومية','RIWAQ Daily Blend','beans',48,'البرازيل','Brazil','متوازنة','Balanced','#637c7d','كاكاو، بندق، سكر بني','Cocoa, hazelnut, brown sugar','مزيج','Blend','إسبريسو','Espresso'],
['kenya','كينيا | نييري','Kenya | Nyeri','beans',64,'كينيا','Kenya','فاكهية','Fruity','#8a6667','كشمش، توت، شاي أسود','Currant, berries, black tea','مغسولة','Washed','ترشيح','Filter'],
['decaf','كولومبيا | بدون كافيين','Colombia | Decaf','beans',60,'كولومبيا','Colombia','شوكولاتية','Chocolatey','#8a856e','كاكاو، تمر، كراميل','Cocoa, dates, caramel','منزوعة الكافيين','Decaffeinated','فرنش برس','French press'],
['drip-ethiopia','أظرف سيداما | 5 أظرف','Sidama Drip Bags | 5 bags','drip',32,'إثيوبيا','Ethiopia','فاكهية','Fruity','#b77853','توت، ياسمين','Berries, jasmine','مجففة','Natural','ترشيح','Filter'],
['drip-blend','أظرف رواق | 10 أظرف','RIWAQ Drip Bags | 10 bags','drip',52,'البرازيل','Brazil','متوازنة','Balanced','#637c7d','كاكاو، بندق','Cocoa, hazelnut','مزيج','Blend','ترشيح','Filter'],
['dripper','قمع ترشيح خزفي','Ceramic Coffee Dripper','tools',79,'','','متوازنة','Balanced','#bfb7a3','','','','','ترشيح','Filter'],
['server','إبريق تقديم | 600 مل','Coffee Server | 600 ml','tools',65,'','','متوازنة','Balanced','#acb4ac','','','','','ترشيح','Filter'],
['discovery','بوكس اكتشاف المحاصيل','Coffee Discovery Box','gifts',135,'','','متوازنة','Balanced','#646f56','3 محاصيل × 250 جم','3 origins × 250 g','','','ترشيح','Filter'],
['gift','هدية رواق للتحضير','RIWAQ Brewing Gift Set','gifts',219,'','','متوازنة','Balanced','#a78267','قهوة 250 جم، قمع، فلاتر','250 g coffee, dripper, filters','','','ترشيح','Filter']
].map((a,i)=>({id:a[0],ar:a[1],en:a[2],cat:a[3],price:a[4],country:a[5],countryEn:a[6],taste:a[7],tasteEn:a[8],color:a[9],notes:a[10],notesEn:a[11],process:a[12],processEn:a[13],brew:a[14],brewEn:a[15],stock:i===4?0:20,region:['سيداما','سيرادو','هويلا','رواق','نييري','هويلا'][i]||'رواق',regionEn:['Sidama','Cerrado','Huila','RIWAQ','Nyeri','Huila'][i]||'RIWAQ'}));
