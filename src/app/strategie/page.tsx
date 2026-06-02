import { redirect } from 'next/navigation';
// Fișa de strategie e per-client — se deschide din Pâlnie (butonul „Fișă").
// Ruta bare /strategie redirecționează la pâlnie ca să nu dea 404.
export default function StrategieIndex() { redirect('/palnie'); }
