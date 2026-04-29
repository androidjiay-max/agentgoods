"use server"

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

// 1. Ensure a default human user exists for the MVP
export async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "admin@agentgoods.io",
        balance: 1000, // starting balance
      }
    });
  }
  return user;
}

export async function depositFunds(userId: string, amount: number) {
  // Simulate Stripe Checkout / USDC Deposit
  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } }
  });
  revalidatePath("/");
}

export async function createAgent(userId: string, name: string, maxBudget: number) {
  const apiKey = "ag_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await prisma.agent.create({
    data: {
      name,
      apiKey,
      maxBudget,
      userId,
    }
  });
  revalidatePath("/");
}

export async function deleteAgent(agentId: string) {
  await prisma.agent.delete({ where: { id: agentId } });
  revalidatePath("/");
}

export async function createProduct(name: string, description: string, price: number) {
  const schemaString = JSON.stringify({
    type: "object",
    properties: {
      action: { type: "string" }
    }
  });

  await prisma.product.create({
    data: {
      name,
      description,
      price,
      schemaString
    }
  });
  revalidatePath("/");
}

export async function deleteProduct(productId: string) {
  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/");
}
