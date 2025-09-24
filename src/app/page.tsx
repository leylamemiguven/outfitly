// import Image from "next/image";

// 'use client';
// import { useState } from 'react';

// type Swatch = { hex: string; weight: number };
// type Product = {
//   id: string; title: string; brand?: string; category?: string;
//   imageUrl: string; priceCents: number; currency: string;
//   match?: { colorScore: number };
// };

// export default function Home() {
//   const [swatches, setSwatches] = useState<Swatch[]>([
//     { hex: '#7e9a6c', weight: 0.5 }, { hex: '#e8dfc8', weight: 0.5 }
//   ]);
//   const [tolerance, setTolerance] = useState(20);
//   const [loading, setLoading] = useState(false);
//   const [results, setResults] = useState<Product[]>([]);

//   const update = (i: number, key: keyof Swatch, val: string | number) =>
//     setSwatches(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } as Swatch : s));

//   const add = () => setSwatches(prev => [...prev, { hex: '#888888', weight: 0.3 }]);
//   const remove = (i: number) => setSwatches(prev => prev.filter((_, idx) => idx !== i));

//   const search = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch('/api/search/color', {
//         method: 'POST', headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ palette: swatches, tolerance, filters: {} })
//       });
//       const data = await res.json();
//       setResults(data.results);
//     } finally { setLoading(false); }
//   };

//   return (
//     <main className="max-w-6xl mx-auto p-6">
//       <h1 className="text-3xl font-semibold mb-4">ChromaFit — Color Search (MVP)</h1>

//       <div className="rounded-2xl bg-white shadow p-4 mb-6">
//         <h2 className="text-xl font-medium mb-3">Palette</h2>
//         <div className="space-y-3">
//           {swatches.map((s, i) => (
//             <div key={i} className="flex items-center gap-3">
//               <input type="color" value={s.hex}
//                 onChange={e => update(i, 'hex', e.target.value)}
//                 className="h-10 w-16 border rounded"/>
//               <input type="text" value={s.hex}
//                 onChange={e => update(i, 'hex', e.target.value)}
//                 className="px-2 py-1 border rounded w-28"/>
//               <label className="text-sm">Weight</label>
//               <input type="number" step="0.1" min={0} max={1} value={s.weight}
//                 onChange={e => update(i, 'weight', parseFloat(e.target.value))}
//                 className="px-2 py-1 border rounded w-24"/>
//               <button onClick={() => remove(i)} className="ml-auto text-sm text-red-600">Remove</button>
//             </div>
//           ))}
//           <div className="flex items-center gap-4">
//             <button onClick={add} className="px-3 py-2 rounded bg-neutral-900 text-white">Add swatch</button>
//             <label className="text-sm">Tolerance (ΔE2000): {tolerance}</label>
//             <input type="range" min={5} max={40} value={tolerance}
//               onChange={e => setTolerance(parseInt(e.target.value))}/>
//             <button onClick={search} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white">Search</button>
//           </div>
//         </div>
//       </div>

//       {loading && <p>Searching…</p>}

//       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
//         {results.map(p => (
//           <div key={p.id} className="bg-white rounded-2xl shadow overflow-hidden">
//             <img src={p.imageUrl} alt={p.title} className="w-full h-56 object-cover"/>
//             <div className="p-3">
//               <div className="text-sm text-neutral-500">{p.brand} {p.category && `• ${p.category}`}</div>
//               <div className="font-medium">{p.title}</div>
//               <div className="text-sm mt-1">{(p.priceCents/100).toFixed(2)} {p.currency}</div>
//               {p.match && <div className="text-xs text-neutral-500 mt-1">
//                 Match: color {Math.round(p.match.colorScore*100)}%
//               </div>}
//             </div>
//           </div>
//         ))}
//       </div>
//     </main>
//   );
// }

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>✅ Next.js is serving the app</h1>
      <p>Try the health check at <code>/api/health</code>.</p>
    </main>
  );
}