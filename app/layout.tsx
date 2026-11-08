import type {Metadata} from 'next';
export const metadata:Metadata={title:'رواق | RIWAQ',description:'متجر رواق للقهوة المختصة — نسخة اختبار'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
