'use client';

import { useEffect, useState } from 'react';

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  standardUnit: string;
  storageLocation: string | null;
  minimumStock: string | null;
  averageCost: string | null;
  lastCost: string | null;
  isActive: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Frontend mínimo do módulo de Ingredientes (Etapa 8).
 *
 * Não há tela de login ainda (fora do escopo até agora) — o token JWT é
 * colado manualmente aqui para autenticar as chamadas à API. Isso é
 * suficiente para validar o CRUD ponta a ponta; uma tela de login real
 * deve ser construída quando o roteiro chegar na etapa de UX (Etapa 19).
 */
export default function IngredientsPage() {
  const [token, setToken] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [standardUnit, setStandardUnit] = useState('kg');
  const [category, setCategory] = useState('');
  const [minimumStock, setMinimumStock] = useState('');
  const [averageCost, setAverageCost] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  async function loadIngredients() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/ingredients`, { headers: authHeaders() });
      if (!res.ok) {
        throw new Error(`Erro ${res.status} ao carregar ingredientes.`);
      }
      const data = await res.json();
      setIngredients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadIngredients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API_URL}/ingredients`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          standardUnit,
          category: category || undefined,
          minimumStock: minimumStock || undefined,
          averageCost: averageCost || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Erro ${res.status} ao criar ingrediente.`);
      }
      setName('');
      setCategory('');
      setMinimumStock('');
      setAverageCost('');
      await loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  async function handleToggleActive(ingredient: Ingredient) {
    setError(null);
    try {
      const action = ingredient.isActive ? 'deactivate' : 'activate';
      const res = await fetch(`${API_URL}/ingredients/${ingredient.id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Erro ${res.status} ao atualizar status.`);
      }
      await loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 800 }}>
      <h1>Ingredientes</h1>
      <p style={{ color: '#666' }}>
        Frontend mínimo (Etapa 8). Cole abaixo um token JWT obtido via <code>POST /auth/login</code>.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="token">Token JWT: </label>
        <input
          id="token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>

      {error && (
        <p style={{ color: 'crimson', border: '1px solid crimson', padding: '0.5rem' }}>{error}</p>
      )}

      <form onSubmit={handleCreate} style={{ marginBottom: '2rem', display: 'grid', gap: '0.5rem' }}>
        <h2>Novo ingrediente</h2>
        <input
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: '0.5rem' }}
        />
        <select value={standardUnit} onChange={(e) => setStandardUnit(e.target.value)} style={{ padding: '0.5rem' }}>
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="l">l</option>
          <option value="ml">ml</option>
          <option value="un">un</option>
        </select>
        <input
          placeholder="Categoria (opcional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '0.5rem' }}
        />
        <input
          placeholder="Estoque mínimo (opcional)"
          value={minimumStock}
          onChange={(e) => setMinimumStock(e.target.value)}
          style={{ padding: '0.5rem' }}
        />
        <input
          placeholder="Custo médio (opcional)"
          value={averageCost}
          onChange={(e) => setAverageCost(e.target.value)}
          style={{ padding: '0.5rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem' }}>
          Criar
        </button>
      </form>

      <h2>Lista</h2>
      {loading && <p>Carregando...</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Nome</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Unidade</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Custo médio</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Estoque mín.</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Status</th>
            <th style={{ borderBottom: '1px solid #ccc' }}></th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient) => (
            <tr key={ingredient.id}>
              <td>{ingredient.name}</td>
              <td>{ingredient.standardUnit}</td>
              <td>{ingredient.averageCost ?? '—'}</td>
              <td>{ingredient.minimumStock ?? '—'}</td>
              <td>{ingredient.isActive ? 'Ativo' : 'Inativo'}</td>
              <td>
                <button onClick={() => handleToggleActive(ingredient)}>
                  {ingredient.isActive ? 'Inativar' : 'Ativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
