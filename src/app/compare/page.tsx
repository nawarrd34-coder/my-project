import type { Metadata } from 'next';
import { CompareFlow } from '@/components/compare/CompareFlow';

export const metadata: Metadata = {
  title: 'Competitor comparison — Business Health Check',
  description: 'Compare your website with a competitor’s: two independent analyses, side by side.',
};

export default function ComparePage() {
  return <CompareFlow />;
}
