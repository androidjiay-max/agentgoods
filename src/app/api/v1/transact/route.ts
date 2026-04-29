import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid API Key" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.split(" ")[1];
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Missing productId in request body" },
        { status: 400 }
      );
    }

    // Authenticate Agent
    const agent = await prisma.agent.findUnique({
      where: { apiKey },
      include: { user: true },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Invalid API Key" },
        { status: 401 }
      );
    }

    // Find Product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isAvailable) {
      return NextResponse.json(
        { success: false, error: "Product not found or unavailable" },
        { status: 404 }
      );
    }

    // Check budget and balance
    if (agent.currentSpend + product.price > agent.maxBudget) {
      return NextResponse.json(
        { success: false, error: "Agent budget exceeded" },
        { status: 403 }
      );
    }

    if (agent.user.balance < product.price) {
      return NextResponse.json(
        { success: false, error: "Human owner has insufficient platform balance" },
        { status: 402 }
      );
    }

    // Execute Transaction atomically using Prisma interactive transaction
    const transactionResult = await prisma.$transaction(async (tx: any) => {
      // 1. Deduct from Human User balance
      await tx.user.update({
        where: { id: agent.userId },
        data: { balance: { decrement: product.price } },
      });

      // 2. Increment Agent current spend
      await tx.agent.update({
        where: { id: agent.id },
        data: { currentSpend: { increment: product.price } },
      });

      // 3. Record the transaction in the ledger
      const ledgerEntry = await tx.ledgerTransaction.create({
        data: {
          agentId: agent.id,
          productId: product.id,
          amount: product.price,
          type: "PURCHASE",
        },
      });

      return ledgerEntry;
    });

    return NextResponse.json({
      success: true,
      data: {
        transaction_id: transactionResult.id,
        message: "Purchase successful. Here is your access token/data.",
        // Mock payload for the MVP:
        payload: {
          api_endpoint: `https://agentgoods.io/services/access/${product.id}`,
          access_token: `tmp_token_${Math.random().toString(36).substring(7)}`,
        },
      },
    });
  } catch (error) {
    console.error("Transaction Error:", error);
    return NextResponse.json(
      { success: false, error: "Transaction failed due to internal error" },
      { status: 500 }
    );
  }
}
