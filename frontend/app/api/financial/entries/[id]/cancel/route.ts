import { NextRequest } from 'next/server';
import { proxyBackendMutation } from '@/lib/api-proxy';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendMutation(request, `/financial/entries/${params.id}/cancel`, 'PATCH');
}
