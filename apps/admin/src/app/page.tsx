import { redirect } from 'next/navigation';

// 루트 → 대시보드 (미인증 시 middleware가 /login 으로)
export default function Home() {
  redirect('/dashboard');
}
