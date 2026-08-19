import { NextRequest } from 'next/server';
import { proxyBackendMutation } from '@/lib/api-proxy';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendMutation(request, `/products/${params.id}/ficha-tecnica/simulate`, 'POST');
}
