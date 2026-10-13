import { notFound } from 'next/navigation';
import { Lab } from '@/ui/Lab';

/** 문제 화면 점검용 페이지. 배포 환경에서는 NEXT_PUBLIC_LAB=1 일 때만 열린다. */
export default function LabPage() {
  if (process.env.NEXT_PUBLIC_LAB !== '1') notFound();
  return <Lab />;
}
