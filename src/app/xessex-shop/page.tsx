"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

interface Product {
  id: number;
  name: string;
  price: string;
  images?: Array<{ src: string }>;
}

export default function XessexShop() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadProducts();
  }, []);

  return (
    <main
      className="min-h-screen text-white"
      style={{
        background:
          "linear-gradient(135deg, #ff8ad4 0%, #ff4fb2 40%, #ff9df2 100%)",
      }}
    >
      <section className="relative w-full h-[60vh] flex items-center justify-center text-center px-6">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4), transparent 60%)",
            mixBlendMode: "screen",
          }}
        />

        <div className="relative z-10 max-w-3xl">
          <h1
            className="text-6xl font-extrabold drop-shadow-lg tracking-wide"
            style={{
              background: "linear-gradient(90deg, #fff, #ffe6fa, #ffffff)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            XESSEX COLLECTION
          </h1>

          <p className="mt-4 text-xl font-light text-pink-50">
            Luxury • Exotic • Beautifully Curated Essentials
          </p>
        </div>
      </section>

      <section className="px-8 py-16">
        <h2 className="text-4xl font-bold mb-10 text-center">Featured Products</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.length === 0 && (
            <p className="text-center col-span-full text-pink-100">
              Products loading… connect WooCommerce API to display items.
            </p>
          )}

          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl p-4 shadow-lg hover:scale-[1.03] transition"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))",
                border: "1px solid rgba(255,255,255,0.3)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="relative h-56 w-full rounded-xl overflow-hidden">
                <Image
                  src={p.images?.[0]?.src || "/placeholder.jpg"}
                  alt={p.name}
                  fill
                  className="object-cover"
                />
              </div>

              <h4 className="mt-4 text-lg font-semibold">{p.name}</h4>
              <p className="text-pink-200 mt-1">${p.price}</p>

              <button
                className="mt-4 w-full py-3 rounded-full font-semibold"
                style={{
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #ffd6f5 40%, #ffffff 100%)",
                  color: "#ff4fb2",
                }}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
