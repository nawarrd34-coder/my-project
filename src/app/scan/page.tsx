import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ScanFlow } from '@/components/scan/ScanFlow';

export const metadata: Metadata = {
  title: 'Digital Health Report — Business Health Check',
  robots: { index: false, follow: false },
};

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanFlow />
    </Suspense>
  );
}
