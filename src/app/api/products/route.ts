import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Connect to WooCommerce API
  // For now, return mock data
  //
  // To integrate WooCommerce:
  // 1. Install: npm install @woocommerce/woocommerce-rest-api
  // 2. Add to .env:
  //    WOOCOMMERCE_URL=https://your-store.com
  //    WOOCOMMERCE_CONSUMER_KEY=ck_xxxxx
  //    WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxx
  // 3. Uncomment the code below and remove mock data

  /*
  const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

  const api = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_URL,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
    version: "wc/v3"
  });

  try {
    const response = await api.get("products", {
      per_page: 20,
      status: "publish"
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("WooCommerce API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
  */

  // Mock data for development
  const mockProducts = [
    {
      id: 1,
      name: "Luxury Item 1",
      price: "99.99",
      images: [{ src: "/placeholder.jpg" }],
    },
    {
      id: 2,
      name: "Exotic Item 2",
      price: "149.99",
      images: [{ src: "/placeholder.jpg" }],
    },
    {
      id: 3,
      name: "Premium Collection",
      price: "199.99",
      images: [{ src: "/placeholder.jpg" }],
    },
  ];

  return NextResponse.json(mockProducts);
}
