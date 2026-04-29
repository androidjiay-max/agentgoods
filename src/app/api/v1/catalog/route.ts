import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isAvailable: true,
      },
    });

    // Formatting it specifically for Agent/LLM tool calling standard
    const catalog = products.map((p: any) => ({
      product_id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      is_subscription: p.isSubscription,
      // If a schemaString was provided, parse it, else return null
      tool_schema: p.schemaString ? JSON.parse(p.schemaString) : null,
    }));

    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    console.error("Error fetching catalog:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}
