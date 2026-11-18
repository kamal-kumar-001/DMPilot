import { notFound } from 'next/navigation';
import AdminReorgPreviewClient from './preview-client';

/**
 * STATIC SAMPLE - admin navigation reorganization proposal.
 * Dev-only: excluded from the production build (returns 404) so the sample
 * cannot ship accidentally in the combined release.
 */
export const dynamic = 'force-dynamic';

export default function AdminReorgPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AdminReorgPreviewClient />;
}
