'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Pipeline-ul NU mai e o pagină separată — Kanban e acum a treia vizualizare a pâlniei.
// Păstrăm ruta /pipeline doar ca redirect (linkuri/bookmark-uri vechi) → /palnie în mod Kanban.
export default function PipelineRedirect() {
  const router = useRouter();
  useEffect(() => {
    try { localStorage.setItem('amass-palnie-view', 'kanban'); } catch {}
    router.replace('/palnie');
  }, [router]);
  return <div className="p-10 text-center text-[var(--fg-soft)]">Se deschide pâlnia (Kanban)…</div>;
}
